module Cats
  module Warehouse
    class NotificationJob < ApplicationJob
      queue_as :default

      def perform(event, payload = {})
        payload_hash = payload.respond_to?(:deep_symbolize_keys) ? payload.deep_symbolize_keys : payload.to_h.deep_symbolize_keys
        NotificationDelivery.new(event: event, payload: payload_hash).call
      end
    end
  end
end
