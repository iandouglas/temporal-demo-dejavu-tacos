use std::{sync::Arc, time::Duration};

use serde_json::{Value, json};
use temporalio_macros::activities;
use temporalio_sdk::activities::{ActivityContext, ActivityError};
use tokio::time::sleep;

use crate::{
    backend::{BackendClient, OrderEvent},
    order_workflow::OrderInput,
};

const DEFAULT_MAX_ATTEMPTS: u32 = 3;
const SUBMIT_MAX_ATTEMPTS: u32 = 10;

pub struct OrderActivities {
    backend: BackendClient,
}

impl OrderActivities {
    pub fn new(backend: BackendClient) -> Self {
        Self { backend }
    }

    async fn fail_attempt(
        &self,
        ctx: &ActivityContext,
        order: &OrderInput,
        step: &str,
        max_attempts: u32,
        message: &str,
    ) -> ActivityError {
        self.backend
            .emit_event(
                OrderEvent::new(&order.order_id, step, "retrying")
                    .attempt(ctx.info().attempt, max_attempts)
                    .error(message),
            )
            .await;
        anyhow::anyhow!(message.to_string()).into()
    }
}

#[activities]
impl OrderActivities {
    #[activity]
    pub async fn validate_order(
        self: Arc<Self>,
        ctx: ActivityContext,
        order: OrderInput,
    ) -> Result<Value, ActivityError> {
        let step = "validate_order";
        self.backend
            .emit_event(OrderEvent::new(&order.order_id, step, "running"))
            .await;
        sleep(Duration::from_millis(200)).await;

        if self.backend.should_fail(step, &order.order_id).await {
            let message = "Order validation failed";
            return Err(self
                .fail_attempt(&ctx, &order, step, DEFAULT_MAX_ATTEMPTS, message)
                .await);
        }

        let total: f64 = order
            .items
            .iter()
            .map(|item| {
                item["price"].as_f64().unwrap_or(0.0) * item["quantity"].as_f64().unwrap_or(0.0)
            })
            .sum();
        let item_count = order.items.len();
        self.backend
            .emit_event(
                OrderEvent::new(&order.order_id, step, "completed")
                    .detail(format!("Validated {item_count} items, total ${total:.2}")),
            )
            .await;
        Ok(json!({ "valid": true, "item_count": item_count, "total": total }))
    }

    #[activity]
    pub async fn validate_store(
        self: Arc<Self>,
        ctx: ActivityContext,
        order: OrderInput,
    ) -> Result<Value, ActivityError> {
        let step = "validate_store";
        self.backend
            .emit_event(OrderEvent::new(&order.order_id, step, "running"))
            .await;
        sleep(Duration::from_millis(300)).await;

        if self.backend.should_fail(step, &order.order_id).await {
            let message = "Unable to reach store";
            return Err(self
                .fail_attempt(&ctx, &order, step, DEFAULT_MAX_ATTEMPTS, message)
                .await);
        }

        self.backend
            .emit_event(
                OrderEvent::new(&order.order_id, step, "completed")
                    .detail("Déjà Vu Tacos #42 is open, ~12 min wait"),
            )
            .await;
        Ok(json!({
            "store_id": "store-001",
            "name": "Déjà Vu Tacos #42",
            "estimated_wait_minutes": 12,
        }))
    }

    #[activity]
    pub async fn authorize_payment(
        self: Arc<Self>,
        ctx: ActivityContext,
        order: OrderInput,
    ) -> Result<Value, ActivityError> {
        let step = "authorize_payment";
        self.backend
            .emit_event(OrderEvent::new(&order.order_id, step, "running"))
            .await;
        sleep(Duration::from_millis(500)).await;

        if self.backend.should_fail(step, &order.order_id).await {
            let message = "Payment gateway timeout";
            return Err(self
                .fail_attempt(&ctx, &order, step, DEFAULT_MAX_ATTEMPTS, message)
                .await);
        }

        let authorization_id = format!(
            "auth_{}",
            chrono::Local::now().timestamp_millis() % 100_000_000
        );
        self.backend
            .emit_event(
                OrderEvent::new(&order.order_id, step, "completed").detail(format!(
                    "Hold placed: ${:.2} (auth: {authorization_id})",
                    order.total
                )),
            )
            .await;
        Ok(json!({
            "authorization_id": authorization_id,
            "amount": order.total,
            "status": "authorized",
        }))
    }

    #[activity]
    pub async fn clear_cart(
        self: Arc<Self>,
        _ctx: ActivityContext,
        order: OrderInput,
    ) -> Result<Value, ActivityError> {
        let step = "clear_cart";
        self.backend
            .emit_event(OrderEvent::new(&order.order_id, step, "running"))
            .await;
        sleep(Duration::from_millis(100)).await;
        self.backend
            .emit_event(OrderEvent::new(&order.order_id, step, "completed").detail("Cart cleared"))
            .await;
        Ok(json!({ "cleared": true }))
    }

    #[activity]
    pub async fn submit_to_store(
        self: Arc<Self>,
        ctx: ActivityContext,
        order: OrderInput,
    ) -> Result<Value, ActivityError> {
        let step = "submit_to_store";
        let attempt = ctx.info().attempt;
        self.backend
            .emit_event(
                OrderEvent::new(&order.order_id, step, "running")
                    .attempt(attempt, SUBMIT_MAX_ATTEMPTS),
            )
            .await;
        sleep(Duration::from_millis(500)).await;

        if self.backend.should_fail(step, &order.order_id).await {
            let message = "Store connectivity lost — Bob accidentally unplugged the ethernet";
            return Err(self
                .fail_attempt(&ctx, &order, step, SUBMIT_MAX_ATTEMPTS, message)
                .await);
        }

        self.backend
            .register_store_order(
                &order.order_id,
                json!({
                    "order_id": order.order_id,
                    "items": order.items,
                    "total": order.total,
                    "status": "preparing",
                    "created_at": chrono::Local::now().to_rfc3339(),
                }),
            )
            .await;
        self.backend
            .emit_event(
                OrderEvent::new(&order.order_id, step, "completed")
                    .attempt(attempt, SUBMIT_MAX_ATTEMPTS)
                    .detail("Store accepted, ready in ~12 min"),
            )
            .await;
        Ok(json!({ "accepted": true, "estimated_ready_minutes": 12 }))
    }

    #[activity]
    pub async fn capture_payment(
        self: Arc<Self>,
        _ctx: ActivityContext,
        order: OrderInput,
    ) -> Result<Value, ActivityError> {
        let step = "capture_payment";
        self.backend
            .emit_event(OrderEvent::new(&order.order_id, step, "running"))
            .await;
        sleep(Duration::from_millis(300)).await;
        self.backend
            .emit_event(
                OrderEvent::new(&order.order_id, step, "completed")
                    .detail(format!("Payment captured: ${:.2}", order.total)),
            )
            .await;
        Ok(json!({
            "authorization_id": order.authorization_id,
            "amount": order.total,
            "status": "captured",
        }))
    }

    /// Compensation. The Workflow registers it before the hold is placed, so
    /// it has to cope with a hold that doesn't exist.
    #[activity]
    pub async fn release_payment_hold(
        self: Arc<Self>,
        _ctx: ActivityContext,
        order: OrderInput,
    ) -> Result<Value, ActivityError> {
        let Some(authorization_id) = order.authorization_id.clone() else {
            return Ok(json!({ "status": "no_hold" }));
        };

        let step = "release_payment_hold";
        self.backend
            .emit_event(OrderEvent::new(&order.order_id, step, "running"))
            .await;
        sleep(Duration::from_millis(300)).await;
        self.backend
            .emit_event(
                OrderEvent::new(&order.order_id, step, "completed").detail(format!(
                    "Payment hold released: ${:.2} (compensation)",
                    order.total
                )),
            )
            .await;
        Ok(json!({ "authorization_id": authorization_id, "status": "released" }))
    }

    #[activity]
    pub async fn notify_customer(
        self: Arc<Self>,
        _ctx: ActivityContext,
        order: OrderInput,
    ) -> Result<Value, ActivityError> {
        sleep(Duration::from_millis(200)).await;
        let success = order.success.unwrap_or(true);
        let (step, detail) = if success {
            (
                "notify_customer_success",
                "Customer notified: Your order is ready for pickup!",
            )
        } else {
            (
                "notify_customer_failure",
                "Customer notified: Sorry, we couldn't process your order. \
                 Your payment hold has been released.",
            )
        };
        self.backend
            .emit_event(OrderEvent::new(&order.order_id, step, "completed").detail(detail))
            .await;
        Ok(json!({ "notified": true, "success": success }))
    }
}
