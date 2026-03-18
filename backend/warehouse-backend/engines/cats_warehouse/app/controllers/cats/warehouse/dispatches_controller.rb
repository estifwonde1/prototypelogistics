module Cats
  module Warehouse
    class DispatchesController < BaseController
      def index
        authorize :dispatch, :index?, policy_class: DispatchPolicy
        render_resource(scoped_dispatches.order(created_at: :desc), each_serializer: DispatchSerializer)
      end

      def show
        dispatch = scoped_dispatches.find(params[:id])
        authorize :dispatch, :show?, policy_class: DispatchPolicy
        render_resource(dispatch, serializer: DispatchSerializer)
      end

      private

      def scoped_dispatches
        return Cats::Core::Dispatch.all if admin_user?

        store_ids = store_ids_for_current_user
        return Cats::Core::Dispatch.none if store_ids.blank?

        Cats::Core::Dispatch
          .joins("LEFT JOIN cats_core_dispatch_authorizations da ON da.dispatch_id = cats_core_dispatches.id")
          .where("da.store_id IN (?)", store_ids)
          .distinct
      end
    end
  end
end
