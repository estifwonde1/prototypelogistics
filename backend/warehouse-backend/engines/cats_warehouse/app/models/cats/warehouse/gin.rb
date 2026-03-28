module Cats
  module Warehouse
    class Gin < ApplicationRecord
      self.table_name = "cats_warehouse_gins"
      include DocumentLifecycle

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :destination, polymorphic: true, optional: true
      belongs_to :issued_by, class_name: "Cats::Core::User"
      belongs_to :approved_by, class_name: "Cats::Core::User", optional: true

      has_many :gin_items, class_name: "Cats::Warehouse::GinItem", dependent: :destroy

      validates :issued_on, presence: true
      validate :destination_matches_warehouse, if: -> { destination.present? }

      private

      def destination_matches_warehouse
        return unless destination.respond_to?(:warehouse_id)
        return if destination.warehouse_id == warehouse_id

        errors.add(:destination, "must belong to the same warehouse")
      end
    end
  end
end
