# frozen_string_literal: true

require 'json'
require 'net/http'
require 'time'
require 'uri'

module Dejavu
  # Talks to the FastAPI backend's internal API for failure state, SSE events
  # and store order registration.
  class BackendClient
    TIMEOUT_SECONDS = 5

    def initialize(base_url)
      @base_url = base_url.chomp('/')
    end

    # Sending the order ID lets the backend answer for the browser session that
    # placed the order, so one presenter's outage doesn't hit another.
    def should_fail?(step, order_id)
      uri = URI("#{@base_url}/api/internal/should-fail/#{step}")
      uri.query = URI.encode_www_form(order_id:)
      response = request(uri, Net::HTTP::Get.new(uri))
      JSON.parse(response.body).fetch('should_fail', false)
    rescue StandardError
      false
    end

    # Best effort: a missed UI update shouldn't fail the Activity.
    def emit_event(order_id, step, status, attempt: 1, max_attempts: 1, error: nil, detail: '')
      post('/api/internal/events', {
             order_id:, step:, status:, attempt:, max_attempts:, error:, detail:,
             timestamp: Time.now.iso8601, mode: 'temporal'
           })
    end

    # Best effort, like emit_event: the Kitchen Display is a view of the order.
    def register_store_order(order_id, order)
      post("/api/internal/store-orders/#{order_id}", order)
    end

    private

    def post(path, body)
      uri = URI("#{@base_url}#{path}")
      http_request = Net::HTTP::Post.new(uri, 'Content-Type' => 'application/json')
      http_request.body = JSON.generate(body)
      request(uri, http_request)
    rescue StandardError
      nil
    end

    def request(uri, http_request)
      Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https',
                                          open_timeout: TIMEOUT_SECONDS,
                                          read_timeout: TIMEOUT_SECONDS) do |http|
        http.request(http_request)
      end
    end
  end
end
