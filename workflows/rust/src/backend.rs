use std::time::Duration;

use serde::Serialize;
use serde_json::Value;

/// Talks to the FastAPI backend's internal API for failure state, SSE events
/// and store order registration.
pub struct BackendClient {
    base_url: String,
    http: reqwest::Client,
}

/// Matches the backend's OrderEvent model.
#[derive(Serialize)]
pub struct OrderEvent {
    pub order_id: String,
    pub step: String,
    pub status: String,
    pub attempt: u32,
    pub max_attempts: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub detail: String,
    pub timestamp: String,
    pub mode: String,
}

impl OrderEvent {
    pub fn new(order_id: &str, step: &str, status: &str) -> Self {
        Self {
            order_id: order_id.to_string(),
            step: step.to_string(),
            status: status.to_string(),
            attempt: 1,
            max_attempts: 1,
            error: None,
            detail: String::new(),
            timestamp: chrono::Local::now().to_rfc3339(),
            mode: "temporal".to_string(),
        }
    }

    pub fn detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = detail.into();
        self
    }

    pub fn error(mut self, error: impl Into<String>) -> Self {
        self.error = Some(error.into());
        self
    }

    pub fn attempt(mut self, attempt: u32, max_attempts: u32) -> Self {
        self.attempt = attempt;
        self.max_attempts = max_attempts;
        self
    }
}

impl BackendClient {
    pub fn new(base_url: &str) -> reqwest::Result<Self> {
        Ok(Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()?,
        })
    }

    /// Sending the order ID lets the backend answer for the browser session
    /// that placed the order, so one presenter's outage doesn't hit another.
    pub async fn should_fail(&self, step: &str, order_id: &str) -> bool {
        let url = format!("{}/api/internal/should-fail/{step}", self.base_url);
        let response = self
            .http
            .get(url)
            .query(&[("order_id", order_id)])
            .send()
            .await;
        match response {
            Ok(response) => response
                .json::<Value>()
                .await
                .ok()
                .and_then(|body| body["should_fail"].as_bool())
                .unwrap_or(false),
            Err(_) => false,
        }
    }

    /// Best effort: a missed UI update shouldn't fail the Activity.
    pub async fn emit_event(&self, event: OrderEvent) {
        let url = format!("{}/api/internal/events", self.base_url);
        let _ = self.http.post(url).json(&event).send().await;
    }

    /// Best effort, like emit_event: the Kitchen Display is a view of the order.
    pub async fn register_store_order(&self, order_id: &str, order: Value) {
        let url = format!("{}/api/internal/store-orders/{order_id}", self.base_url);
        let _ = self.http.post(url).json(&order).send().await;
    }
}
