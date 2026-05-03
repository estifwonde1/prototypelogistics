module Cats
  module Warehouse
    class ReceiptAuthorizationsController < BaseController
      def index
        authorize ReceiptAuthorization
        ras = policy_scope(ReceiptAuthorization)
              .includes(:receipt_order, :store, :warehouse, :transporter,
                        :created_by, :driver_confirmed_by, :inspection, :grn)
              .order(created_at: :desc)

        # Optional filters
        ras = ras.where(receipt_order_id: params[:receipt_order_id]) if params[:receipt_order_id].present?
        ras = ras.where(warehouse_id: params[:warehouse_id])         if params[:warehouse_id].present?
        ras = ras.where(store_id: params[:store_id])                 if params[:store_id].present?
        ras = ras.where(status: params[:status])                     if params[:status].present?

        render_resource(ras, each_serializer: ReceiptAuthorizationSerializer)
      end

      def show
        ra = policy_scope(ReceiptAuthorization)
             .includes(:receipt_order, :store, :warehouse, :transporter,
                       :created_by, :driver_confirmed_by, :inspection, :grn)
             .find(params[:id])
        authorize ra
        render_resource(ra, serializer: ReceiptAuthorizationSerializer)
      end

      def create
        authorize ReceiptAuthorization
        payload = ra_params

        receipt_order = policy_scope(ReceiptOrder).find(payload[:receipt_order_id])
        store         = Store.find(payload[:store_id])
        transporter   = Cats::Core::Transporter.find(payload[:transporter_id])

        assignment = nil
        if payload[:receipt_order_assignment_id].present?
          assignment = receipt_order.receipt_order_assignments.find(payload[:receipt_order_assignment_id])
        end

        ra = ReceiptAuthorizationService.new(
          receipt_order:            receipt_order,
          actor:                    current_user,
          store:                    store,
          authorized_quantity:      payload[:authorized_quantity],
          driver_name:              payload[:driver_name],
          driver_id_number:         payload[:driver_id_number],
          truck_plate_number:       payload[:truck_plate_number],
          transporter:              transporter,
          waybill_number:           payload[:waybill_number],
          receipt_order_assignment: assignment
        ).call

        render_resource(ra, serializer: ReceiptAuthorizationSerializer, status: :created)
      end

      def update
        ra = policy_scope(ReceiptAuthorization).find(params[:id])
        authorize ra

        payload = ra_update_params

        if payload[:transporter_id].present?
          transporter = Cats::Core::Transporter.find(payload[:transporter_id])
          ra.transporter = transporter
        end

        ra.assign_attributes(payload.except(:transporter_id))
        ra.save!

        render_resource(ra, serializer: ReceiptAuthorizationSerializer)
      end

      def cancel
        ra = policy_scope(ReceiptAuthorization).find(params[:id])
        authorize ra, :cancel?

        ReceiptAuthorizationService.cancel!(receipt_authorization: ra, actor: current_user)
        render_resource(ra.reload, serializer: ReceiptAuthorizationSerializer)
      end

      def driver_confirm
        ra = policy_scope(ReceiptAuthorization).find(params[:id])
        authorize ra, :driver_confirm?

        DriverConfirmService.new(receipt_authorization: ra, actor: current_user).call
        render_resource(ra.reload, serializer: ReceiptAuthorizationSerializer)
      end

      private

      def ra_params
        params.require(:payload).permit(
          :receipt_order_id,
          :receipt_order_assignment_id,
          :store_id,
          :transporter_id,
          :authorized_quantity,
          :driver_name,
          :driver_id_number,
          :truck_plate_number,
          :waybill_number
        )
      end

      def ra_update_params
        params.require(:payload).permit(
          :transporter_id,
          :authorized_quantity,
          :driver_name,
          :driver_id_number,
          :truck_plate_number,
          :waybill_number
        )
      end
    end
  end
end
