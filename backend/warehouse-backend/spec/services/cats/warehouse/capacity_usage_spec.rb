# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::CapacityUsage do
  let(:warehouse) { create(:cats_warehouse_warehouse) }
  let!(:capacity) do
    create(
      :cats_warehouse_warehouse_capacity,
      warehouse: warehouse,
      length_m: 10,
      width_m: 10,
      height_m: 10,
      usable_space_percentage: 75
    )
  end

  it "reports used and remaining MT from stock balances" do
    store = create(:cats_warehouse_store, warehouse: warehouse, length: 5, width: 5, height: 5)
    commodity = create(:cats_core_commodity, volume_per_metric_ton: 1.2)
    create(
      :cats_warehouse_stock_balance,
      warehouse: warehouse,
      store: store,
      commodity: commodity,
      base_quantity: 100,
      quantity: 100
    )

    usage = described_class.for_warehouse(warehouse)
    expect(usage.used_mt).to eq(100.0)
    expect(usage.capacity_mt).to be > 0
    expect(usage.remaining_mt).to eq(usage.capacity_mt - 100.0)
  end
end
