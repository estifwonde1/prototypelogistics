module Cats
  module Warehouse
    class DispatchDriverConfirmService
      def initialize(dispatch_order_authorization:, actor:, picked_items:)
        @dao = dispatch_order_authorization
        @actor = actor
        @picked_items = picked_items
      end

      def call
        validate!

        DispatchOrderAuthorization.transaction do
          gin = GinCreator.new(
            warehouse: @dao.warehouse,
            issued_on: Date.current,
            issued_by: @actor,
            items: @picked_items,
            destination: @dao.dispatch_order&.destination,
            reference_no: generate_reference_no,
            status: "draft",
            transporter_id: @dao.transporter_id,
            truck_plate_number: @dao.truck_plate_number,
            driver_name: @dao.driver_name,
            driver_id_number: @dao.driver_id_number,
            dispatch_order_authorization_id: @dao.id
          ).call

          # Update the DAO with driver details
          @dao.update!(
            driver_confirmed_at: Time.current,
            driver_confirmed_by: @actor
          )

          # Auto confirm the GIN on driver sign, mimicking GRN DriverConfirmService
          GinDriverConfirmService.new(gin: gin, actor: @actor).call

          WorkflowEventRecorder.record!(
            entity: @dao.dispatch_order,
            event_type: "dispatch_authorization.driver_confirmed",
            actor: @actor,
            from_status: @dao.dispatch_order&.status,
            to_status: @dao.dispatch_order&.status,
            payload: { dispatch_order_authorization_id: @dao.id, gin_id: gin.id, gin_reference_no: gin.reference_no }
          )

          @dao.reload
        end
      end

      private

      def validate!
        raise ArgumentError, "Dispatch Authorization is not active" unless @dao.active?
        raise ArgumentError, "Dispatch Authorization already driver confirmed" if @dao.driver_confirmed_at.present?
        raise ArgumentError, "Picked items must be provided" if @picked_items.blank?
      end

      def generate_reference_no
        "GIN-DAO#{@dao.id}-#{Time.current.strftime('%Y%m%d%H%M%S')}"
      end
    end
  end
end
