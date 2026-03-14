module Cats
  module Warehouse
    class StacksController < BaseController
      def index
        authorize Stack
        render_resource(Stack.order(:id), each_serializer: StackSerializer)
      end

      def show
        stack = Stack.find(params[:id])
        authorize stack
        render_resource(stack, serializer: StackSerializer)
      end

      def create
        authorize Stack
        stack = Stack.create!(stack_params)
        render_resource(stack, status: :created, serializer: StackSerializer)
      end

      def update
        stack = Stack.find(params[:id])
        authorize stack
        stack.update!(stack_params)
        render_resource(stack, serializer: StackSerializer)
      end

      def destroy
        stack = Stack.find(params[:id])
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
    end
  end
end
