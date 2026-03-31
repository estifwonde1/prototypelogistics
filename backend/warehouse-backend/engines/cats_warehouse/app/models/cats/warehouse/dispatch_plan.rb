module Cats
  module Warehouse
    class DispatchPlan < ApplicationRecord
      self.table_name = "cats_core_dispatch_plans"

      belongs_to :prepared_by, class_name: "Cats::Core::User"
      belongs_to :approved_by, class_name: "Cats::Core::User", optional: true

      has_many :dispatch_plan_items,
               class_name: "Cats::Warehouse::DispatchPlanItem",
               foreign_key: :dispatch_plan_id,
               inverse_of: :dispatch_plan,
               dependent: :destroy

      validates :status, presence: true
      validates :prepared_by, presence: true
    end
  end
end
