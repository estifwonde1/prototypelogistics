# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrder < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_orders"

      include DocumentLifecycle

      belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true
      belongs_to :location, class_name: "Cats::Core::Location", optional: true
      belongs_to :officer_location, class_name: "Cats::Core::Location", optional: true
      belongs_to :created_by, class_name: "Cats::Core::User"
      belongs_to :confirmed_by, class_name: "Cats::Core::User", optional: true
      belongs_to :approved_by, class_name: "Cats::Core::User", optional: true
      belongs_to :destination, polymorphic: true, optional: true

      has_many :dispatch_order_lines, class_name: "Cats::Warehouse::DispatchOrderLine", dependent: :destroy
      has_many :dispatch_order_authorizations, class_name: "Cats::Warehouse::DispatchOrderAuthorization", dependent: :destroy
      has_many :transport_records, class_name: "Cats::Warehouse::TransportRecord", dependent: :destroy
      has_many :waybills, class_name: "Cats::Warehouse::Waybill"
      has_many :gins, class_name: "Cats::Warehouse::Gin"
      has_many :dispatch_order_assignments, class_name: "Cats::Warehouse::DispatchOrderAssignment", dependent: :destroy
      has_many :stock_reservations, class_name: "Cats::Warehouse::StockReservation", dependent: :destroy
      has_many :workflow_events, as: :entity, class_name: "Cats::Warehouse::WorkflowEvent", dependent: :destroy

      validates :reference_no, uniqueness: true, allow_blank: true
      validates :created_by, presence: true
      validates :plan_reference, length: { maximum: 100 }, allow_blank: true

      def v2_dispatch?
        plan_reference.present?
      end

      def exchange_order?
        return false unless v2_dispatch?

        DispatchLineDestinationAllocation
          .joins(:dispatch_order_line)
          .where(cats_warehouse_dispatch_order_lines: { dispatch_order_id: id })
          .where.not(destination_location_type: Cats::Core::Location::WAREHOUSE)
          .none? &&
          DispatchLineDestinationAllocation
            .joins(:dispatch_order_line)
            .where(cats_warehouse_dispatch_order_lines: { dispatch_order_id: id })
            .exists?
      end

      def ensure_confirmable!
        super
        return ensure_v2_confirmable! if v2_dispatch?

        ensure_legacy_confirmable!
      end

      private

      def ensure_v2_confirmable!
        raise ArgumentError, "plan_reference is required" if plan_reference.blank?
        raise ArgumentError, "Dispatch order has no lines" if dispatch_order_lines.empty?

        dispatch_order_lines.each do |line|
          raise ArgumentError, "Line #{line.id} missing source allocations" if line.source_allocations.empty?
          raise ArgumentError, "Line #{line.id} missing destination allocations" if line.destination_allocations.empty?
        end
      end

      def ensure_legacy_confirmable!
        raise ArgumentError, "Dispatch order warehouse is required" if warehouse.blank?
        raise ArgumentError, "Dispatch order hub is required" if hub.blank?
        raise ArgumentError, "Dispatch order dispatched date is required" if dispatched_date.blank?
        raise ArgumentError, "Dispatch order has no lines" if dispatch_order_lines.empty?

        invalid_line = dispatch_order_lines.detect { |line| line.commodity_id.blank? || line.unit_id.blank? || line.quantity.to_f <= 0 }
        raise ArgumentError, "Dispatch order contains incomplete lines" if invalid_line.present?
      end
    end
  end
end
