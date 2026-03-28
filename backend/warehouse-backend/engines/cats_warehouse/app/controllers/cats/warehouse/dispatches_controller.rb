module Cats
  module Warehouse
    class DispatchesController < BaseController
      def index
        authorize :dispatch, :index?, policy_class: DispatchPolicy
        render_resource(policy_scope(Cats::Core::Dispatch, policy_scope_class: DispatchPolicy::Scope).order(created_at: :desc), each_serializer: DispatchSerializer)
      end

      def show
        dispatch = policy_scope(Cats::Core::Dispatch, policy_scope_class: DispatchPolicy::Scope).find(params[:id])
        authorize :dispatch, :show?, policy_class: DispatchPolicy
        render_resource(dispatch, serializer: DispatchSerializer)
      end
    end
  end
end
