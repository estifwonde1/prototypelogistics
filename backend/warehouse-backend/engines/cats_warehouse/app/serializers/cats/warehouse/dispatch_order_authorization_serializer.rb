module Cats
  module Warehouse
    class DispatchOrderAuthorizationSerializer < ApplicationSerializer
      attributes :id, :reference_no, :status,
                 :dispatch_order_id, :dispatch_order_reference_no,
                 :warehouse_id, :warehouse_name,
                 :commodity_id, :commodity_name,
                 :transporter_id, :transporter_name,
                 :authorized_quantity,
                 :authorized_quantity_input,
                 :authorized_quantity_input_unit_id,
                 :authorized_quantity_input_unit_name,
                 :authorized_quantity_input_unit_abbreviation,
                 :driver_name, :driver_id_number, :driver_phone, :truck_plate_number,
                 :driver_confirmed_at, :driver_confirmed_by_name,
                 :confirmed_at, :confirmed_by_name,
                 :cancelled_at,
                 :created_by_name,
                 :created_at, :updated_at,
                 :authorization_stores

      def dispatch_order_reference_no
        object.dispatch_order&.reference_no || "DO-#{object.dispatch_order_id}"
      end

      def warehouse_name
        object.warehouse&.name
      end

      def commodity_name
        safe_commodity_name(object.commodity)
      end

      def transporter_name
        object.transporter&.name || object.transporter_name
      end

      def authorized_quantity_input
        v = object.authorized_quantity_input
        return v.to_f if v.present?

        object.authorized_quantity.to_f
      end

      def authorized_quantity_input_unit_id
        v = object.authorized_quantity_input_unit_id
        v.presence || nil
      end

      def authorized_quantity_input_unit_name
        object.authorized_quantity_input_unit&.name
      end

      def authorized_quantity_input_unit_abbreviation
        object.authorized_quantity_input_unit&.abbreviation
      end

      def driver_confirmed_by_name
        user = object.driver_confirmed_by
        return nil unless user

        [user.first_name, user.last_name].compact.join(" ").presence || user.email
      end

      def confirmed_by_name
        user = object.confirmed_by
        return nil unless user

        [user.first_name, user.last_name].compact.join(" ").presence || user.email
      end

      def created_by_name
        user = object.created_by
        return nil unless user

        [user.first_name, user.last_name].compact.join(" ").presence || user.email
      end

      def authorization_stores
        object.authorization_stores.map do |as|
          as_commodity_name = safe_commodity_name(as.commodity)
          {
            id:                   as.id,
            store_id:             as.store_id,
            store_name:           as.store&.name,
            commodity_id:         as.commodity_id,
            commodity_name:       as_commodity_name,
            authorized_quantity:  as.authorized_quantity.to_f,
            base_quantity:        as.base_quantity&.to_f,
            dispatched_quantity:  as.dispatched_quantity.to_f,
            remaining_quantity:   as.remaining_quantity&.to_f
          }
        end
      end
      private

      # Safely resolve commodity name without crashing when Cats::Core::Commodity#name
      # calls project.source.commodity_name and source is a Donor (or other model) that
      # lacks that method. Always falls back to batch_no.
      def safe_commodity_name(commodity)
        return nil unless commodity.present?

        begin
          n = commodity.name if commodity.respond_to?(:name)
          n.presence
        rescue NoMethodError, StandardError
          nil
        end || (commodity.respond_to?(:batch_no) ? commodity.batch_no : nil)
      end
    end
  end
end
