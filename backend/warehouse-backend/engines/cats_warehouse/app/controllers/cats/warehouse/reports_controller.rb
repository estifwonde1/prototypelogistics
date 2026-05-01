module Cats
  module Warehouse
    class ReportsController < BaseController
      include FilterValidation
      
      def bin_card
        authorize StackTransaction, :index?, policy_class: StackTransactionPolicy

        scope = policy_scope(StackTransaction)
        
        begin
          if params[:store_id].present?
            store_id = validate_id_param(:store_id)
            validate_store_access!(store_id)
            store_stack_ids = Stack.where(store_id: store_id).pluck(:id)
            scope = scope.where(source_id: store_stack_ids).or(scope.where(destination_id: store_stack_ids))
          end
          
          if params[:stack_id].present?
            stack_id = validate_id_param(:stack_id)
            scope = scope.where(source_id: stack_id).or(scope.where(destination_id: stack_id))
          end
          
          date_range = validate_date_range
          scope = scope.where(transaction_date: date_range) if date_range
        rescue ArgumentError => e
          return render_error(e.message, status: :bad_request)
        rescue Pundit::NotAuthorizedError => e
          return render_error(e.message, status: :forbidden)
        end

        render_resource(scope.order(transaction_date: :desc, id: :desc), each_serializer: StackTransactionSerializer)
      end

      private

      # Remove the old date_range method since we're using the one from FilterValidation
    end

    end
  end
end
