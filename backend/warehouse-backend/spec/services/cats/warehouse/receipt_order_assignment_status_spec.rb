# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::ReceiptOrderAssignmentStatus, type: :model do
  describe ".resolve" do
    it "returns pending for hub-only routing" do
      expect(described_class.resolve(warehouse_id: nil, store_id: nil)).to eq("pending")
    end

    it "returns warehouse_assigned for warehouse without store" do
      expect(described_class.resolve(warehouse_id: 1, store_id: nil)).to eq("warehouse_assigned")
    end

    it "returns assigned when store is set" do
      expect(described_class.resolve(warehouse_id: 1, store_id: 2)).to eq("assigned")
    end
  end

  describe ".line_operationally_assigned?" do
    let(:hub_wh) { instance_double(Cats::Warehouse::Warehouse, hub_id: 10) }
    let(:standalone_wh) { instance_double(Cats::Warehouse::Warehouse, hub_id: nil) }

    before do
      allow(Cats::Warehouse::Warehouse).to receive(:where).and_return(Cats::Warehouse::Warehouse)
      allow(Cats::Warehouse::Warehouse).to receive(:exists?).and_return(false)
    end

    it "is false for hub-only pending rows" do
      row = instance_double(Cats::Warehouse::ReceiptOrderAssignment, store_id: nil, warehouse_id: nil)
      expect(described_class.line_operationally_assigned?([row])).to be(false)
    end

    it "is true for hub-affiliated warehouse rows without store" do
      allow(Cats::Warehouse::Warehouse).to receive(:where).with(id: 5, hub_id: nil).and_return(double(exists?: false))
      row = instance_double(Cats::Warehouse::ReceiptOrderAssignment, store_id: nil, warehouse_id: 5)
      expect(described_class.line_operationally_assigned?([row])).to be(true)
    end

    it "is false for standalone warehouse rows until store is assigned" do
      allow(Cats::Warehouse::Warehouse).to receive(:where).with(id: 9, hub_id: nil).and_return(double(exists?: true))
      row = instance_double(Cats::Warehouse::ReceiptOrderAssignment, store_id: nil, warehouse_id: 9)
      expect(described_class.line_operationally_assigned?([row])).to be(false)
    end

    it "is true when store is assigned on standalone warehouse" do
      row = instance_double(Cats::Warehouse::ReceiptOrderAssignment, store_id: 3, warehouse_id: 9)
      expect(described_class.line_operationally_assigned?([row])).to be(true)
    end
  end
end
