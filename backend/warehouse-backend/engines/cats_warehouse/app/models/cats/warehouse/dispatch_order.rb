module Cats
  module Warehouse
    class DispatchOrder < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_orders"

      include DocumentLifecycle

      belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true
      belongs_to :location, class_name: "Cats::Core::Location", optional: true
      belongs_to :created_by, class_name: "Cats::Core::User"
      belongs_to :confirmed_by, class_name: "Cats::Core::User", optional: true
      belongs_to :destination, polymorphic: true, optional: true
      belongs_to :fdp, class_name: "Cats::Warehouse::Fdp", optional: true

      has_many :dispatch_order_lines, class_name: "Cats::Warehouse::DispatchOrderLine", dependent: :destroy
      has_many :waybills, class_name: "Cats::Warehouse::Waybill"
      has_many :gins, class_name: "Cats::Warehouse::Gin"
      has_many :dispatch_order_assignments, class_name: "Cats::Warehouse::DispatchOrderAssignment", dependent: :destroy
      has_many :stock_reservations, class_name: "Cats::Warehouse::StockReservation", dependent: :destroy
      has_many :workflow_events, as: :entity, class_name: "Cats::Warehouse::WorkflowEvent", dependent: :destroy

      validates :reference_no, uniqueness: true, allow_blank: true
      validates :created_by, presence: true

      def ensure_confirmable!
        super
        raise ArgumentError, "Dispatch order has no lines" if dispatch_order_lines.empty?

        dispatch_order_lines.each do |line|
          if line.commodity_id.blank? || line.unit_id.blank? || line.quantity.to_f <= 0
            raise ArgumentError, "Dispatch order contains incomplete lines"
          end

          if line.warehouse_id.blank?
            raise ArgumentError, "Each dispatch line requires a source warehouse"
          end

          if line.fdp_id.blank?
            raise ArgumentError, "Each dispatch line requires an FDP destination"
          end

          if line.expected_receive_at.blank?
            raise ArgumentError, "Each dispatch line requires an expected receive time"
          end
        end

        if warehouse.blank? && dispatch_order_lines.first&.warehouse_id.present?
          first_line = dispatch_order_lines.first
          self.warehouse_id = first_line.warehouse_id
          self.hub_id = first_line.hub_id if hub_id.blank?
          self.fdp_id = first_line.fdp_id if fdp_id.blank?
          self.dispatched_date ||= first_line.expected_receive_at&.to_date
          save! if changed?
        end

        raise ArgumentError, "Dispatch order warehouse is required" if warehouse.blank?

        if warehouse.hub_id.present? && hub.blank?
          self.hub_id = warehouse.hub_id
          save! if changed?
        end

        raise ArgumentError, "Dispatch order dispatched date is required" if dispatched_date.blank?
      end
    end
  end
end
