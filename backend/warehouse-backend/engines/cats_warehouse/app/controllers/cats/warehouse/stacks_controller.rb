module Cats
  module Warehouse
    class StacksController < BaseController
      def index
        authorize Stack
        render_resource(scoped_stacks.order(:id), each_serializer: StackSerializer)
      end

      def show
        stack = scoped_stacks.find(params[:id])
        authorize stack
        render_resource(stack, serializer: StackSerializer)
      end

      def create
        authorize Stack
        stack = Stack.create!(stack_params)
        render_resource(stack, status: :created, serializer: StackSerializer)
      end

      def update
        stack = scoped_stacks.find(params[:id])
        authorize stack
        stack.update!(stack_params)
        render_resource(stack, serializer: StackSerializer)
      end

      def destroy
        stack = scoped_stacks.find(params[:id])
        authorize stack
        stack.destroy!
        render_success({ id: stack.id })
      end

      private

      def stack_params
        params.require(:payload).permit(
          :code,
          :length,
          :width,
          :height,
          :start_x,
          :start_y,
          :commodity_id,
          :store_id,
          :commodity_status,
          :stack_status,
          :quantity,
          :unit_id
        )
      end

      def scoped_stacks
        return Stack.all if admin_user?

        if hub_manager?
          hub_warehouse_ids = warehouses_for_hubs(assigned_hub_ids)
          store_ids = stores_for_warehouses(hub_warehouse_ids)
          stack_ids = stacks_for_stores(store_ids)
          return Stack.where(id: stack_ids)
        end

        if warehouse_manager?
          store_ids = stores_for_warehouses(assigned_warehouse_ids)
          stack_ids = stacks_for_stores(store_ids)
          return Stack.where(id: stack_ids)
        end

        if storekeeper?
          stack_ids = stacks_for_stores(assigned_store_ids)
          return Stack.where(id: stack_ids)
        end

        Stack.none
      end
    end
  end
end
