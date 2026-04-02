module Cats
  module Warehouse
    class WorkflowEventSerializer < ApplicationSerializer
      attributes :id, :entity_type, :entity_id, :event_type, :from_status, :to_status,
                 :actor_id, :actor_name, :payload, :occurred_at, :created_at, :updated_at

      def actor_name
        a = object.actor
        return unless a

        [a.first_name, a.last_name].compact.join(" ").presence || a.email
      end
    end
  end
end
