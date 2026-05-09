module Cats
  module Warehouse
    # In-app notifications are written synchronously (local DB only) so they work without
    # background workers or external webhooks. Optional webhook delivery stays async behind
    # ENABLE_WAREHOUSE_JOBS + NotificationJob.
    class NotificationFanout
      class << self
        def deliver(event, payload = {})
          hash = normalize_payload(payload)
          InAppNotifications::Creator.call(event.to_s, hash) if InAppNotifications::Creator.enabled?
          return unless ENV["ENABLE_WAREHOUSE_JOBS"] == "true"

          NotificationJob.perform_later(event.to_s, hash)
        end

        private

        def normalize_payload(payload)
          if payload.respond_to?(:deep_symbolize_keys)
            payload.deep_symbolize_keys
          else
            payload.to_h.deep_symbolize_keys
          end
        end
      end
    end
  end
end
