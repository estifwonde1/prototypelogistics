module Cats
  module Warehouse
    class Grn < ApplicationRecord
      self.table_name = "cats_warehouse_grns"
      include DocumentLifecycle

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :source, polymorphic: true, optional: true
      belongs_to :received_by, class_name: "Cats::Core::User"
      belongs_to :approved_by, class_name: "Cats::Core::User", optional: true
      belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder", optional: true
      belongs_to :receipt_authorization, class_name: "Cats::Warehouse::ReceiptAuthorization", optional: true
      belongs_to :generated_from_inspection, class_name: "Cats::Warehouse::Inspection", optional: true

      has_many :grn_items, class_name: "Cats::Warehouse::GrnItem", dependent: :destroy

      validates :received_on, presence: true
      validate :source_matches_warehouse, if: -> { source.present? }

      private

      def source_matches_warehouse
        return unless source.respond_to?(:warehouse_id)
        return if source.warehouse_id == warehouse_id

        errors.add(:source, "must belong to the same warehouse")
      end
    end
  end
end
