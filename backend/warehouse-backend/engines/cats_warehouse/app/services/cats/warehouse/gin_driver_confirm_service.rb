module Cats
  module Warehouse
    class GinDriverConfirmService
      def initialize(gin:, actor:)
        @gin = gin
        @actor = actor
      end

      def call
        validate!

        Gin.transaction do
          old_status = @gin.status

          @gin.update!(
            driver_confirmed_at: Time.current,
            driver_confirmed_by_id: @actor.id
          )

          WorkflowEventRecorder.record!(
            entity:      @gin,
            event_type:  "gin.driver_confirmed",
            actor:       @actor,
            from_status: old_status,
            to_status:   @gin.status,
            payload:     {
              driver_confirmed_at: @gin.driver_confirmed_at
            }
          )

          # Auto-confirm if this GIN is tied to a Dispatch Authorization and is currently draft
          if @gin.dispatch_order_authorization_id.present? && @gin.draft?
            GinConfirmer.new(gin: @gin, approved_by: @actor).call
          end

          enqueue_notification("gin.driver_confirmed", gin_id: @gin.id)

          @gin
        end
      end

      private

      def validate!
        raise ArgumentError, "GIN is already driver confirmed" if @gin.driver_confirmed_at.present?
      end

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end
    end
  end
end
