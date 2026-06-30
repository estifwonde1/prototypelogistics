module Cats
  module Warehouse
    class GinSerializer < ApplicationSerializer
      attributes :id, :reference_no, :warehouse_id, :issued_on, :destination_type, :destination_id, :destination_name,
                 :status, :workflow_status, :dispatch_order_id, :dispatch_order_authorization_id,
                 :transporter_id, :transporter_name, :driver_name, :driver_id_number, :truck_plate_number, :driver_phone,
                 :driver_confirmed_at, :driver_confirmed_by_name,
                 :generated_from_waybill_id,
                 :issued_by_id, :issued_by_name, :approved_by_id, :approved_by_name,
                 :created_at, :updated_at
      has_many :gin_items, serializer: GinItemSerializer

      def status
        object[:status].to_s.titleize
      end

      def issued_by_name
        user = object.issued_by
        return nil unless user

        [user.first_name, user.last_name].compact.join(" ").presence || user.email
      end

      def approved_by_name
        user = object.approved_by
        return nil unless user

        [user.first_name, user.last_name].compact.join(" ").presence || user.email
      end

      def destination_name
        # Try GIN's own polymorphic destination first
        name = object.destination&.name if object.respond_to?(:destination)
        return name if name.present?

        # Fall back to the DA's dispatch order FDP
        object.dispatch_order_authorization&.dispatch_order&.fdp&.name
      rescue StandardError
        nil
      end

      def driver_phone
        object.dispatch_order_authorization&.driver_phone
      end

      def driver_confirmed_at
        # Try GIN's own first (if it ever gets its own DB column), else fallback to DA
        if object.respond_to?(:driver_confirmed_at) && object.driver_confirmed_at.present?
          object.driver_confirmed_at
        else
          object.dispatch_order_authorization&.driver_confirmed_at
        end
      end

      def driver_confirmed_by_name
        # Try GIN's own first
        if object.respond_to?(:driver_confirmed_by) && object.driver_confirmed_by.present?
          user = object.driver_confirmed_by
          [user.first_name, user.last_name].compact.join(" ").presence || user.email
        else
          # Fallback to DA
          da = object.dispatch_order_authorization
          return nil unless da && da.driver_confirmed_by
          user = da.driver_confirmed_by
          [user.first_name, user.last_name].compact.join(" ").presence || user.email
        end
      end

      def transporter_name
        # Try GIN's own transporter first
        name = object.transporter&.name if object.respond_to?(:transporter)
        return name if name.present?

        # Fall back to the DA's transporter
        object.dispatch_order_authorization&.transporter&.name
      rescue StandardError
        nil
      end
    end
  end
end
