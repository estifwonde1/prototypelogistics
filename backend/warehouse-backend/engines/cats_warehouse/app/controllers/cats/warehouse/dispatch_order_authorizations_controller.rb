# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationsController < BaseController
      def index
        authorize DispatchOrderAuthorization
        scope = policy_scope(DispatchOrderAuthorization)
                  .includes(:warehouse, :transporter, :dispatch_order, :dispatch_order_authorization_stores)
                  .order(created_at: :desc)

        scope = scope.where(dispatch_order_id: params[:dispatch_order_id]) if params[:dispatch_order_id].present?
        scope = scope.where(warehouse_id: params[:warehouse_id]) if params[:warehouse_id].present?
        scope = scope.where(status: params[:status]) if params[:status].present?

        if ActiveModel::Type::Boolean.new.cast(params[:storekeeper_scope])
          store_ids = AccessContext.new(user: current_user).assigned_store_ids
          auth_ids = DispatchOrderAuthorizationStore.where(store_id: store_ids).select(:dispatch_order_authorization_id)
          scope = scope.where(id: auth_ids)
        end

        render_resource(scope, each_serializer: DispatchOrderAuthorizationSerializer)
      end

      def show
        auth = policy_scope(DispatchOrderAuthorization).find(params[:id])
        authorize auth
        render_resource(auth, serializer: DispatchOrderAuthorizationSerializer)
      end

      def create
        authorize DispatchOrderAuthorization
        payload = auth_params

        order = policy_scope(DispatchOrder).find(payload[:dispatch_order_id])
        warehouse = Warehouse.find(payload[:warehouse_id])
        transporter = Cats::Core::Transporter.find(payload[:transporter_id])
        input_unit = payload[:authorized_quantity_input_unit_id].present? ? Cats::Core::UnitOfMeasure.find(payload[:authorized_quantity_input_unit_id]) : nil

        auth = DispatchOrderAuthorizationService.new(
          dispatch_order: order,
          actor: current_user,
          warehouse: warehouse,
          authorized_quantity: payload[:authorized_quantity],
          transporter: transporter,
          driver_name: payload[:driver_name],
          driver_id_number: payload[:driver_id_number],
          truck_plate_number: payload[:truck_plate_number],
          authorized_quantity_input_unit: input_unit,
          store_splits: payload[:store_splits] || []
        ).call

        render_resource(auth, status: :created, serializer: DispatchOrderAuthorizationSerializer)
      end

      def confirm
        auth = policy_scope(DispatchOrderAuthorization).find(params[:id])
        authorize auth, :confirm?

        DispatchOrderAuthorizationService.confirm!(authorization: auth, actor: current_user)
        render_resource(auth.reload, serializer: DispatchOrderAuthorizationSerializer)
      end

      def driver_confirm
        auth = policy_scope(DispatchOrderAuthorization).find(params[:id])
        authorize auth, :driver_confirm?

        gin = DispatchAuthorizationDriverConfirmService.new(authorization: auth, actor: current_user).call
        render_success(gin_id: gin.id, dispatch_order_authorization_id: auth.id)
      end

      def executions
        auth = policy_scope(DispatchOrderAuthorization).find(params[:id])
        authorize auth, :create_execution?

        payload = execution_params
        execution = DispatchOrderAuthorizationExecutionService.new(
          authorization: auth,
          actor: current_user,
          authorization_store_id: payload[:dispatch_order_authorization_store_id],
          quantity: payload[:quantity],
          commodity_grade: payload[:commodity_grade],
          inventory_lot_id: payload[:inventory_lot_id],
          shortage_reason: payload[:shortage_reason]
        ).call

        render_resource(execution, status: :created, serializer: DispatchOrderAuthorizationExecutionSerializer)
      end

      private

      def auth_params
        params.require(:payload).permit(
          :dispatch_order_id,
          :warehouse_id,
          :authorized_quantity,
          :authorized_quantity_input_unit_id,
          :transporter_id,
          :driver_name,
          :driver_id_number,
          :truck_plate_number,
          store_splits: [:store_id, :commodity_id, :authorized_quantity, :base_quantity]
        )
      end

      def execution_params
        params.require(:payload).permit(
          :dispatch_order_authorization_store_id,
          :quantity,
          :commodity_grade,
          :inventory_lot_id,
          :shortage_reason
        )
      end
    end
  end
end
