module Cats
  module Warehouse
    class HubAuthorization < ApplicationRecord
      self.table_name = "cats_core_hub_authorizations"

      AUTHORIZATION_SOURCE = "Source".freeze
      AUTHORIZATION_DESTINATION = "Destination".freeze
      AUTHORIZATION_TYPES = [
        AUTHORIZATION_SOURCE,
        AUTHORIZATION_DESTINATION
      ].freeze

      belongs_to :dispatch_plan_item,
                 class_name: "Cats::Warehouse::DispatchPlanItem",
                 optional: true,
                 inverse_of: :hub_authorizations
      belongs_to :store, class_name: "Cats::Core::Store"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :authorized_by, class_name: "Cats::Core::User"

      validates :quantity, presence: true
      validates :authorization_type, presence: true, inclusion: { in: AUTHORIZATION_TYPES }
    end
  end
end
