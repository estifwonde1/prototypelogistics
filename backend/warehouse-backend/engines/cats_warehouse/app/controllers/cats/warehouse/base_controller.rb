module Cats
  module Warehouse
    class BaseController < ApplicationController
      before_action :authenticate_user!
      after_action :verify_authorized
      rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
      rescue_from ActiveRecord::RecordInvalid, with: :render_record_invalid
      rescue_from ActionController::ParameterMissing, with: :render_bad_request
      rescue_from Pundit::NotAuthorizedError, with: :render_forbidden

      private

      def render_success(data = nil, status: :ok, **kwargs)
        payload = data || {}
        payload = payload.merge(kwargs) if kwargs.any?
        render json: { success: true, data: payload }, status: status
      end

      def render_error(message, status: :unprocessable_entity, details: nil)
        payload = { success: false, error: { message: message } }
        payload[:error][:details] = details if details
        render json: payload, status: status
      end

      def render_resource(resource, status: :ok, serializer: nil, each_serializer: nil)
        payload = ActiveModelSerializers::SerializableResource.new(
          resource,
          serializer: serializer,
          each_serializer: each_serializer
        ).as_json
        render_success(payload, status: status)
      end

      def render_not_found(error)
        render_error(error.message, status: :not_found)
      end

      def render_bad_request(error)
        render_error(error.message, status: :bad_request)
      end

      def render_record_invalid(error)
        render_error(error.record.errors.full_messages.to_sentence, status: :unprocessable_entity, details: error.record.errors.to_hash)
      end

      def render_forbidden(_error)
        render_error("Not authorized", status: :forbidden)
      end

      def authenticate_user!
        return if current_user.present?

        render_error("Unauthorized", status: :unauthorized)
      end

      def current_user
        @current_user ||= begin
          bearer = request.headers["Authorization"]&.split(" ")&.last
          if bearer.present?
            Cats::Core::User.find_signed(bearer, purpose: "auth")
          else
            user_id = request.headers["X-User-Id"] || params[:current_user_id]
            Cats::Core::User.find_by(id: user_id)
          end
        end
      end

      def admin_user?
        current_user&.has_role?("Admin") || current_user&.has_role?("Superadmin")
      end

      def hub_manager?
        current_user&.has_role?("Hub Manager")
      end

      def warehouse_manager?
        current_user&.has_role?("Warehouse Manager")
      end

      def storekeeper?
        current_user&.has_role?("Storekeeper")
      end

      def assigned_hub_ids
        Cats::Warehouse::UserAssignment.where(user_id: current_user.id, role_name: "Hub Manager").pluck(:hub_id).compact
      end

      def assigned_warehouse_ids
        Cats::Warehouse::UserAssignment.where(user_id: current_user.id, role_name: "Warehouse Manager").pluck(:warehouse_id).compact
      end

      def assigned_store_ids
        Cats::Warehouse::UserAssignment.where(user_id: current_user.id, role_name: "Storekeeper").pluck(:store_id).compact
      end

      def warehouses_for_hubs(hub_ids)
        Cats::Warehouse::Warehouse.where(hub_id: hub_ids).pluck(:id)
      end

      def stores_for_warehouses(warehouse_ids)
        Cats::Warehouse::Store.where(warehouse_id: warehouse_ids).pluck(:id)
      end

      def stacks_for_stores(store_ids)
        Cats::Warehouse::Stack.where(store_id: store_ids).pluck(:id)
      end

      def store_ids_for_current_user
        return nil if admin_user?

        if hub_manager?
          hub_warehouse_ids = warehouses_for_hubs(assigned_hub_ids)
          return stores_for_warehouses(hub_warehouse_ids)
        end

        if warehouse_manager?
          return stores_for_warehouses(assigned_warehouse_ids)
        end

        if storekeeper?
          return assigned_store_ids
        end

        []
      end
    end
  end
end
