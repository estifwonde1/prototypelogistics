# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::AccessContext, type: :service do
  let(:hub) { create(:cats_warehouse_hub) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:store1) { create(:cats_warehouse_store, warehouse: warehouse, name: "Store 1") }
  let(:store2) { create(:cats_warehouse_store, warehouse: warehouse, name: "Store 2") }
  let(:store3) { create(:cats_warehouse_store, warehouse: warehouse, name: "Store 3") }

  describe "#assigned_store_ids for Storekeeper" do
    let(:storekeeper) { create(:cats_core_user, role_name: "Storekeeper") }

    context "with warehouse-level assignment" do
      before do
        # Force creation of stores before assignment
        store1
        store2
        store3
        
        Cats::Warehouse::UserAssignment.create!(
          user: storekeeper,
          role_name: "Storekeeper",
          warehouse: warehouse
        )
      end

      it "returns all stores in the assigned warehouse" do
        access = described_class.new(user: storekeeper)
        store_ids = access.assigned_store_ids

        expect(store_ids).to contain_exactly(store1.id, store2.id, store3.id)
      end
    end

    context "with store-level assignment" do
      before do
        Cats::Warehouse::UserAssignment.create!(
          user: storekeeper,
          role_name: "Storekeeper",
          store: store1
        )
      end

      it "returns only the assigned store" do
        access = described_class.new(user: storekeeper)
        store_ids = access.assigned_store_ids

        expect(store_ids).to contain_exactly(store1.id)
      end
    end

    context "with multiple store-level assignments" do
      before do
        Cats::Warehouse::UserAssignment.create!(
          user: storekeeper,
          role_name: "Storekeeper",
          store: store1
        )
        Cats::Warehouse::UserAssignment.create!(
          user: storekeeper,
          role_name: "Storekeeper",
          store: store2
        )
      end

      it "returns all assigned stores" do
        access = described_class.new(user: storekeeper)
        store_ids = access.assigned_store_ids

        expect(store_ids).to contain_exactly(store1.id, store2.id)
      end
    end
  end

  describe "#accessible_warehouse_ids for Storekeeper" do
    let(:storekeeper) { create(:cats_core_user, role_name: "Storekeeper") }

    context "with warehouse-level assignment" do
      before do
        Cats::Warehouse::UserAssignment.create!(
          user: storekeeper,
          role_name: "Storekeeper",
          warehouse: warehouse
        )
      end

      it "returns the assigned warehouse" do
        access = described_class.new(user: storekeeper)
        warehouse_ids = access.accessible_warehouse_ids

        expect(warehouse_ids).to contain_exactly(warehouse.id)
      end
    end

    context "with store-level assignment" do
      before do
        Cats::Warehouse::UserAssignment.create!(
          user: storekeeper,
          role_name: "Storekeeper",
          store: store1
        )
      end

      it "returns the warehouse of the assigned store" do
        access = described_class.new(user: storekeeper)
        warehouse_ids = access.accessible_warehouse_ids

        expect(warehouse_ids).to contain_exactly(warehouse.id)
      end
    end
  end

  describe "#storekeeper_warehouse_ids" do
    let(:storekeeper) { create(:cats_core_user, role_name: "Storekeeper") }

    context "with warehouse-level assignment" do
      before do
        Cats::Warehouse::UserAssignment.create!(
          user: storekeeper,
          role_name: "Storekeeper",
          warehouse: warehouse
        )
      end

      it "returns the assigned warehouse IDs" do
        access = described_class.new(user: storekeeper)
        warehouse_ids = access.storekeeper_warehouse_ids

        expect(warehouse_ids).to contain_exactly(warehouse.id)
      end
    end

    context "with store-level assignment" do
      before do
        Cats::Warehouse::UserAssignment.create!(
          user: storekeeper,
          role_name: "Storekeeper",
          store: store1
        )
      end

      it "returns empty array" do
        access = described_class.new(user: storekeeper)
        warehouse_ids = access.storekeeper_warehouse_ids

        expect(warehouse_ids).to be_empty
      end
    end
  end
end
