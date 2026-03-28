module Cats
  module Warehouse
    class WarehouseContactsController < BaseController
      def show
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
        authorize warehouse
        render_resource(warehouse.warehouse_contacts, serializer: WarehouseContactsSerializer)
      end

      def create
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
        authorize warehouse
        contacts = WarehouseContacts.create!(warehouse: warehouse, **contacts_params)
        render_resource(contacts, status: :created, serializer: WarehouseContactsSerializer)
      end

      def update
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
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
    end
  end
end
