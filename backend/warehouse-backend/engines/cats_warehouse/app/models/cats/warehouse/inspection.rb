module Cats
  module Warehouse
    class Inspection < ApplicationRecord
      self.table_name = "cats_warehouse_inspections"
      include DocumentLifecycle

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :inspector, class_name: "Cats::Core::User"
      belongs_to :source, polymorphic: true, optional: true

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
