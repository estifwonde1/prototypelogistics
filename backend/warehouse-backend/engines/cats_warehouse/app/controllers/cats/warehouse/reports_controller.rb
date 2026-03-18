module Cats
  module Warehouse
    class ReportsController < BaseController
      def bin_card
        authorize StackTransaction, :index?, policy_class: StackTransactionPolicy

        scope = scoped_transactions
        if params[:store_id].present?
          store_stack_ids = Stack.where(store_id: params[:store_id]).pluck(:id)
          scope = scope.where(source_id: store_stack_ids).or(scope.where(destination_id: store_stack_ids))
        end
        scope = scope.where(source_id: params[:stack_id]) if params[:stack_id].present?
        scope = scope.where(transaction_date: date_range) if date_range

        render_resource(scope.order(transaction_date: :desc, id: :desc), each_serializer: StackTransactionSerializer)
      end

      private

      def date_range
        return nil if params[:from].blank? && params[:to].blank?

        from_date = params[:from].present? ? Date.parse(params[:from]) : nil
        to_date = params[:to].present? ? Date.parse(params[:to]) : nil

        if from_date && to_date
          from_date..to_date
        elsif from_date
          from_date..Date.today
        elsif to_date
          Date.new(1900, 1, 1)..to_date
        end
      rescue ArgumentError
        nil
      end

      def scoped_transactions
        return StackTransaction.all if current_user&.has_role?("Admin") || current_user&.has_role?("Superadmin")

        if current_user&.has_role?("Hub Manager")
          hub_ids = UserAssignment.where(user_id: current_user.id, role_name: "Hub Manager").pluck(:hub_id).compact
          warehouse_ids = Warehouse.where(hub_id: hub_ids).pluck(:id)
          store_ids = Store.where(warehouse_id: warehouse_ids).pluck(:id)
          stack_ids = Stack.where(store_id: store_ids).pluck(:id)
          return StackTransaction.where(source_id: stack_ids).or(StackTransaction.where(destination_id: stack_ids))
        end

        if current_user&.has_role?("Warehouse Manager")
          warehouse_ids = UserAssignment.where(user_id: current_user.id, role_name: "Warehouse Manager").pluck(:warehouse_id).compact
          store_ids = Store.where(warehouse_id: warehouse_ids).pluck(:id)
          stack_ids = Stack.where(store_id: store_ids).pluck(:id)
          return StackTransaction.where(source_id: stack_ids).or(StackTransaction.where(destination_id: stack_ids))
        end

        if current_user&.has_role?("Storekeeper")
          store_ids = UserAssignment.where(user_id: current_user.id, role_name: "Storekeeper").pluck(:store_id).compact
          stack_ids = Stack.where(store_id: store_ids).pluck(:id)
          return StackTransaction.where(source_id: stack_ids).or(StackTransaction.where(destination_id: stack_ids))
        end

        StackTransaction.none
      end
    end
  end
end
