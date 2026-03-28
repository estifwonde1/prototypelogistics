module Cats
  module Warehouse
    class StoresController < BaseController
      def index
        authorize Store
        render_resource(policy_scope(Store).order(:id), each_serializer: StoreSerializer)
      end

      def show
        store = policy_scope(Store).find(params[:id])
        authorize store
        render_resource(store, serializer: StoreSerializer)
      end

      def create
        authorize Store
        store = build_store_for_create
        store.save!
        render_resource(store, status: :created, serializer: StoreSerializer)
      end

      def update
        store = policy_scope(Store).find(params[:id])
        authorize store
        store.assign_attributes(store_params.except(:warehouse_id))
        if store_params[:warehouse_id].present?
          store.warehouse = policy_scope(Warehouse).find(store_params[:warehouse_id])
        end
        store.save!
        render_resource(store, serializer: StoreSerializer)
      end

      def destroy
        store = policy_scope(Store).find(params[:id])
        authorize store
        store.destroy!
        render_success({ id: store.id })
      end

      private

      def build_store_for_create
        warehouse = policy_scope(Warehouse).find(store_params[:warehouse_id])
        Store.new(store_params.except(:warehouse_id).merge(warehouse: warehouse))
      end

      def store_params
        params.require(:payload).permit(
          :code,
          :name,
          :length,
          :width,
          :height,
          :temporary,
          :has_gangway,
          :gangway_length,
          :gangway_width,
          :gangway_corner_dist,
          :warehouse_id
        )
      end
    end
  end
end
