module Cats
  module Warehouse
    class StorekeeperAssignmentsController < BaseController
      skip_after_action :verify_authorized

      def index
        current_ids = current_store_ids

        receipt_assignments = ReceiptOrderAssignment
          .where(assigned_to_id: current_user.id)
          .or(ReceiptOrderAssignment.where(store_id: current_ids))
          .includes(:receipt_order, :store, :warehouse, :hub, :assigned_to, :assigned_by)
          .order(created_at: :desc)

        dispatch_assignments = DispatchOrderAssignment
          .where(assigned_to_id: current_user.id)
          .or(DispatchOrderAssignment.where(store_id: current_ids))
          .includes(:dispatch_order, :store, :warehouse, :hub, :assigned_to, :assigned_by)
          .order(created_at: :desc)

        activity = WorkflowEvent
          .where(actor_id: current_user.id)
          .limit(10)
          .order(occurred_at: :desc)

        render_success(
          receipt_assignments: ActiveModelSerializers::SerializableResource.new(
            receipt_assignments,
            each_serializer: StorekeeperAssignmentSerializer
          ).as_json,
          dispatch_assignments: ActiveModelSerializers::SerializableResource.new(
            dispatch_assignments,
            each_serializer: DispatchOrderAssignmentSerializer
          ).as_json,
          activity: ActiveModelSerializers::SerializableResource.new(
            activity,
            each_serializer: WorkflowEventSerializer
          ).as_json
        )
      end

      def accept
        assignment = find_assignment

        assignment.update!(status: "accepted")

        render_success(
          assignment: StorekeeperAssignmentSerializer.new(assignment).as_json
        )
      end

      private

      def find_assignment
        ReceiptOrderAssignment
          .where(assigned_to_id: current_user.id)
          .or(ReceiptOrderAssignment.where(store_id: current_store_ids))
          .find(params[:id])
      end

      def current_store_ids
        access = AccessContext.new(user: current_user)
        access.assigned_store_ids
      end
    end
  end
end
