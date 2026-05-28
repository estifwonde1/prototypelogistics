# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderCreatorForOfficer
      def initialize(actor:, dispatch_reference: nil, description: nil, lines: [], dispatch_plan_id: nil, dispatch_plan_item_id: nil)
        @actor = actor
        # dispatch_reference is system-assigned (DO-{id}); ignore any client-supplied value.
        @description = description
        @lines = lines
        @dispatch_plan_id = dispatch_plan_id
        @dispatch_plan_item_id = dispatch_plan_item_id
        @location_attrs = LocationTagger.call(user: actor)
        @access = AccessContext.new(user: actor)
      end

      def call
        DispatchOrder.transaction do
          order = DispatchOrder.create!(
            description: @description,
            created_by: @actor,
            status: ContractConstants::DOCUMENT_STATUSES[:draft],
            location_id: @location_attrs[:location_id],
            officer_location_id: @location_attrs[:location_id],
            hierarchical_level: @location_attrs[:hierarchical_level],
            officer_level: normalize_officer_level(@location_attrs[:hierarchical_level]),
            jurisdiction_metadata: jurisdiction_snapshot,
            dispatch_plan_id: @dispatch_plan_id,
            dispatch_plan_item_id: @dispatch_plan_item_id
          )

          Array(@lines).each { |line_attrs| create_line!(order, line_attrs) }

          order.reload

          DispatchOrderJurisdictionGuard.call(order, @actor)
          DispatchOrderStockGuard.call(order)

          assign_dispatch_reference!(order)

          WorkflowEventRecorder.record!(
            entity: order,
            event_type: "dispatch_order.created",
            actor: @actor,
            from_status: nil,
            to_status: order.status,
            payload: { dispatch_reference: order.dispatch_reference, reference_no: order.reference_no }
          )

          order
        end
      end

      private

      def normalize_officer_level(level)
        level.to_s.downcase.presence || "federal"
      end

      def jurisdiction_snapshot
        {
          scope_location_ids: @access.officer_location_scope_ids,
          officer_level: normalize_officer_level(@location_attrs[:hierarchical_level]),
          captured_at: Time.current.iso8601
        }
      end

      def assign_dispatch_reference!(order)
        ref = "DO-#{order.id}"
        order.update_columns(reference_no: ref, dispatch_reference: ref) # rubocop:disable Rails/SkipsModelValidations
      end

      def create_line!(order, attrs)
        commodity_id = CommodityDefinitionStockResolver.resolve_line_commodity_id(attrs)

        line = order.dispatch_order_lines.create!(
          commodity_id: commodity_id,
          quantity: attrs[:quantity],
          unit_id: attrs[:unit_id],
          packaging_unit_id: attrs[:packaging_unit_id],
          packaging_size: attrs[:packaging_size],
          remarks: attrs[:remarks] || attrs[:notes]
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
