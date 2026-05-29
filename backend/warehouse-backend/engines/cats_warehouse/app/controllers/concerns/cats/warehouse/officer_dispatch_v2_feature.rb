# frozen_string_literal: true

module Cats
  module Warehouse
    module OfficerDispatchV2Feature
      extend ActiveSupport::Concern

      class V2Disabled < StandardError
        def initialize
          super("Officer dispatch v2 is not enabled")
        end
      end

      module_function

      def enabled?
        ENV["ENABLE_OFFICER_DISPATCH_V2"].to_s != "false"
      end

      included do
        before_action :ensure_officer_dispatch_v2_enabled!, if: :officer_dispatch_v2_required?
      end

      private

      def officer_dispatch_v2_required?
        false
      end

      def ensure_officer_dispatch_v2_enabled!
        return if OfficerDispatchV2Feature.enabled?

        render json: {
          success: false,
          error: { code: "FEATURE_DISABLED", message: "Officer dispatch v2 is not enabled" }
        }, status: :not_found
        nil
      end
    end
  end
end
