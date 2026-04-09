module Cats
  module Warehouse
    class StorekeeperAssignmentsController < BaseController
      skip_after_action :verify_authorized

      def index
        assignments = ReceiptOrderAssignment
          .where(assigned_to_id: current_user.id)
          .or(ReceiptOrderAssignment.where(store_id: current_store_ids))
          .includes(:receipt_order, :store, :warehouse, :hub, :assigned_to, :assigned_by)
          .order(created_at: :desc)

        render_success(
          assignments: ActiveModelSerializers::SerializableResource.new(
            assignments,
            each_serializer: StorekeeperAssignmentSerializer
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
        UserAssignment.where(user_id: current_user.id, role_name: "Storekeeper").pluck(:store_id)
      end
    end
  end
end
