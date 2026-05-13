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

          if params[:commodity_id].present?
            commodity_id = validate_id_param(:commodity_id)
            lots = InventoryLot.where(commodity_id: commodity_id)
            if params[:batch_no].present?
              batch_no = params[:batch_no].to_s.strip
              raise ArgumentError, "Invalid batch_no" if batch_no.blank?

              lots = lots.where(batch_no: batch_no)
            end
            lot_ids = lots.pluck(:id)
            scope = lot_ids.empty? ? scope.none : scope.where(inventory_lot_id: lot_ids)
          elsif params[:batch_no].present?
            batch_no = params[:batch_no].to_s.strip
            raise ArgumentError, "Invalid batch_no" if batch_no.blank?

            lot_ids = InventoryLot.where(batch_no: batch_no).pluck(:id)
            scope = lot_ids.empty? ? scope.none : scope.where(inventory_lot_id: lot_ids)
          end
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
