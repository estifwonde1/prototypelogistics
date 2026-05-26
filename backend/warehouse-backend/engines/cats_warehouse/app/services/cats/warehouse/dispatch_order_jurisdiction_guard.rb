# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderJurisdictionGuard
      class JurisdictionViolation < StandardError
        attr_reader :code, :details

        def initialize(message, field: nil)
          @code = "JURISDICTION_VIOLATION"
          @details = field.present? ? [{ field: field, code: "forbidden" }] : []
          super(message)
        end
      end

      def self.call(order, actor)
        new(order: order, actor: actor).call
      end

      def initialize(order:, actor:)
        @order = order
        @access = AccessContext.new(user: actor)
      end

      def call
        return if @access.admin? || @access.officer_full_access?

        scope_ids = @access.officer_location_scope_ids
        raise JurisdictionViolation, "Officer has no jurisdiction scope" if scope_ids.blank? && @access.officer?

        warehouse_ids = accessible_warehouse_id_list
        location_ids = scope_ids

        @order.dispatch_order_lines.includes(:source_allocations, :destination_allocations).find_each do |line|
          line.source_allocations.each do |alloc|
            wh = alloc.warehouse
            next if wh.blank?

            unless warehouse_ids.include?(wh.id)
              raise JurisdictionViolation.new(
                "Warehouse #{wh.code || wh.id} is outside your jurisdiction.",
                field: "source_allocations.warehouse_id"
              )
            end
          end

          line.destination_allocations.each do |alloc|
            loc = alloc.destination_location
            next if loc.blank?

            unless location_ids.include?(loc.id)
              raise JurisdictionViolation.new(
                "Destination #{loc.code || loc.name} is outside your jurisdiction.",
                field: "destination_allocations.destination_location_id"
              )
            end

            if loc.location_type == Cats::Core::Location::WAREHOUSE
              wh = Warehouse.find_by(location_id: loc.id)
              if wh.present? && !warehouse_ids.include?(wh.id)
                raise JurisdictionViolation.new(
                  "Destination warehouse is outside your jurisdiction.",
                  field: "destination_allocations.destination_location_id"
                )
              end
            end
          end
        end
      end

      private

      def accessible_warehouse_id_list
        raw = @access.accessible_warehouse_ids
        if raw.is_a?(ActiveRecord::Relation)
          raw.pluck(:id)
        else
          Array(raw).map(&:to_i)
        end
      end
    end
  end
end
