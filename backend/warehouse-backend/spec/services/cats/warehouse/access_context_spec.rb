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
        store1
        store2
        store3

        Cats::Warehouse::UserAssignment.create!(
          user: storekeeper,
          role_name: "Storekeeper",
          warehouse: warehouse
        )
      end

      it "returns no stores until a store is explicitly assigned" do
        access = described_class.new(user: storekeeper)
        store_ids = access.assigned_store_ids

        expect(store_ids).to be_empty
      end

      it "does not infer stores for multi-store warehouses" do
        access = described_class.new(user: storekeeper)
        store_ids = access.storekeeper_accessible_store_ids

        expect(store_ids).to be_empty
      end
    end

    context "with warehouse-level assignment in a single-store warehouse" do
      let(:single_store_warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
      let!(:warehouse_capacity) { create(:cats_warehouse_warehouse_capacity, warehouse: single_store_warehouse) }
      let!(:sole_store) { create(:cats_warehouse_store, warehouse: single_store_warehouse, name: "Only Store") }

      before do
        Cats::Warehouse::UserAssignment.create!(
          user: storekeeper,
          role_name: "Storekeeper",
          warehouse: single_store_warehouse
        )
      end

      it "includes the sole store" do
        access = described_class.new(user: storekeeper)
        store_ids = access.storekeeper_accessible_store_ids

        expect(store_ids).to contain_exactly(sole_store.id)
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

    context "with multiple roles (Hub Manager and Warehouse Manager)" do
      let(:user) { create(:cats_core_user) }
      let(:hub_warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
      let(:standalone_warehouse) { create(:cats_warehouse_warehouse, hub: nil) }

      before do
        # User is Hub Manager for the hub
        Cats::Warehouse::UserAssignment.create!(
          user: user,
          role_name: "Hub Manager",
          hub: hub
        )
        # User is Warehouse Manager for the standalone warehouse
        Cats::Warehouse::UserAssignment.create!(
          user: user,
          role_name: "Warehouse Manager",
          warehouse: standalone_warehouse
        )
        # Explicitly assign roles
        user.roles << Cats::Core::Role.find_or_create_by!(name: "Hub Manager")
        user.roles << Cats::Core::Role.find_or_create_by!(name: "Warehouse Manager")
      end

      it "includes both hub warehouses and standalone warehouses" do
        access = described_class.new(user: user)
        warehouse_ids = access.accessible_warehouse_ids.pluck(:id)

        expect(warehouse_ids).to include(hub_warehouse.id)
        expect(warehouse_ids).to include(standalone_warehouse.id)
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

  describe "#can_access_warehouse?" do
    let(:admin) { create(:cats_core_user, role_name: "Admin") }
    let(:other_warehouse) { create(:cats_warehouse_warehouse) }

    it "allows admin to access any warehouse" do
      access = described_class.new(user: admin)

      expect(access.can_access_warehouse?(warehouse.id)).to be(true)
      expect(access.can_access_warehouse?(other_warehouse.id)).to be(true)
    end

    it "denies warehouse manager access to unassigned warehouses" do
      wm = create(:cats_core_user, role_name: "Warehouse Manager")
      Cats::Warehouse::UserAssignment.create!(
        user: wm,
        role_name: "Warehouse Manager",
        warehouse: warehouse
      )
      access = described_class.new(user: wm)

      expect(access.can_access_warehouse?(warehouse.id)).to be(true)
      expect(access.can_access_warehouse?(other_warehouse.id)).to be(false)
    end

    it "allows independent warehouse manager access to assigned warehouses" do
      iwm = create(:cats_core_user, role_name: "Independent Warehouse Manager")
      Cats::Warehouse::UserAssignment.create!(
        user: iwm,
        role_name: "Independent Warehouse Manager",
        warehouse: warehouse
      )
      access = described_class.new(user: iwm)

      expect(access.can_access_warehouse?(warehouse.id)).to be(true)
      expect(access.can_access_warehouse?(other_warehouse.id)).to be(false)
    end
  end

  describe "#accessible_hub_ids and #can_access_hub?" do
    let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
    let(:hub_warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
    let(:standalone_warehouse) do
      create(:cats_warehouse_warehouse, hub: nil, location: create(:cats_core_location), managed_under: "federal")
    end

    it "includes the parent hub for hub-affiliated warehouse managers" do
      Cats::Warehouse::UserAssignment.create!(
        user: wm,
        role_name: "Warehouse Manager",
        warehouse: hub_warehouse
      )

      access = described_class.new(user: wm)

      expect(access.accessible_hub_ids).to contain_exactly(hub.id)
      expect(access.can_access_hub?(hub.id)).to be(true)
      expect(access.can_access_hub?(hub.id + 999)).to be(false)
    end

    it "returns no hubs for standalone-only warehouse managers" do
      Cats::Warehouse::UserAssignment.create!(
        user: wm,
        role_name: "Warehouse Manager",
        warehouse: standalone_warehouse
      )

      access = described_class.new(user: wm)

      expect(access.accessible_hub_ids).to be_empty
      expect(access.can_access_hub?(hub.id)).to be(false)
    end

    it "includes hubs from both hub-affiliated and standalone warehouse assignments" do
      Cats::Warehouse::UserAssignment.create!(
        user: wm,
        role_name: "Warehouse Manager",
        warehouse: hub_warehouse
      )
      Cats::Warehouse::UserAssignment.create!(
        user: wm,
        role_name: "Warehouse Manager",
        warehouse: standalone_warehouse
      )

      access = described_class.new(user: wm)

      expect(access.accessible_hub_ids).to contain_exactly(hub.id)
      expect(access.can_access_hub?(hub.id)).to be(true)
    end
  end
end
