module Cats
  module Warehouse
    class StoresController < BaseController
      def index
        stores = Store.order(:id)
        render_success({ stores: stores })
      end

      def show
        store = Store.find_by(id: params[:id])
        return render_error("Store not found", status: :not_found) unless store

        render_success({ store: store })
      end

      def create
        store = Store.new(store_params)

        if store.save
          render_success({ id: store.id }, status: :created)
        else
          render_error("Failed to create store", details: store.errors.full_messages)
        end
      end

      def update
        store = Store.find_by(id: params[:id])
        return render_error("Store not found", status: :not_found) unless store

        if store.update(store_params)
          render_success({ id: store.id })
        else
          render_error("Failed to update store", details: store.errors.full_messages)
        end
      end

      def destroy
        store = Store.find_by(id: params[:id])
        return render_error("Store not found", status: :not_found) unless store

        if store.destroy
          render_success({ id: store.id })
        else
          render_error("Failed to delete store", details: store.errors.full_messages)
        end
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
    end
  end
end
