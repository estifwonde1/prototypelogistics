module Cats
  module Warehouse
    class WaybillConfirmer
      def initialize(waybill:)
        @waybill = waybill
      end

      def call
        raise ArgumentError, "Waybill is already confirmed" if @waybill.status == "Confirmed"

        Waybill.transaction do
          @waybill.update!(status: "Confirmed")
          @waybill
        end
      end
    end
  end
end
