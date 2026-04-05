module Cats
  module Warehouse
    class BaseController < ApplicationController
      before_action :authenticate_user!
      after_action :verify_authorized
      rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
      rescue_from ActiveRecord::RecordInvalid, with: :render_record_invalid
      rescue_from ActionController::ParameterMissing, with: :render_bad_request
      rescue_from ArgumentError, with: :render_invalid_argument
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

      def render_invalid_argument(error)
        render_error(error.message, status: :unprocessable_entity)
      end

      def render_record_invalid(error)
        render_error(error.record.errors.full_messages.to_sentence, status: :unprocessable_entity, details: error.record.errors.to_hash)
      end

      def render_forbidden(error)
        message = error.respond_to?(:message) ? error.message : "Not authorized"
        render_error(message, status: :forbidden)
      end

      def normalize_payload_aliases(payload, aliases = {})
        normalized = payload.to_unsafe_h.deep_dup

        aliases.each do |canonical_key, legacy_keys|
          canonical_name = canonical_key.to_s
          next if normalized.key?(canonical_name)

          legacy_name = Array(legacy_keys).map(&:to_s).find { |candidate| normalized.key?(candidate) }
          normalized[canonical_name] = normalized.delete(legacy_name) if legacy_name.present?
        end

        ActionController::Parameters.new(normalized)
      end

      def authenticate_user!
        return if current_user.present?

        render_error("Unauthorized", status: :unauthorized)
      end

      def current_user
        @current_user ||= begin
          bearer = request.headers["Authorization"]&.split(" ")&.last
          return Cats::Core::User.find_signed(bearer, purpose: "auth") if bearer.present?
          return nil unless Rails.env.development? || Rails.env.test?

          user_id = request.headers["X-User-Id"] || params[:current_user_id]
          Cats::Core::User.find_by(id: user_id)
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
        access_context.assigned_hub_ids
      end

      def assigned_warehouse_ids
        access_context.assigned_warehouse_ids
      end

      def assigned_store_ids
        access_context.assigned_store_ids
      end

      def warehouses_for_hubs(hub_ids)
        Cats::Warehouse::Warehouse.where(hub_id: hub_ids).pluck(:id)
      end

      def stores_for_warehouses(warehouse_ids)
        Cats::Warehouse::Store.where(warehouse_id: warehouse_ids).pluck(:id)
      end

      def accessible_document_warehouse_scope
        return Cats::Warehouse::Warehouse.all if admin_user?

        Cats::Warehouse::Warehouse.where(id: access_context.accessible_warehouse_ids)
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

      def access_context
        @access_context ||= AccessContext.new(user: current_user)
      end

      def warehouse_module
        WarehouseModule.record
      end
    end
  end
end
