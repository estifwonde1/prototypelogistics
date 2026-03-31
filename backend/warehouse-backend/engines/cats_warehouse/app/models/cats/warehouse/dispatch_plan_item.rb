module Cats
  module Warehouse
    class DispatchPlanItem < ApplicationRecord
      self.table_name = "cats_core_dispatch_plan_items"

      STATUS_UNAUTHORIZED = "Unauthorized".freeze
      STATUS_SOURCE_AUTHORIZED = "Source Authorized".freeze
      STATUS_DESTINATION_AUTHORIZED = "Destination Authorized".freeze
      STATUS_DISPATCHABLE = "Dispatchable".freeze
      STATUS_VALUES = [
        STATUS_UNAUTHORIZED,
        STATUS_SOURCE_AUTHORIZED,
        STATUS_DESTINATION_AUTHORIZED,
        STATUS_DISPATCHABLE
      ].freeze

      belongs_to :dispatch_plan,
                 class_name: "Cats::Warehouse::DispatchPlan",
                 inverse_of: :dispatch_plan_items
      belongs_to :source, class_name: "Cats::Core::Location"
      belongs_to :destination, class_name: "Cats::Core::Location"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"

      has_many :hub_authorizations,
               class_name: "Cats::Warehouse::HubAuthorization",
               foreign_key: :dispatch_plan_item_id,
               inverse_of: :dispatch_plan_item,
               dependent: :destroy

      validates :reference_no, :quantity, :status, presence: true
      validates :status, inclusion: { in: STATUS_VALUES }
    end
  end
end
