require "net/http"
require "uri"

module Cats
  module Warehouse
    class NotificationDelivery
      def initialize(event:, payload:)
        @event = event
        @payload = payload
      end

      def call
        return log_skip unless webhook_url.present?

        uri = URI.parse(webhook_url)
        request = Net::HTTP::Post.new(uri)
        request["Content-Type"] = "application/json"
        request["Authorization"] = "Bearer #{webhook_token}" if webhook_token.present?
        request.body = { event: event, payload: payload }.to_json

        response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
          http.request(request)
        end

        return if response.is_a?(Net::HTTPSuccess)

        raise "Notification delivery failed with status #{response.code}"
      end

      private

      attr_reader :event, :payload

      def webhook_url
        ENV["WAREHOUSE_NOTIFICATION_WEBHOOK_URL"]
      end

      def webhook_token
        ENV["WAREHOUSE_NOTIFICATION_WEBHOOK_TOKEN"]
      end

      def log_skip
        Rails.logger.warn({ event: event, payload: payload, message: "Notification webhook not configured" }.to_json)
      end
    end
  end
end
