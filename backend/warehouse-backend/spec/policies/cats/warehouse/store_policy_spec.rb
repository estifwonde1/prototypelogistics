# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::StorePolicy, type: :policy do
  let(:hub) { create(:cats_warehouse_hub) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:other_warehouse) { create(:cats_warehouse_warehouse, hub: hub) }

  let!(:warehouse_capacity) do
    create(
      :cats_warehouse_warehouse_capacity,
      warehouse: warehouse,
      length_m: 20,
      width_m: 20,
      height_m: 10,
      usable_space_percentage: 75
    )
  end

  let!(:other_warehouse_capacity) do
    create(
      :cats_warehouse_warehouse_capacity,
      warehouse: other_warehouse,
      length_m: 20,
      width_m: 20,
      height_m: 10,
      usable_space_percentage: 75
    )
  end

  let(:store) { create(:cats_warehouse_store, warehouse: warehouse) }
  let(:other_store) { create(:cats_warehouse_store, warehouse: other_warehouse) }

  let(:admin) { create(:cats_core_user, role_name: "Admin") }
  let(:hub_manager) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:warehouse_manager) { create(:cats_core_user, role_name: "Warehouse Manager") }

  before do
    Cats::Warehouse::UserAssignment.create!(user: hub_manager, hub: hub, role_name: "Hub Manager")
    Cats::Warehouse::UserAssignment.create!(
      user: warehouse_manager,
      warehouse: warehouse,
      role_name: "Warehouse Manager"
    )
  end

  describe "#create?" do
    it "allows admin and warehouse manager" do
      store_class = Cats::Warehouse::Store
      expect(described_class.new(admin, store_class)).to be_create
      expect(described_class.new(warehouse_manager, store_class)).to be_create
    end

    it "denies hub manager" do
      expect(described_class.new(hub_manager, Cats::Warehouse::Store)).not_to be_create
    end
  end

  describe "#update?" do
    it "allows admin and warehouse manager" do
      expect(described_class.new(admin, store)).to be_update
      expect(described_class.new(warehouse_manager, store)).to be_update
    end

    it "denies hub manager" do
      expect(described_class.new(hub_manager, store)).not_to be_update
    end
  end

  describe "#destroy?" do
    context "when store has no stock" do
      it "allows admin" do
        expect(described_class.new(admin, store)).to be_destroy
      end

      it "allows warehouse manager for accessible warehouse" do
        expect(described_class.new(warehouse_manager, store)).to be_destroy
      end

      it "denies hub manager" do
        expect(described_class.new(hub_manager, store)).not_to be_destroy
      end

      it "denies warehouse manager for out-of-scope warehouse" do
        expect(described_class.new(warehouse_manager, other_store)).not_to be_destroy
      end
    end

    context "when store has stock" do
      before do
        usage = instance_double(Cats::Warehouse::CapacityUsage::UsageResult, used_mt: 50.0)
        allow(Cats::Warehouse::CapacityUsage).to receive(:for_store).with(store).and_return(usage)
      end

      it "denies admin" do
        expect(described_class.new(admin, store)).not_to be_destroy
      end

      it "denies warehouse manager" do
        expect(described_class.new(warehouse_manager, store)).not_to be_destroy
      end

      it "denies hub manager" do
        expect(described_class.new(hub_manager, store)).not_to be_destroy
      end
    end
  end
end
