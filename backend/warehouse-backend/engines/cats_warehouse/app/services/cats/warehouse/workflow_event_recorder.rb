module Cats
  module Warehouse
    class WorkflowEventRecorder
      def self.record!(entity:, event_type:, actor: nil, from_status: nil, to_status: nil, payload: nil)
        WorkflowEvent.create!(
          entity: entity,
          event_type: event_type,
          actor: actor,
          from_status: from_status,
          to_status: to_status,
          payload: payload,
          occurred_at: Time.current
        )
      end
    end
  end
end
