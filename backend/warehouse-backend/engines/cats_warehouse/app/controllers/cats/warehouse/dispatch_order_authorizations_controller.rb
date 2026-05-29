# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationsController < BaseController
      include OfficerDispatchV2Feature

      before_action :ensure_officer_dispatch_v2_enabled!
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
          if store_ids.blank?
            scope = scope.none
          else
            assigned_auth_ids = DispatchOrderAuthorizationStore
              .where(store_id: store_ids)
              .distinct
              .pluck(:dispatch_order_authorization_id)
            warehouse_ids = Store.where(id: store_ids).distinct.pluck(:warehouse_id)
            open_auth_ids = if warehouse_ids.empty?
                              []
                            else
                              DispatchOrderAuthorization
                                .left_outer_joins(:dispatch_order_authorization_stores)
                                .where(warehouse_id: warehouse_ids)
                                .where(cats_warehouse_dispatch_order_authorization_stores: { id: nil })
                                .distinct
                                .pluck(:id)
                            end
            scope = scope.where(id: (assigned_auth_ids + open_auth_ids).uniq)
          end
        end

        render_resource(scope, each_serializer: DispatchOrderAuthorizationSerializer)
      end

      def show
        auth = policy_scope(DispatchOrderAuthorization)
                 .includes(:warehouse, :transporter, :dispatch_order,
                           :dispatch_order_authorization_stores,
                           :dispatch_order_authorization_executions,
                           waybill: :waybill_transport)
                 .find(params[:id])
        authorize auth
        render_resource(auth, serializer: DispatchOrderAuthorizationSerializer)
      end

      def create
        authorize DispatchOrderAuthorization
        payload = auth_params

        order = policy_scope(DispatchOrder).find(payload[:dispatch_order_id])
        warehouse = Warehouse.find(payload[:warehouse_id])
        transporter = resolve_transporter(payload)
        input_unit = payload[:authorized_quantity_input_unit_id].present? ? Cats::Core::UnitOfMeasure.find(payload[:authorized_quantity_input_unit_id]) : nil

        auth = DispatchOrderAuthorizationService.new(
          dispatch_order: order,
          actor: current_user,
          warehouse: warehouse,
          authorized_quantity: payload[:authorized_quantity],
          commodity_id: payload[:commodity_id],
          transporter: transporter,
          driver_name: payload[:driver_name],
          driver_id_number: payload[:driver_id_number],
          truck_plate_number: payload[:truck_plate_number],
          driver_phone: payload[:driver_phone],
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

      def store_splits
        auth = policy_scope(DispatchOrderAuthorization).find(params[:id])
        authorize auth, :store_splits?

        if auth.dispatch_order_authorization_executions.exists?
          raise ArgumentError, "Store splits cannot be changed after execution has started"
        end

        splits = split_params.fetch(:store_splits, [])
        raise ArgumentError, "At least one store split is required" if splits.empty?

        DispatchOrderAuthorization.transaction do
          auth.dispatch_order_authorization_stores.destroy_all

          splits.each do |split|
            auth.dispatch_order_authorization_stores.create!(
              store_id: split[:store_id],
              commodity_id: split[:commodity_id],
              authorized_quantity: split[:authorized_quantity],
              base_quantity: split[:base_quantity].presence || split[:authorized_quantity],
              remaining_quantity: split[:authorized_quantity],
              dispatched_quantity: 0
            )
          end

          total = auth.dispatch_order_authorization_stores.sum(:authorized_quantity).to_f
          unless (total - auth.authorized_quantity.to_f).abs <= 0.001
            raise ArgumentError, "Store splits must sum to authorized quantity"
          end

          auth.update!(remaining_quantity: auth.authorized_quantity)
        end

        render_resource(auth.reload, serializer: DispatchOrderAuthorizationSerializer)
      end

      def driver_confirm
        auth = policy_scope(DispatchOrderAuthorization).find(params[:id])
        authorize auth, :driver_confirm?

        driver_phone = params.dig(:payload, :driver_phone)
        gin = DispatchAuthorizationDriverConfirmService.new(
          authorization: auth,
          actor: current_user,
          driver_phone: driver_phone
        ).call
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

      def list_executions
        auth = policy_scope(DispatchOrderAuthorization).find(params[:id])
        authorize auth, :show?

        scope = auth.dispatch_order_authorization_executions.order(created_at: :asc)
        scope = scope.where(status: params[:status]) if params[:status].present?

        render_resource(scope, each_serializer: DispatchOrderAuthorizationExecutionSerializer)
      end

      def confirm_execution
        auth = policy_scope(DispatchOrderAuthorization).find(params[:id])
        authorize auth, :create_execution?

        execution = auth.dispatch_order_authorization_executions.find(params[:execution_id])
        DispatchOrderAuthorizationExecutionConfirmer.new(execution: execution, actor: current_user).call

        render_resource(execution.reload, serializer: DispatchOrderAuthorizationExecutionSerializer)
      end

      private

      def auth_params
        params.require(:payload).permit(
          :dispatch_order_id,
          :warehouse_id,
          :authorized_quantity,
          :authorized_quantity_input_unit_id,
          :commodity_id,
          :transporter_name,
          :transporter_id,
          :driver_name,
          :driver_id_number,
          :truck_plate_number,
          :driver_phone,
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

      def split_params
        params.require(:payload).permit(
          store_splits: [:store_id, :commodity_id, :authorized_quantity, :base_quantity]
        )
      end

      def resolve_transporter(payload)
        if payload[:transporter_id].present?
          return Cats::Core::Transporter.find(payload[:transporter_id])
        end

        name = payload[:transporter_name].to_s.strip
        return nil if name.blank?

        normalized = name.downcase
        existing = Cats::Core::Transporter.where("LOWER(TRIM(name)) = ?", normalized).first
        return existing if existing

        Cats::Core::Transporter.create!(
          name: name,
          code: unique_ad_hoc_transporter_code,
          address: "Not provided",
          contact_phone: "Not provided"
        )
      rescue ActiveRecord::RecordInvalid => e
        raise ArgumentError, e.record.errors.full_messages.to_sentence
      end

      def unique_ad_hoc_transporter_code
        loop do
          candidate = "DOA-T-#{SecureRandom.hex(4).upcase}"
          break candidate unless Cats::Core::Transporter.exists?(code: candidate)
        end
      end
    end
  end
end
