module Cats
  module Warehouse
    class ReceiptAuthorizationsController < BaseController
      def index
        authorize ReceiptAuthorization
        ras = policy_scope(ReceiptAuthorization)
              .includes(
                :receipt_order,
                { receipt_order_line: %i[commodity unit packaging_unit] },
                :store, :warehouse, :transporter,
                :created_by, :driver_confirmed_by, :inspections, :grns
              )
              .order(created_at: :desc)

        # Optional filters
        ras = ras.where(receipt_order_id: params[:receipt_order_id]) if params[:receipt_order_id].present?
        ras = ras.where(warehouse_id: params[:warehouse_id])         if params[:warehouse_id].present?
        if params[:store_id].present?
          sid = params[:store_id].to_i
          wh_id = Store.find_by(id: sid)&.warehouse_id
          tbl = ReceiptAuthorization.table_name
          ras =
            if wh_id.present?
              ras.where(
                "#{tbl}.store_id = ? OR (#{tbl}.store_id IS NULL AND #{tbl}.warehouse_id = ?)",
                sid,
                wh_id
              )
            else
              ras.where(store_id: sid)
            end
        end
        ras = ras.where(status: params[:status])                     if params[:status].present?

        render_resource(ras, each_serializer: ReceiptAuthorizationSerializer)
      end

      def show
        ra = policy_scope(ReceiptAuthorization)
             .includes(
               :receipt_order,
               { receipt_order_line: %i[commodity unit packaging_unit] },
               :store, :warehouse, :transporter,
               :created_by, :driver_confirmed_by, :inspections, :grns
             )
             .find(params[:id])
        authorize ra
        render_resource(ra, serializer: ReceiptAuthorizationSerializer)
      end

      def create
        authorize ReceiptAuthorization
        payload = ra_params

        receipt_order = policy_scope(ReceiptOrder).find(payload[:receipt_order_id])
        store =
          if payload[:store_id].present?
            Store.find(payload[:store_id])
          end
        transporter = resolve_transporter_for_payload!(payload)

        assignment = nil
        if payload[:receipt_order_assignment_id].present?
          assignment = receipt_order.receipt_order_assignments.find(payload[:receipt_order_assignment_id])
        end

        explicit_wh = nil
        if payload[:warehouse_id].present?
          explicit_wh = policy_scope(Warehouse).find(payload[:warehouse_id])
        end

        ro_line = nil
        if payload[:receipt_order_line_id].present?
          ro_line = receipt_order.receipt_order_lines.find(payload[:receipt_order_line_id])
        end

        input_unit = nil
        if payload[:authorized_quantity_input_unit_id].present?
          input_unit = Cats::Core::UnitOfMeasure.find(payload[:authorized_quantity_input_unit_id])
        end

        destination_warehouse_id = resolve_ra_destination_warehouse_id(
          receipt_order: receipt_order,
          store: store,
          assignment: assignment,
          explicit_warehouse: explicit_wh
        )
        authorize_warehouse_for_ra_creation!(destination_warehouse_id)

        ra = ReceiptAuthorizationService.new(
          receipt_order:                    receipt_order,
          actor:                            current_user,
          store:                            store,
          authorized_quantity:               payload[:authorized_quantity],
          driver_name:                       payload[:driver_name],
          driver_id_number:                  payload[:driver_id_number],
          truck_plate_number:                payload[:truck_plate_number],
          transporter:                         transporter,
          waybill_number:                    payload[:waybill_number],
          receipt_order_assignment:          assignment,
          explicit_warehouse:                explicit_wh,
          receipt_order_line:                ro_line,
          authorized_quantity_input:         payload[:authorized_quantity_input],
          authorized_quantity_input_unit:    input_unit,
          force_plan_change_notification:    payload[:notify_planned_facilities]
        ).call

        render_resource(ra, serializer: ReceiptAuthorizationSerializer, status: :created)
      end

      def update
        ra = policy_scope(ReceiptAuthorization).find(params[:id])
        authorize ra

        payload = ra_update_params

        if payload[:transporter_id].present? || payload[:transporter_name].present?
          ra.transporter = resolve_transporter_for_payload!(payload)
        end

        attrs = payload.except(:transporter_id, :transporter_name).to_h

        # When the client updates the "as-typed" quantity / unit, recompute the
        # canonical quantity in the receipt-order line unit so allocation math
        # (already in line unit) stays correct end-to-end.
        if payload[:authorized_quantity_input].present? &&
           payload[:authorized_quantity_input_unit_id].present? &&
           !payload.key?(:authorized_quantity)
          line = ra.receipt_order_line || ra.receipt_order&.receipt_order_lines&.first
          if line&.unit_id.present?
            attrs["authorized_quantity"] = UomConversionResolver.convert(
              payload[:authorized_quantity_input].to_f,
              from_unit_id: payload[:authorized_quantity_input_unit_id].to_i,
              to_unit_id:   line.unit_id,
              commodity_id: line.commodity_id
            )
          end
        end

        ra.assign_attributes(attrs)
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

        DriverConfirmService.new(
          receipt_authorization: ra,
          actor: current_user,
          inspection_id: params[:inspection_id].presence
        ).call
        render_resource(ra.reload, serializer: ReceiptAuthorizationSerializer)
      end

      private

      def resolve_ra_destination_warehouse_id(receipt_order:, store:, assignment:, explicit_warehouse:)
        if store.present?
          return store.warehouse_id
        end
        if assignment&.warehouse_id.present?
          return assignment.warehouse_id
        end
        if explicit_warehouse.present?
          return explicit_warehouse.id
        end

        receipt_order.warehouse_id
      end

      def authorize_warehouse_for_ra_creation!(warehouse_id)
        return if warehouse_id.blank?

        policy = ReceiptAuthorizationPolicy.new(current_user, nil)
        return if policy.create_for_warehouse?(warehouse_id)

        raise Pundit::NotAuthorizedError,
              "Only Hub Managers may authorize trucks for hub-backed warehouses"
      end

      # Resolves a Transporter row: prefers +transporter_id+ when sent (legacy/API), otherwise finds or creates by +transporter_name+.
      def resolve_transporter_for_payload!(payload)
        if payload[:transporter_id].present?
          return Cats::Core::Transporter.find(payload[:transporter_id])
        end

        name = payload[:transporter_name].to_s.strip
        raise ArgumentError, "Transporter name is required" if name.blank?

        normalized = name.downcase
        existing = Cats::Core::Transporter.where("LOWER(TRIM(name)) = ?", normalized).first
        return existing if existing

        Cats::Core::Transporter.create!(
          name: name,
          code: unique_ad_hoc_transporter_code,
          address: "Not provided",
          contact_phone: "Not provided"
        )
      rescue ActiveRecord::RecordInvalid => e
        raise ArgumentError, e.record.errors.full_messages.to_sentence
      end

      # Cats::Core::Transporter validates +code+; free-text RA entry has no canonical code — generate one.
      def unique_ad_hoc_transporter_code
        loop do
          candidate = "RA-T-#{SecureRandom.hex(4).upcase}"
          break candidate unless Cats::Core::Transporter.exists?(code: candidate)
        end
      end

      def ra_params
        params.require(:payload).permit(
          :receipt_order_id,
          :receipt_order_assignment_id,
          :receipt_order_line_id,
          :warehouse_id,
          :store_id,
          :transporter_id,
          :transporter_name,
          :authorized_quantity,
          :authorized_quantity_input,
          :authorized_quantity_input_unit_id,
          :driver_name,
          :driver_id_number,
          :truck_plate_number,
          :waybill_number,
          :notify_planned_facilities
        )
      end

      def ra_update_params
        params.require(:payload).permit(
          :transporter_id,
          :transporter_name,
          :authorized_quantity,
          :authorized_quantity_input,
          :authorized_quantity_input_unit_id,
          :driver_name,
          :driver_id_number,
          :truck_plate_number,
          :waybill_number
        )
      end
    end
  end
end
