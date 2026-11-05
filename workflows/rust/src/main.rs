mod activities;
mod backend;
mod order_workflow;

use activities::OrderActivities;
use backend::BackendClient;
use order_workflow::OrderWorkflow;
use temporalio_client::{
    Client, ClientOptions, Connection, envconfig::LoadClientConfigProfileOptions,
};
use temporalio_sdk::{Runtime, Worker, WorkerOptions};

const DEFAULT_TASK_QUEUE: &str = "dejavu-tacos";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let task_queue = env_or("TEMPORAL_TASK_QUEUE", DEFAULT_TASK_QUEUE);
    let backend_url = env_or("DEJAVU_BACKEND_URL", "http://localhost:8000");

    // Environment only: a developer's default CLI profile may point at a real
    // Cloud namespace.
    let runtime = Runtime::from_current_tokio(Default::default())?;
    let (mut conn_opts, client_opts) = ClientOptions::load_from_config(
        LoadClientConfigProfileOptions::builder()
            .disable_file(true)
            .build(),
    )?;
    // On by default, this balances across every address a hostname resolves to
    // and doesn't fall back. Docker's host-gateway entry for host.docker.internal
    // includes an IPv6 address that can be unreachable, which fails the connection.
    conn_opts.dns_load_balancing = None;
    let connection = Connection::connect(conn_opts).await?;
    let client = Client::new(connection, client_opts)?;

    let worker_options = WorkerOptions::new(task_queue.as_str())
        .register_workflow::<OrderWorkflow>()?
        .register_activities(OrderActivities::new(BackendClient::new(&backend_url)?))
        .build();

    let mut worker = Worker::new(&runtime, client, worker_options)?;
    println!("Rust worker started, listening on task queue: {task_queue}");
    println!("Backend URL: {backend_url}");
    worker.run().await?;
    Ok(())
}

fn env_or(name: &str, default: &str) -> String {
    std::env::var(name)
        .ok()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| default.to_string())
}
