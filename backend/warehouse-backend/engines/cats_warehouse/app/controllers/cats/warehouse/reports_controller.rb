module Cats
  module Warehouse
    class ReportsController < BaseController
      def bin_card
        authorize StackTransaction, :index?, policy_class: StackTransactionPolicy

        scope = policy_scope(StackTransaction)
        if params[:store_id].present?
          store_stack_ids = Stack.where(store_id: params[:store_id]).pluck(:id)
          scope = scope.where(source_id: store_stack_ids).or(scope.where(destination_id: store_stack_ids))
        end
        if params[:stack_id].present?
          scope = scope.where(source_id: params[:stack_id]).or(scope.where(destination_id: params[:stack_id]))
        end
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

    end
  end
end
