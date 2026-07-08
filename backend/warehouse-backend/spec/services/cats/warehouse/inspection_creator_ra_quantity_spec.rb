# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::InspectionCreator, type: :model do
  let(:location) { create(:cats_core_location) }
  let(:hub) { create(:cats_warehouse_hub, location: location) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub, location: location) }
  let(:inspector) { create(:cats_core_user, role_name: "Storekeeper") }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { commodity.unit_of_measure }
  let(:transporter) { create(:cats_core_transporter) }

  let(:receipt_order) do
    Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: inspector,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-IC-RA-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let(:receipt_line) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: receipt_order,
      commodity: commodity,
      unit: unit,
      quantity: 1_000,
      line_reference_no: "RL-IC-RA-#{SecureRandom.hex(5)}"
    )
  end

  let(:receipt_authorization) do
    store = create(:cats_warehouse_store, warehouse: warehouse)
    Cats::Warehouse::ReceiptAuthorization.create!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      warehouse: warehouse,
      store: store,
      transporter: transporter,
      created_by: inspector,
      status: Cats::Warehouse::ReceiptAuthorization::ACTIVE,
      authorized_quantity: 10,
      driver_name: "Driver",
      driver_id_number: "ID-1",
      truck_plate_number: "AA-11111",
      waybill_number: "WB-#{SecureRandom.hex(4)}",
      reference_no: "RA-IC-RA-#{SecureRandom.hex(4)}"
    )
  end

  before do
    receipt_line
    allow(Cats::Warehouse::WorkflowEventRecorder).to receive(:record!)
  end

  it "allows quantity_received to exceed RA authorized_quantity" do
    receipt_authorization
    insp = described_class.new(
      warehouse: warehouse,
      inspected_on: Date.current,
      inspector: inspector,
      items: [
        {
          commodity_id: commodity.id,
          unit_id: unit.id,
          quantity_received: 25.0,
          quality_status: "Good"
        }
      ],
      receipt_order: receipt_order,
      receipt_authorization_id: receipt_authorization.id,
      status: "confirmed"
    ).call

    expect(insp).to be_persisted
    expect(insp.inspection_items.sum(:quantity_received).to_f).to eq(25.0)
  end
end
