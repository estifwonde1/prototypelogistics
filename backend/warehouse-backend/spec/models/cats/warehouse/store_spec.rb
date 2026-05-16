require "rails_helper"

RSpec.describe Cats::Warehouse::Store, type: :model do
  let(:warehouse) { create(:cats_warehouse_warehouse) }

  def build_store(**overrides)
    build(:cats_warehouse_store,
          warehouse: warehouse,
          length: 10, width: 8, height: 5,
          **overrides)
  end

  # ── available_space tracks live occupancy ───────────────────────────────────

  describe "calculate_capacity_metrics" do
    it "sets usable_space to net floor area (m²) on create" do
      store = create(:cats_warehouse_store,
                     warehouse: warehouse,
                     length: 10, width: 8, height: 5,
                     usable_space: 0, available_space: 0)
      expect(store.usable_space).to eq(80.0)
    end

    it "sets usable_volume_m3 to full floor × height without warehouse usable %" do
      create(
        :cats_warehouse_warehouse_capacity,
        warehouse: warehouse,
        length_m: 100,
        width_m: 100,
        height_m: 10,
        usable_space_percentage: 75
      )
      store = create(:cats_warehouse_store,
                     warehouse: warehouse,
                     length: 10, width: 10, height: 10,
                     usable_space: 0, available_space: 0)
      expect(store.usable_volume_m3).to eq(1000.0)
    end

    it "sets available_space from live stack footprint on dimension update" do
      store = create(:cats_warehouse_store,
                     warehouse: warehouse,
                     length: 10, width: 8, height: 5,
                     usable_space: 0, available_space: 0)
      expect(store.usable_space).to eq(80.0)

      create(:cats_warehouse_stack,
             store: store, length: 5, width: 5, height: 2,
             quantity: 1, stack_status: "active")

      store.update!(height: 5)

      expect(store.available_space).to eq(55.0)
    end
  end

  # ── MT vs m³ validation removed ─────────────────────────────────────────────

  describe "fits_inside_warehouse_capacity" do
    it "does not raise when usable_storage_capacity_mt is set (MT check is skipped)" do
      cap = Cats::Warehouse::WarehouseCapacity.create!(
        warehouse: warehouse,
        total_area_sqm: 10_000,
        total_storage_capacity_mt: 1 # tiny MT limit — would wrongly block if compared to m³
      )
      # Store usable_space = 400 m³ >> 1 MT, but the check is intentionally skipped
      store = build_store
      expect(store).to be_valid
    end

    it "blocks when total store area exceeds warehouse total_area_sqm" do
      Cats::Warehouse::WarehouseCapacity.create!(
        warehouse: warehouse,
        total_area_sqm: 1 # 1 m² — store footprint (80 m²) will exceed this
      )
      store = build_store
      expect(store).not_to be_valid
      expect(store.errors[:base]).to include(/Total store area cannot exceed/)
    end
  end
end
