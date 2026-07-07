# This migration comes from cats_warehouse (originally 20260531000000)
class AddReceivedQuantityToCommodities < ActiveRecord::Migration[7.0]
  def up
    add_column :cats_core_commodities, :received_quantity, :float

    Cats::Core::Commodity.reset_column_information
    Cats::Core::Commodity.find_each do |commodity|
      allocated = Cats::Warehouse::ReceiptOrderLine.where(commodity_id: commodity.id).sum(:quantity).to_f
      original = commodity.quantity.to_f + allocated
      commodity.update_column(:received_quantity, original)
    end

    change_column_null :cats_core_commodities, :received_quantity, false
  end

  def down
    remove_column :cats_core_commodities, :received_quantity
  end
end
