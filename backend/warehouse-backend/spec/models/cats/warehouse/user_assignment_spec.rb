# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::UserAssignment, type: :model do
  describe "validations" do
    let(:user) { create(:cats_core_user) }
    let(:hub) { create(:cats_warehouse_hub) }
    let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
    let(:store) { create(:cats_warehouse_store, warehouse: warehouse) }

    context "for Storekeeper role" do
      it "allows warehouse-level assignment" do
        assignment = described_class.new(
          user: user,
          role_name: "Storekeeper",
          warehouse: warehouse
        )
        expect(assignment).to be_valid
      end

      it "allows store-level assignment" do
        assignment = described_class.new(
          user: user,
          role_name: "Storekeeper",
          store: store
        )
        expect(assignment).to be_valid
      end

      it "rejects assignment without warehouse or store" do
        assignment = described_class.new(
          user: user,
          role_name: "Storekeeper"
        )
        expect(assignment).not_to be_valid
        expect(assignment.errors[:base]).to include("Storekeeper must be assigned to a warehouse or store")
      end

      it "rejects assignment with both warehouse and store" do
        assignment = described_class.new(
          user: user,
          role_name: "Storekeeper",
          warehouse: warehouse,
          store: store
        )
        expect(assignment).not_to be_valid
        expect(assignment.errors[:base]).to include("Storekeeper cannot have both warehouse and store assignment")
      end

      it "rejects assignment with hub" do
        assignment = described_class.new(
          user: user,
          role_name: "Storekeeper",
          hub: hub,
          warehouse: warehouse
        )
        expect(assignment).not_to be_valid
        expect(assignment.errors[:base]).to include("Hub not allowed for Storekeeper")
      end
    end

    context "for other roles" do
      it "validates Hub Manager requires hub" do
        assignment = described_class.new(
          user: user,
          role_name: "Hub Manager",
          hub: hub
        )
        expect(assignment).to be_valid
      end

      it "validates Warehouse Manager requires warehouse" do
        assignment = described_class.new(
          user: user,
          role_name: "Warehouse Manager",
          warehouse: warehouse
        )
        expect(assignment).to be_valid
      end
    end
  end
end
