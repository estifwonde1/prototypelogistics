# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::WarehouseCapacityGuard, type: :service do
  let(:location) { create(:cats_core_location) }
  let(:hub) { create(:cats_warehouse_hub, location: location) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub, location: location) }
  let(:mt_unit) do
    Cats::Core::UnitOfMeasure.find_by("LOWER(abbreviation) = ?", "mt") ||
      create(:cats_core_unit_of_measure, abbreviation: "mt", name: "Metric Ton")
  end
  let(:commodity) do
    create(:cats_core_commodity, received_quantity: 100, unit_of_measure: mt_unit)
  end

  let!(:capacity) do
    create(
      :cats_warehouse_warehouse_capacity,
      warehouse: warehouse,
      length_m: 10,
      width_m: 10,
      height_m: 5,
      usable_space_percentage: 75
    )
  end

  def seed_used_mt(amount)
    store = create(:cats_warehouse_store, warehouse: warehouse)
    stack = create(
      :cats_warehouse_stack,
      store: store,
      commodity: commodity,
      unit: mt_unit,
      base_quantity: amount
    )
    create(
      :cats_warehouse_stock_balance,
      warehouse: warehouse,
      store: store,
      stack: stack,
      commodity: commodity,
      unit: mt_unit,
      quantity: amount,
      base_quantity: amount,
      available_quantity: amount
    )
  end

  it "allows assignment within remaining capacity" do
    seed_used_mt(250)
    usage = Cats::Warehouse::CapacityUsage.for_warehouse(warehouse)
    assign_qty = [ usage.remaining_mt - 1, 1 ].max

    expect {
      described_class.ensure_fits!(
        warehouse: warehouse,
        quantity: assign_qty,
        quantity_unit_id: nil,
        commodity_id: commodity.id,
        line_unit_id: mt_unit.id
      )
    }.not_to raise_error
  end

  it "rejects assignment exceeding remaining capacity" do
    seed_used_mt(250)
    usage = Cats::Warehouse::CapacityUsage.for_warehouse(warehouse)
    over_qty = usage.remaining_mt + 10

    expect {
      described_class.ensure_fits!(
        warehouse: warehouse,
        quantity: over_qty,
        quantity_unit_id: nil,
        commodity_id: commodity.id,
        line_unit_id: mt_unit.id
      )
    }.to raise_error(ArgumentError, /Insufficient warehouse capacity/)
  end
end

RSpec.describe Cats::Warehouse::ReceiptOrderAssignmentService, "warehouse capacity guard", type: :service do
  let(:location) { create(:cats_core_location) }
  let(:hub) { create(:cats_warehouse_hub, location: location) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub, location: location) }
  let(:actor) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:mt_unit) do
    Cats::Core::UnitOfMeasure.find_by("LOWER(abbreviation) = ?", "mt") ||
      create(:cats_core_unit_of_measure, abbreviation: "mt", name: "Metric Ton")
  end
  let(:commodity) do
    create(:cats_core_commodity, received_quantity: 100, unit_of_measure: mt_unit)
  end

  let!(:capacity) do
    create(
      :cats_warehouse_warehouse_capacity,
      warehouse: warehouse,
      length_m: 10,
      width_m: 10,
      height_m: 5,
      usable_space_percentage: 75
    )
  end

  let(:receipt_order) do
    Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-CAP-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let(:receipt_line) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: receipt_order,
      commodity: commodity,
      unit: mt_unit,
      quantity: 1_000,
      line_reference_no: "RL-#{SecureRandom.hex(5)}"
    )
  end

  before do
    receipt_line
    allow(Cats::Warehouse::NotificationFanout).to receive(:deliver)

    store = create(:cats_warehouse_store, warehouse: warehouse)
    stack = create(
      :cats_warehouse_stack,
      store: store,
      commodity: commodity,
      unit: mt_unit,
      base_quantity: 250
    )
    create(
      :cats_warehouse_stock_balance,
      warehouse: warehouse,
      store: store,
      stack: stack,
      commodity: commodity,
      unit: mt_unit,
      quantity: 250,
      base_quantity: 250,
      available_quantity: 250
    )
  end

  it "rejects warehouse assignment when quantity exceeds remaining MT" do
    usage = Cats::Warehouse::CapacityUsage.for_warehouse(warehouse)
    over_qty = usage.remaining_mt + 5

    service = described_class.new(
      order: receipt_order,
      actor: actor,
      assignments: [
        {
          receipt_order_line_id: receipt_line.id,
          warehouse_id: warehouse.id,
          hub_id: hub.id,
          quantity: over_qty
        }
      ]
    )

    expect { service.call }.to raise_error(ArgumentError, /Insufficient warehouse capacity/)
  end

  it "creates assignment when quantity fits remaining MT" do
    usage = Cats::Warehouse::CapacityUsage.for_warehouse(warehouse)
    ok_qty = [ usage.remaining_mt - 1, 1 ].max

    service = described_class.new(
      order: receipt_order,
      actor: actor,
      assignments: [
        {
          receipt_order_line_id: receipt_line.id,
          warehouse_id: warehouse.id,
          hub_id: hub.id,
          quantity: ok_qty
        }
      ]
    )

    expect { service.call }.to change(Cats::Warehouse::ReceiptOrderAssignment, :count).by(1)
  end

  it "resolves warehouse_id from store_id when store_id is present but warehouse_id is omitted" do
    store = Cats::Warehouse::Store.find_by(warehouse_id: warehouse.id) || create(:cats_warehouse_store, warehouse: warehouse)
    service = described_class.new(
      order: receipt_order,
      actor: actor,
      assignments: [
        {
          receipt_order_line_id: receipt_line.id,
          store_id: store.id,
          quantity: 10
        }
      ]
    )

    expect { service.call }.to change(Cats::Warehouse::ReceiptOrderAssignment, :count).by(1)
    assignment = Cats::Warehouse::ReceiptOrderAssignment.last
    expect(assignment.warehouse_id).to eq(warehouse.id)
  end
end
