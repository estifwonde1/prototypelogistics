module Cats
  module Warehouse
    class BaseController < ApplicationController
      before_action :authenticate_user!
      after_action :verify_authorized
      rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
      rescue_from ActionController::ParameterMissing, with: :render_bad_request
      rescue_from Pundit::NotAuthorizedError, with: :render_forbidden

      private

      def render_success(data = {}, status: :ok)
        render json: { success: true, data: data }, status: status
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
    end
  end
end
