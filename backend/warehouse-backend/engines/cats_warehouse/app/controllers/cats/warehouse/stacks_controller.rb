module Cats
  module Warehouse
    class StacksController < BaseController
      def index
        stacks = Stack.order(:id)
        render_success({ stacks: stacks })
      end

      def show
        stack = Stack.find_by(id: params[:id])
        return render_error("Stack not found", status: :not_found) unless stack

        render_success({ stack: stack })
      end

      def create
        stack = Stack.new(stack_params)

        if stack.save
          render_success({ id: stack.id }, status: :created)
        else
          render_error("Failed to create stack", details: stack.errors.full_messages)
        end
      end

      def update
        stack = Stack.find_by(id: params[:id])
        return render_error("Stack not found", status: :not_found) unless stack

        if stack.update(stack_params)
          render_success({ id: stack.id })
        else
          render_error("Failed to update stack", details: stack.errors.full_messages)
        end
      end

      def destroy
        stack = Stack.find_by(id: params[:id])
        return render_error("Stack not found", status: :not_found) unless stack

        if stack.destroy
          render_success({ id: stack.id })
        else
          render_error("Failed to delete stack", details: stack.errors.full_messages)
        end
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
