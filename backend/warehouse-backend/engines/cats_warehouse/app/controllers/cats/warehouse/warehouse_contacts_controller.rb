module Cats
  module Warehouse
    class WarehouseContactsController < BaseController
      def show
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        render_resource(warehouse.warehouse_contacts, serializer: WarehouseContactsSerializer)
      end

      def create
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        contacts = WarehouseContacts.create!(warehouse: warehouse, **contacts_params)
        render_resource(contacts, status: :created, serializer: WarehouseContactsSerializer)
      end

      def update
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        contacts = warehouse.warehouse_contacts || WarehouseContacts.new(warehouse: warehouse)
        contacts.update!(contacts_params)
        render_resource(contacts, serializer: WarehouseContactsSerializer)
      end

      private

      def contacts_params
        params.require(:payload).permit(
          :manager_name,
          :contact_phone,
          :contact_email
        )
      end

      def scoped_warehouses
        return Warehouse.all if current_user&.has_role?("Admin") || current_user&.has_role?("Superadmin")

        if current_user&.has_role?("Hub Manager")
          hub_ids = UserAssignment.where(user_id: current_user.id, role_name: "Hub Manager").pluck(:hub_id).compact
          return Warehouse.where(hub_id: hub_ids)
        end

        if current_user&.has_role?("Warehouse Manager")
          warehouse_ids = UserAssignment.where(user_id: current_user.id, role_name: "Warehouse Manager").pluck(:warehouse_id).compact
          return Warehouse.where(id: warehouse_ids)
        end

        Warehouse.none
      end
    end
  end
end
