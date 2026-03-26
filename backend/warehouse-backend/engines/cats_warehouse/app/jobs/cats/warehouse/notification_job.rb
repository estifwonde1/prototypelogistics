module Cats
  module Warehouse
    class NotificationJob < ApplicationJob
      queue_as :default

      def perform(event, payload = {})
        NotificationDelivery.new(event: event, payload: payload).call
      end
    end
  end
end
