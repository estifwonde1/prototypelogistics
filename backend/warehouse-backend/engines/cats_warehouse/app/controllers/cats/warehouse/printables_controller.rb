# frozen_string_literal: true

module Cats
  module Warehouse
    class PrintablesController < BaseController
      include OfficerDispatchV2Feature

      skip_after_action :verify_authorized

      def waybill
        ensure_officer_dispatch_v2_enabled!
        wb = Waybill.find(params[:waybill_id] || params[:id])
        authorize wb, :show?, policy_class: WaybillPolicy

        render_success(WaybillPrintableService.call(waybill: wb))
      end

      def gin
        ensure_officer_dispatch_v2_enabled!
        gin = Gin.find(params[:gin_id] || params[:id])
        authorize gin, :show?

        render_success(GinPrintableService.call(gin: gin))
      end

      private

      def officer_dispatch_v2_required?
        false
      end
    end
  end
end
