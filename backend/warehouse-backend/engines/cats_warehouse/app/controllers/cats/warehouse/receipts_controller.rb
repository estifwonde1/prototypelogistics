module Cats
  module Warehouse
    class ReceiptsController < BaseController
      def index
        authorize :receipt, :index?, policy_class: ReceiptPolicy
        render_resource(scoped_receipts.order(created_at: :desc), each_serializer: ReceiptSerializer)
      end

      def show
        receipt = scoped_receipts.find(params[:id])
        authorize :receipt, :show?, policy_class: ReceiptPolicy
        render_resource(receipt, serializer: ReceiptSerializer)
      end

      private

      def scoped_receipts
        return Cats::Core::Receipt.all if admin_user?

        store_ids = store_ids_for_current_user
        return Cats::Core::Receipt.none if store_ids.blank?

        Cats::Core::Receipt
          .joins("INNER JOIN cats_core_receipt_authorizations ra ON ra.id = cats_core_receipts.receipt_authorization_id")
          .where("ra.store_id IN (?)", store_ids)
      end
    end
  end
end
