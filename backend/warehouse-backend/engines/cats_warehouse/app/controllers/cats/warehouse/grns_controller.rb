module Cats
  module Warehouse
    class GrnsController < BaseController
      def index
        authorize Grn
        render_resource(policy_scope(Grn).includes(:warehouse, :grn_items).order(created_at: :desc), each_serializer: GrnSerializer)
      end

      def show
        grn = policy_scope(Grn).includes(:warehouse, :grn_items).find(params[:id])
        authorize grn
        render_grn_payload(grn)
      end

      def create
        payload = grn_params

        authorize Grn
        grn = GrnCreator.new(
          warehouse: accessible_document_warehouse_scope.find(payload[:warehouse_id]),
          received_on: payload[:received_on],
          received_by: Cats::Core::User.find(payload[:received_by_id]),
          items: payload[:items],
          source: PolymorphicReferenceResolver.resolve_source(payload[:source_type], payload[:source_id]),
          reference_no: payload[:reference_no],
          status: payload[:status] || "Draft"
        ).call

        render_grn_payload(grn, status: :created)
      end

      def confirm
        grn = policy_scope(Grn).includes(:warehouse).find(params[:id])
        authorize grn, :confirm?
        approved_by = params[:approved_by_id].present? ? Cats::Core::User.find(params[:approved_by_id]) : nil

        GrnConfirmer.new(grn: grn, approved_by: approved_by).call
        grn.reload
        render_grn_payload(grn)
      end

      private

      def render_grn_payload(grn, status: :ok)
        grn = Grn.includes(:warehouse, :grn_items).find(grn.id)
        payload = ActiveModelSerializers::SerializableResource.new(
          grn,
          serializer: GrnSerializer
        ).as_json
        payload = payload.merge(can_confirm: GrnPolicy.new(current_user, grn).confirm?)
        render_success(payload, status: status)
      end

      def grn_params
        payload = normalize_payload_aliases(params.require(:payload), items: :grn_items)

        payload.permit(
          :warehouse_id,
          :received_on,
          :received_by_id,
          :reference_no,
          :status,
          :source_type,
          :source_id,
          items: [
            :commodity_id,
            :quantity,
            :unit_id,
            :inventory_lot_id,
            :lot_code,
            :batch_no,
            :expiry_date,
            :entered_unit_id,
            :base_unit_id,
            :base_quantity,
            :manufactured_on,
            :quality_status,
            :store_id,
            :stack_id
          ]
        )
      end

    end
  end
end
