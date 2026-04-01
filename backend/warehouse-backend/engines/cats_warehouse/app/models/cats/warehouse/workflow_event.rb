module Cats
  module Warehouse
    class WorkflowEvent < ApplicationRecord
      self.table_name = "cats_warehouse_workflow_events"

      belongs_to :entity, polymorphic: true
      belongs_to :actor, class_name: "Cats::Core::User", optional: true

      validates :event_type, presence: true
      validates :occurred_at, presence: true
    end
  end
end
