module Cats
  module Warehouse
    class NotificationJob < ApplicationJob
      queue_as :default

      def perform(event, payload = {})
        Rails.logger.info({ event: event, payload: payload }.to_json)
      end
    end
  end
end
