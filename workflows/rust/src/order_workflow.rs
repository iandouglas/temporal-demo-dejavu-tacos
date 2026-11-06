use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use temporalio_common::RetryPolicy;
use temporalio_macros::{workflow, workflow_methods};
use temporalio_sdk::{
    ActivityOptions, SyncWorkflowContext, WorkflowCancellationToken, WorkflowContext,
    WorkflowContextView, WorkflowResult, WorkflowTermination,
};

use crate::activities::OrderActivities;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct OrderInput {
    pub order_id: String,
    pub items: Vec<Value>,
    pub total: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub authorization_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub success: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OrderResult {
    pub success: bool,
    pub order_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

const KITCHEN_WAIT_TIMEOUT: Duration = Duration::from_secs(60 * 60);

fn activity_options(start_to_close_seconds: u64) -> ActivityOptions {
    ActivityOptions::with_start_to_close_timeout(Duration::from_secs(start_to_close_seconds))
        .retry_policy(RetryPolicy::builder().maximum_attempts(3).build())
        .build()
}

/// Order processing with saga compensation: validation, payment hold, store
/// submission, pickup Signal, capture. If a step fails for good, the Workflow
/// releases the payment hold.
#[workflow]
#[derive(Default)]
pub struct OrderWorkflow {
    order_ready: bool,
    status: String,
}

#[workflow_methods]
impl OrderWorkflow {
    #[run]
    pub async fn run(
        ctx: &mut WorkflowContext<Self>,
        order: OrderInput,
    ) -> WorkflowResult<OrderResult> {
        // Compensation stack, holding the input each release will run with.
        let mut compensations: Vec<OrderInput> = Vec::new();

        let error = match Self::process_order(ctx, &order, &mut compensations).await {
            Ok(()) => {
                return Ok(OrderResult {
                    success: true,
                    order_id: order.order_id,
                    error: None,
                });
            }
            // The Worker dropped this run from its cache. Nothing failed, and
            // it replays from history when it's needed again.
            Err(WorkflowTermination::Evicted) => return Err(WorkflowTermination::Evicted),
            Err(error) => error,
        };

        ctx.state_mut(|s| s.status = "compensating".to_string());

        // A fresh token detaches these Activities from Workflow cancellation,
        // so a cancelled order still gets its hold released.
        let detached = WorkflowCancellationToken::new();
        for input in compensations.into_iter().rev() {
            let options = ActivityOptions::with_start_to_close_timeout(Duration::from_secs(10))
                .retry_policy(RetryPolicy::builder().maximum_attempts(5).build())
                .cancellation_token(detached.clone())
                .build();
            if let Err(compensation_error) = ctx
                .execute_activity(OrderActivities::release_payment_hold, input, options)
                .await
            {
                eprintln!("Compensation failed: {compensation_error}");
            }
        }

        ctx.state_mut(|s| s.status = "failed".to_string());
        let notify_options = ActivityOptions::with_start_to_close_timeout(Duration::from_secs(10))
            .cancellation_token(detached)
            .build();
        let notify_input = OrderInput {
            success: Some(false),
            ..order.clone()
        };
        ctx.execute_activity(OrderActivities::notify_customer, notify_input, notify_options)
            .await?;

        Ok(OrderResult {
            success: false,
            order_id: order.order_id,
            error: Some(error.to_string()),
        })
    }

    async fn process_order(
        ctx: &mut WorkflowContext<Self>,
        order: &OrderInput,
        compensations: &mut Vec<OrderInput>,
    ) -> WorkflowResult<()> {
        ctx.state_mut(|s| s.status = "validating_order".to_string());
        ctx.execute_activity(
            OrderActivities::validate_order,
            order.clone(),
            activity_options(10),
        )
        .await?;

        ctx.state_mut(|s| s.status = "validating_store".to_string());
        ctx.execute_activity(
            OrderActivities::validate_store,
            order.clone(),
            activity_options(10),
        )
        .await?;

        // Register the compensation before the hold: the Activity can succeed
        // and still lose its response, leaving a hold the Workflow never heard
        // about.
        ctx.state_mut(|s| s.status = "authorizing_payment".to_string());
        compensations.push(order.clone());
        let payment = ctx
            .execute_activity(
                OrderActivities::authorize_payment,
                order.clone(),
                activity_options(15),
            )
            .await?;
        let authorization_id = payment["authorization_id"].as_str().map(str::to_string);
        if let Some(release) = compensations.last_mut() {
            release.authorization_id = authorization_id.clone();
        }

        ctx.state_mut(|s| s.status = "clearing_cart".to_string());
        ctx.execute_activity(
            OrderActivities::clear_cart,
            order.clone(),
            activity_options(5),
        )
        .await?;

        // The demo's failure point. The generous policy leaves the presenter
        // time to show retries, then plug the store back in.
        ctx.state_mut(|s| s.status = "submitting_to_store".to_string());
        let submit_options = ActivityOptions::with_start_to_close_timeout(Duration::from_secs(10))
            .retry_policy(
                RetryPolicy::builder()
                    .initial_interval(Duration::from_secs(2))
                    .backoff_coefficient(1.5)
                    .maximum_interval(Duration::from_secs(8))
                    .maximum_attempts(10)
                    .build(),
            )
            .build();
        ctx.execute_activity(
            OrderActivities::submit_to_store,
            order.clone(),
            submit_options,
        )
        .await?;

        // Human in the loop: the kitchen sends the order_ready Signal. With no
        // word from the kitchen, the order completes anyway when the timer fires.
        ctx.state_mut(|s| s.status = "preparing".to_string());
        temporalio_sdk::workflows::select! {
            ready = ctx.wait_condition(|s: &Self| s.order_ready) => ready?,
            _ = ctx.timer(KITCHEN_WAIT_TIMEOUT) => {}
        }

        ctx.state_mut(|s| s.status = "capturing_payment".to_string());
        let capture_input = OrderInput {
            authorization_id,
            ..order.clone()
        };
        ctx.execute_activity(
            OrderActivities::capture_payment,
            capture_input,
            activity_options(15),
        )
        .await?;

        ctx.state_mut(|s| s.status = "completed".to_string());
        let notify_input = OrderInput {
            success: Some(true),
            ..order.clone()
        };
        ctx.execute_activity(
            OrderActivities::notify_customer,
            notify_input,
            ActivityOptions::start_to_close_timeout(Duration::from_secs(10)),
        )
        .await?;
        Ok(())
    }

    #[signal]
    pub fn order_ready(&mut self, _ctx: &mut SyncWorkflowContext<Self>) {
        self.order_ready = true;
    }

    #[query]
    pub fn get_status(&self, _ctx: &WorkflowContextView) -> String {
        self.status.clone()
    }
}
