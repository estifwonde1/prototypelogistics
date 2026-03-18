module Cats
  module Warehouse
    class InspectionsController < BaseController
      def index
        authorize Inspection
        render_resource(scoped_inspections.includes(:inspection_items).order(created_at: :desc), each_serializer: InspectionSerializer)
      end

      def show
        inspection = scoped_inspections.includes(:inspection_items).find(params[:id])
        authorize inspection
        render_resource(inspection, serializer: InspectionSerializer)
      end

      def create
        payload = inspection_params

        authorize Inspection
        warehouse = scoped_warehouses_for_ops.find(payload[:warehouse_id])
        inspection = InspectionCreator.new(
          warehouse: warehouse,
          inspected_on: payload[:inspected_on],
          inspector: Cats::Core::User.find(payload[:inspector_id]),
          items: payload[:items],
          source: resolve_source(payload[:source_type], payload[:source_id]),
          reference_no: payload[:reference_no],
          status: payload[:status] || "Draft"
        ).call

        render_resource(inspection, status: :created, serializer: InspectionSerializer)
      end

      def confirm
        inspection = scoped_inspections.find(params[:id])
        authorize inspection, :confirm?
        InspectionConfirmer.new(inspection: inspection).call
        render_resource(inspection, serializer: InspectionSerializer)
      end

      private

      def inspection_params
        params.require(:payload).permit(
          :warehouse_id,
          :inspected_on,
          :inspector_id,
          :reference_no,
          :status,
          :source_type,
          :source_id,
          items: [
            :commodity_id,
            :quantity_received,
            :quantity_damaged,
            :quantity_lost,
            :quality_status,
            :packaging_condition,
            :remarks
          ]
        )
      end

      def resolve_source(source_type, source_id)
        return nil if source_type.blank? || source_id.blank?

        source_type.constantize.find(source_id)
      end

      def scoped_warehouses_for_ops
        return Warehouse.all if current_user&.has_role?("Admin") || current_user&.has_role?("Superadmin")

        if current_user&.has_role?("Hub Manager")
          hub_ids = Cats::Warehouse::UserAssignment.where(user_id: current_user.id, role_name: "Hub Manager").pluck(:hub_id).compact
          return Warehouse.where(hub_id: hub_ids)
        end

        if current_user&.has_role?("Warehouse Manager")
          warehouse_ids = Cats::Warehouse::UserAssignment.where(user_id: current_user.id, role_name: "Warehouse Manager").pluck(:warehouse_id).compact
          return Warehouse.where(id: warehouse_ids)
        end

        if current_user&.has_role?("Storekeeper")
          store_ids = Cats::Warehouse::UserAssignment.where(user_id: current_user.id, role_name: "Storekeeper").pluck(:store_id).compact
          warehouse_ids = Store.where(id: store_ids).pluck(:warehouse_id)
          return Warehouse.where(id: warehouse_ids)
        end

        Warehouse.none
      end

      def scoped_inspections
        return Inspection.all if current_user&.has_role?("Admin") || current_user&.has_role?("Superadmin")

        if current_user&.has_role?("Hub Manager")
          hub_ids = Cats::Warehouse::UserAssignment.where(user_id: current_user.id, role_name: "Hub Manager").pluck(:hub_id).compact
          warehouse_ids = Warehouse.where(hub_id: hub_ids).pluck(:id)
          return Inspection.where(warehouse_id: warehouse_ids)
        end

        if current_user&.has_role?("Warehouse Manager")
          warehouse_ids = Cats::Warehouse::UserAssignment.where(user_id: current_user.id, role_name: "Warehouse Manager").pluck(:warehouse_id).compact
          return Inspection.where(warehouse_id: warehouse_ids)
        end

        if current_user&.has_role?("Storekeeper")
          store_ids = Cats::Warehouse::UserAssignment.where(user_id: current_user.id, role_name: "Storekeeper").pluck(:store_id).compact
          warehouse_ids = Store.where(id: store_ids).pluck(:warehouse_id)
          return Inspection.where(warehouse_id: warehouse_ids)
        end

        Inspection.none
      end
    end
  end
end
