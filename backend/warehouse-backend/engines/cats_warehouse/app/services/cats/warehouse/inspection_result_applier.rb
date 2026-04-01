module Cats
  module Warehouse
    class InspectionResultApplier
      def initialize(inspection:, actor:)
        @inspection = inspection
        @actor = actor
      end

      def call
        if @inspection.receipt_order_id.present?
          GrnGeneratorFromInspection.new(inspection: @inspection, actor: @actor).call
        end

        @inspection.update!(result_status: "Processed")
      end
    end
  end
end
