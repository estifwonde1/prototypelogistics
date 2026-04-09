module Cats
  module Warehouse
    class Inspection < ApplicationRecord
      self.table_name = "cats_warehouse_inspections"
      include DocumentLifecycle

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :inspector, class_name: "Cats::Core::User"
      belongs_to :source, polymorphic: true, optional: true
      belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder", optional: true
      belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder", optional: true
      belongs_to :auto_generated_grn, class_name: "Cats::Warehouse::Grn", optional: true
      belongs_to :auto_generated_gin, class_name: "Cats::Warehouse::Gin", optional: true

      has_many :inspection_items, class_name: "Cats::Warehouse::InspectionItem", dependent: :destroy

      validates :inspected_on, presence: true
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
