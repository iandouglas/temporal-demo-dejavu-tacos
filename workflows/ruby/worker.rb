# frozen_string_literal: true

require 'temporalio/client'
require 'temporalio/env_config'
require 'temporalio/worker'

require_relative 'lib/dejavu/activities'
require_relative 'lib/dejavu/backend_client'
require_relative 'lib/dejavu/order_workflow'

task_queue = ENV.fetch('TEMPORAL_TASK_QUEUE', '').then { |q| q.empty? ? 'dejavu-tacos' : q }
backend_url = ENV.fetch('DEJAVU_BACKEND_URL', 'http://localhost:8000')

# Environment only: a developer's default CLI profile may point at a real Cloud
# namespace.
positional, options = Temporalio::EnvConfig::ClientConfig.load_client_connect_options(disable_file: true)
address, namespace = positional
client = Temporalio::Client.connect(address || 'localhost:7233', namespace || 'default', **options)

worker = Temporalio::Worker.new(
  client:,
  task_queue:,
  workflows: [Dejavu::OrderWorkflow],
  activities: Dejavu::Activities.all(Dejavu::BackendClient.new(backend_url))
)

puts "Ruby worker started, listening on task queue: #{task_queue}"
puts "Backend URL: #{backend_url}"
$stdout.flush

worker.run(shutdown_signals: %w[SIGINT SIGTERM])
