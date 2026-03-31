module Cats
  module Warehouse
    class InventoryLotResolver
      def self.resolve(commodity_id:, batch_no:, expiry_date: nil)
        return nil if batch_no.blank?

        lot = InventoryLot.find_or_initialize_by(
          commodity_id: commodity_id,
          batch_no: batch_no
        )

        if lot.new_record?
          lot.expiry_date = expiry_date
          lot.save!
        end

        lot
      end
    end
  end
end
