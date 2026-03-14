module Cats
  module Warehouse
    class ApplicationController < ActionController::API
      include Pundit::Authorization

      rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
      rescue_from ActiveRecord::RecordInvalid, with: :render_record_invalid
      rescue_from ActionController::ParameterMissing, with: :render_parameter_missing
      rescue_from Pundit::NotAuthorizedError, with: :render_forbidden
      rescue_from StandardError, with: :render_internal_error

      private

      def render_success(data = {}, status: :ok)
        render json: { success: true, data: data }, status: status
      end

      def render_error(message, status: :unprocessable_entity, details: nil)
        payload = { success: false, error: { message: message } }
        payload[:error][:details] = details if details
        render json: payload, status: status
      end

      def render_not_found(exception)
        render_error(exception.message, status: :not_found)
      end

      def render_record_invalid(exception)
        render_error("Validation failed", details: exception.record.errors.full_messages)
      end

      def render_parameter_missing(exception)
        render_error(exception.message, status: :bad_request)
      end

      def render_forbidden(exception)
        render_error(exception.message, status: :forbidden)
      end

      def render_internal_error(exception)
        log_exception(exception)

        raise exception if Rails.env.development? || Rails.env.test?

        render_error("Internal server error", status: :internal_server_error)
      end

      def log_exception(exception)
        Rails.logger.error(
          error_class: exception.class.name,
          error_message: exception.message,
          backtrace: Array(exception.backtrace).first(10)
        )
      end
    end
  end
end
