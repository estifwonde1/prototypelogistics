module Cats
  module Warehouse
    class ReceiptsController < BaseController
      def index
        authorize :receipt, :index?, policy_class: ReceiptPolicy
        render_resource(policy_scope(Cats::Core::Receipt, policy_scope_class: ReceiptPolicy::Scope).order(created_at: :desc), each_serializer: ReceiptSerializer)
      end

      def show
        receipt = policy_scope(Cats::Core::Receipt, policy_scope_class: ReceiptPolicy::Scope).find(params[:id])
        authorize :receipt, :show?, policy_class: ReceiptPolicy
        render_resource(receipt, serializer: ReceiptSerializer)
      end
    end
  end
end
