# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::GrnGeneratorFromInspection, type: :model do
  let(:location) { create(:cats_core_location) }
  let(:hub) { create(:cats_warehouse_hub, location: location) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub, location: location) }
  let(:actor) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:unit_kg) { create(:cats_core_unit_of_measure, abbreviation: "kg", name: "Kilogram") }
  let(:unit_bag) { create(:cats_core_unit_of_measure, abbreviation: "bag", name: "Bag") }
  let(:commodity) { create(:cats_core_commodity, unit_of_measure: unit_kg) }

  let(:receipt_order) do
    Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-GFI-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let(:receipt_line) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: receipt_order,
      commodity: commodity,
      unit: unit_bag,
      quantity: 1_000,
      line_reference_no: "RL-GFI-#{SecureRandom.hex(5)}"
    )
  end

  let(:transporter) { create(:cats_core_transporter) }

  let(:receipt_authorization) do
    store = create(:cats_warehouse_store, warehouse: warehouse)
    Cats::Warehouse::ReceiptAuthorization.create!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      warehouse: warehouse,
      store: store,
      transporter: transporter,
      created_by: actor,
      status: Cats::Warehouse::ReceiptAuthorization::ACTIVE,
      authorized_quantity: 100,
      driver_name: "Driver",
      driver_id_number: "ID-1",
      truck_plate_number: "AA-11111",
      waybill_number: "WB-#{SecureRandom.hex(4)}",
      reference_no: "RA-GFI-#{SecureRandom.hex(4)}"
    )
  end

  let(:inspection) do
    Cats::Warehouse::Inspection.create!(
      warehouse: warehouse,
      inspector: actor,
      inspected_on: Date.current,
      reference_no: "INSP-GFI-#{SecureRandom.hex(4)}",
      receipt_order: receipt_order,
      receipt_authorization: receipt_authorization,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:draft],
      source_type: nil,
      source_id: nil
    )
  end

  before do
    receipt_line
    allow(Cats::Warehouse::WorkflowEventRecorder).to receive(:record!)
  end

  it "uses entered_unit_id on the inspection item for GRN line unit (over commodity default)" do
    receipt_authorization
    item = Cats::Warehouse::InspectionItem.create!(
      inspection: inspection,
      commodity: commodity,
      entered_unit_id: unit_bag.id,
      quantity_received: 10.0,
      quantity_damaged: 0,
      quantity_lost: 0,
      quality_status: "Good",
      line_reference_no: "IIT-GFI-#{SecureRandom.hex(5)}"
    )

    grn = described_class.new(inspection: inspection.reload, actor: actor).call

    expect(grn).to be_persisted
    gi = grn.grn_items.first
    expect(gi.unit_id).to eq(unit_bag.id)
    expect(gi.quantity).to eq(10.0)
  end

  it "falls back to receipt order line unit when entered_unit_id is blank" do
    receipt_authorization
    Cats::Warehouse::InspectionItem.create!(
      inspection: inspection,
      commodity: commodity,
      entered_unit_id: nil,
      quantity_received: 5.0,
      quantity_damaged: 0,
      quantity_lost: 0,
      quality_status: "Good",
      line_reference_no: "IIT-GFI-#{SecureRandom.hex(5)}"
    )

    grn = described_class.new(inspection: inspection.reload, actor: actor).call

    expect(grn.grn_items.first.unit_id).to eq(unit_bag.id)
  end

  it "falls back to commodity default unit when no receipt line unit can be resolved" do
    empty_ro = Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-GFI-EMPTY-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )

    inspection_empty = Cats::Warehouse::Inspection.create!(
      warehouse: warehouse,
      inspector: actor,
      inspected_on: Date.current,
      reference_no: "INSP-GFI-EMPTY-#{SecureRandom.hex(4)}",
      receipt_order: empty_ro,
      receipt_authorization: nil,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:draft],
      source_type: nil,
      source_id: nil
    )

    Cats::Warehouse::InspectionItem.create!(
      inspection: inspection_empty,
      commodity: commodity,
      entered_unit_id: nil,
      quantity_received: 3.0,
      quantity_damaged: 0,
      quantity_lost: 0,
      quality_status: "Good",
      line_reference_no: "IIT-GFI-#{SecureRandom.hex(5)}"
    )

    grn = described_class.new(inspection: inspection_empty.reload, actor: actor).call

    expect(grn.grn_items.first.unit_id).to eq(commodity.unit_of_measure_id)
  end
end
