module Cats
  module Warehouse
    class StoresController < BaseController
      def index
        authorize Store
        render_resource(scoped_stores.order(:id), each_serializer: StoreSerializer)
      end

      def show
        store = scoped_stores.find(params[:id])
        authorize store
        render_resource(store, serializer: StoreSerializer)
      end

      def create
        authorize Store
        store = Store.create!(store_params)
        render_resource(store, status: :created, serializer: StoreSerializer)
      end

      def update
        store = scoped_stores.find(params[:id])
        authorize store
        store.update!(store_params)
        render_resource(store, serializer: StoreSerializer)
      end

      def destroy
        store = scoped_stores.find(params[:id])
        authorize store
        store.destroy!
        render_success({ id: store.id })
      end

      private

      def store_params
        params.require(:payload).permit(
          :code,
          :name,
          :length,
          :width,
          :height,
          :usable_space,
          :available_space,
          :temporary,
          :has_gangway,
          :gangway_length,
          :gangway_width,
          :gangway_corner_dist,
          :warehouse_id
        )
      end

      def scoped_stores
        return Store.all if admin_user?

        if hub_manager?
          hub_warehouse_ids = warehouses_for_hubs(assigned_hub_ids)
          store_ids = stores_for_warehouses(hub_warehouse_ids)
          return Store.where(id: store_ids)
        end

        if warehouse_manager?
          store_ids = stores_for_warehouses(assigned_warehouse_ids)
          return Store.where(id: store_ids)
        end

        if storekeeper?
          return Store.where(id: assigned_store_ids)
        end

        Store.none
      end
    end
  end
end
