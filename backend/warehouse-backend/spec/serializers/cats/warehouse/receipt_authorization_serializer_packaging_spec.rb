# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::ReceiptAuthorizationSerializer, type: :serializer do
  let(:location) { create(:cats_core_location) }
  let(:hub) { create(:cats_warehouse_hub, location: location) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub, location: location) }
  let(:actor) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:unit_mt) { create(:cats_core_unit_of_measure, abbreviation: "mt", name: "Metric Ton") }
  let(:unit_kg) { create(:cats_core_unit_of_measure, abbreviation: "kg", name: "Kilogram") }
  let(:unit_bag) { create(:cats_core_unit_of_measure, abbreviation: "BAG", name: "Bag") }

  let(:commodity) do
    c = create(:cats_core_commodity)
    c.update_columns(
      package_unit_per_package_id: unit_kg.id,
      package_size: 50
    )
    c.reload
  end

  let(:receipt_order) do
    Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-SER-PKG-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let(:receipt_line) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: receipt_order,
      commodity: commodity,
      unit: unit_mt,
      quantity: 100,
      packaging_unit_id: unit_bag.id,
      packaging_size: 50,
      line_reference_no: "RL-SER-PKG-#{SecureRandom.hex(5)}"
    )
  end

  let(:transporter) { create(:cats_core_transporter) }

  let(:ra) do
    store = create(:cats_warehouse_store, warehouse: warehouse)
    Cats::Warehouse::ReceiptAuthorization.create!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      warehouse: warehouse,
      store: store,
      transporter: transporter,
      created_by: actor,
      status: Cats::Warehouse::ReceiptAuthorization::PENDING,
      authorized_quantity: 3,
      driver_name: "Driver",
      driver_id_number: "ID-1",
      truck_plate_number: "AA-11111",
      waybill_number: "WB-#{SecureRandom.hex(4)}",
      reference_no: "RA-SER-PKG-#{SecureRandom.hex(4)}"
    )
  end

  before do
    receipt_line
    Cats::Warehouse::UomConversion.create!(
      commodity_id: commodity.id,
      from_unit_id: unit_mt.id,
      to_unit_id: unit_kg.id,
      multiplier: 1000,
      active: true
    )
  end

  it "converts authorized quantity to packaging basis before expected package count" do
    json = described_class.new(
      ra.reload,
      scope: actor,
      scope_name: :current_user
    ).as_json
    # 3 mt -> 3000 kg; 3000 / 50 kg per bag = 60 bags
    expect(json[:expected_packaging_units]).to eq(60)
    expect(json[:packaging_spec_label]).to include("50")
    expect(json[:packaging_spec_label]).to include("kg")
    expect(json[:packaging_spec_label].downcase).to include("bag")
  end
end
