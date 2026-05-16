# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::CapacityCalculator do
  describe ".call" do
    it "derives footprint, volume, and MT from dimensions and floor percentage" do
      result = described_class.call(
        length_m: 100,
        width_m: 80,
        height_m: 10,
        usable_space_percentage: 75
      )

      expect(result.footprint_sqm).to eq(8000.0)
      expect(result.usable_floor_sqm).to eq(6000.0)
      expect(result.usable_volume_m3).to eq(60_000.0)
      expect(result.capacity_mt).to eq(48_000.0)
    end
  end

  describe ".mt_from_volume" do
    it "converts m3 to MT using reference density" do
      expect(described_class.mt_from_volume(125)).to eq(100.0)
    end
  end

  describe ".store_usable_volume_m3" do
    it "uses full floor × height without applying warehouse usable %" do
      warehouse = create(:cats_warehouse_warehouse)
      create(
        :cats_warehouse_warehouse_capacity,
        warehouse: warehouse,
        length_m: 100,
        width_m: 100,
        height_m: 10,
        usable_space_percentage: 75
      )
      store = build(
        :cats_warehouse_store,
        warehouse: warehouse,
        length: 10,
        width: 10,
        height: 10,
        usable_space: 0,
        available_space: 0
      )

      expect(described_class.store_usable_volume_m3(store)).to eq(1000.0)
    end
  end
end
