module Cats
  module Warehouse
    class BaseController < ApplicationController
      private

      def render_success(data = {}, status: :ok)
        render json: { success: true, data: data }, status: status
      end

      def render_error(message, status: :unprocessable_entity, details: nil)
        payload = { success: false, error: { message: message } }
        payload[:error][:details] = details if details
        render json: payload, status: status
      end
    end
  end
end
