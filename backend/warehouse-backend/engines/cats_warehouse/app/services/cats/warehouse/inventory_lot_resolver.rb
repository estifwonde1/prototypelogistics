module Cats
  module Warehouse
    class InventoryLotResolver
      def self.resolve(warehouse:, commodity_id:, batch_no:, expiry_date: nil, source: nil, lot_code: nil, received_on: nil, manufactured_on: nil, status: nil)
        return nil if batch_no.blank?

        lot = InventoryLot.find_or_initialize_by(
          warehouse_id: fetch_id(warehouse),
          commodity_id: commodity_id,
          batch_no: batch_no,
          expiry_date: expiry_date
        )

        if lot.new_record?
          lot.assign_attributes(
            source: source,
            lot_code: lot_code,
            received_on: received_on,
            manufactured_on: manufactured_on,
            status: status.presence || "Active"
          )
          lot.save!
        else
          lot.update!(
            source: source || lot.source,
            lot_code: lot_code.presence || lot.lot_code,
            received_on: received_on || lot.received_on,
            manufactured_on: manufactured_on || lot.manufactured_on,
            status: status.presence || lot.status
          )
        end

        lot
      end

      def self.fetch_id(value)
        return value.id if value.respond_to?(:id)
        return value if value.present?

        raise ArgumentError, "warehouse is required"
      end
      private_class_method :fetch_id
    end
  end
end
