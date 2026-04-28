module Cats
  module Warehouse
    class StacksController < BaseController
      def index
        authorize Stack
        scope = policy_scope(Stack).order(:id)
        scope = scope.where(store_id: params[:store_id]) if params[:store_id].present?
        render_resource(scope, each_serializer: StackSerializer)
      end

      def show
        stack = policy_scope(Stack).find(params[:id])
        authorize stack
        render_resource(stack, serializer: StackSerializer)
      end

      def create
        authorize Stack
        stack = Stack.create!(stack_params)
        render_resource(stack, status: :created, serializer: StackSerializer)
      end

      def update
        stack = policy_scope(Stack).find(params[:id])
        authorize stack
        stack.update!(stack_params)
        render_resource(stack, serializer: StackSerializer)
      end

      def destroy
        stack = policy_scope(Stack).find(params[:id])
        authorize stack
        stack.destroy!
        render_success({ id: stack.id })
      end

      def transfer
        source_stack = policy_scope(Stack).find(params[:id])
        authorize source_stack, :transfer?

        destination_stack = Stack.find(params[:destination_id])
        quantity = params[:quantity].to_f

        # Verify destination stack is in the same store
        unless destination_stack.store_id == source_stack.store_id
          return render_error("Destination stack must be in the same store", status: :unprocessable_entity)
        end

        # Verify user has access to destination stack
        unless policy_scope(Stack).exists?(id: destination_stack.id)
          return render_error("You don't have access to the destination stack", status: :forbidden)
        end

        service = StackTransferService.new(
          source_stack: source_stack,
          destination_stack: destination_stack,
          quantity: quantity,
          user: current_user
        )

        transaction = service.call

        render_success(
          message: "Stack transfer completed successfully",
          transaction: {
            id: transaction.id,
            source_stack_id: source_stack.id,
            destination_stack_id: destination_stack.id,
            quantity: quantity,
            unit_id: source_stack.unit_id
          }
        )
      rescue ArgumentError => e
        render_error(e.message, status: :unprocessable_entity)
      rescue StandardError => e
        render_error("Transfer failed: #{e.message}", status: :unprocessable_entity)
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
