# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::ReceiptOrderViewerScope, type: :service do
  let(:hub) { create(:cats_warehouse_hub) }
  let(:dependent_wh) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:standalone_wh) do
    create(:cats_warehouse_warehouse, hub: nil, location: create(:cats_core_location), managed_under: "federal")
  end
  let(:actor) { create(:cats_core_user, role_name: "Federal Officer") }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { commodity.unit_of_measure }

  let!(:order) do
    Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-VIEW-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let!(:line_dependent) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: order,
      commodity: commodity,
      unit: unit,
      quantity: 100,
      destination_warehouse_id: dependent_wh.id,
      line_reference_no: "RL-D-#{SecureRandom.hex(4)}"
    )
  end

  let!(:line_standalone) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: order,
      commodity: commodity,
      unit: unit,
      quantity: 50,
      destination_warehouse_id: standalone_wh.id,
      line_reference_no: "RL-S-#{SecureRandom.hex(4)}"
    )
  end

  let!(:assignment_dependent) do
    Cats::Warehouse::ReceiptOrderAssignment.create!(
      receipt_order: order,
      receipt_order_line: line_dependent,
      hub: hub,
      warehouse: dependent_wh,
      quantity: 100,
      status: "assigned"
    )
  end

  let!(:assignment_standalone) do
    Cats::Warehouse::ReceiptOrderAssignment.create!(
      receipt_order: order,
      receipt_order_line: line_standalone,
      warehouse: standalone_wh,
      quantity: 50,
      status: "assigned"
    )
  end

  describe ".assignments_for_hub" do
    it "returns only assignments for the requested hub" do
      scoped = described_class.assignments_for_hub(order, hub_id: hub.id)

      expect(scoped.pluck(:id)).to contain_exactly(assignment_dependent.id)
      expect(scoped.pluck(:id)).not_to include(assignment_standalone.id)
    end
  end

  describe ".lines_for_hub" do
    it "returns only lines linked to the requested hub" do
      assignments = described_class.assignments_for_hub(order, hub_id: hub.id)
      scoped = described_class.lines_for_hub(order, hub_id: hub.id, assignments: assignments)

      expect(scoped.pluck(:id)).to contain_exactly(line_dependent.id)
    end
  end

  describe ".assignments_for" do
    it "returns only assignments for the requested warehouse" do
      scoped = described_class.assignments_for(order, warehouse_id: dependent_wh.id)

      expect(scoped.pluck(:id)).to contain_exactly(assignment_dependent.id)
    end
  end

  describe ".lines_for" do
    it "returns only lines linked to the requested warehouse" do
      assignments = described_class.assignments_for(order, warehouse_id: dependent_wh.id)
      scoped = described_class.lines_for(order, warehouse_id: dependent_wh.id, assignments: assignments)

      expect(scoped.pluck(:id)).to contain_exactly(line_dependent.id)
    end
  end
end
