module Cats
  module Warehouse
    class WorkflowEventSerializer < ApplicationSerializer
      attributes :id, :entity_type, :entity_id, :event_type, :from_status, :to_status,
                 :actor_id, :payload, :occurred_at, :created_at, :updated_at
    end
  end
end
