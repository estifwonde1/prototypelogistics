# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderUpdater
      def initialize(order:, actor:, attributes:, lines: nil)
        @order = order
        @actor = actor
        @attributes = attributes
        @lines = lines
      end

      def call
        raise ArgumentError, "Only draft dispatch orders can be updated" unless @order.status_draft?

        DispatchOrder.transaction do
          @order.assign_attributes(@attributes)
          @order.save!

          replace_lines! if @lines

          DispatchOrderJurisdictionGuard.call(@order, @actor) if @order.v2_dispatch?

          @order
        end
      end

      private

      def replace_lines!
        @order.dispatch_order_lines.destroy_all

        Array(@lines).each do |attrs|
          line = @order.dispatch_order_lines.create!(
            commodity_id: attrs[:commodity_id],
            quantity: attrs[:quantity],
            unit_id: attrs[:unit_id],
            packaging_unit_id: attrs[:packaging_unit_id],
            packaging_size: attrs[:packaging_size],
            remarks: attrs[:remarks]
          )

          Array(attrs[:source_allocations]).each do |src|
            line.source_allocations.create!(
              warehouse_id: src[:warehouse_id],
              quantity: src[:quantity],
              unit_id: src[:unit_id] || attrs[:unit_id]
            )
          end

          Array(attrs[:destination_allocations]).each do |dest|
            line.destination_allocations.create!(
              destination_location_id: dest[:destination_location_id],
              quantity: dest[:quantity],
              unit_id: dest[:unit_id] || attrs[:unit_id]
            )
          end
        end
      end
    end
  end
end
