# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::DispatchOrderAuthorizationWaybillGenerator, type: :service do
  let(:actor) { create(:cats_core_user) }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { commodity.unit_of_measure }
  let(:source_wh) { create(:cats_warehouse_warehouse, hub: nil, managed_under: "federal") }
  let(:dest_wh) { create(:cats_warehouse_warehouse, hub: nil, managed_under: "federal") }
  let(:transporter) { create(:cats_core_transporter) }
  let(:order) do
    Cats::Warehouse::DispatchOrder.create!(
      reference_no: "DO-SPEC-#{SecureRandom.hex(3).upcase}",
      dispatch_reference: "DO-SPEC-#{SecureRandom.hex(3).upcase}",
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed]
    )
  end
  let!(:line) do
    Cats::Warehouse::DispatchOrderLine.create!(
      dispatch_order: order,
      commodity: commodity,
      quantity: 10,
      unit: unit,
      base_quantity: 10,
      base_unit_id: unit.id
    )
  end
  let!(:dest_allocation) do
    Cats::Warehouse::DispatchLineDestinationAllocation.create!(
      dispatch_order_line: line,
      destination_location_id: dest_wh.location_id,
      destination_location_type: Cats::Core::Location::WAREHOUSE,
      quantity: 10,
      unit: unit,
      base_quantity: 10,
      base_unit_id: unit.id
    )
  end
  let(:authorization) do
    Cats::Warehouse::DispatchOrderAuthorization.create!(
      dispatch_order: order,
      warehouse: source_wh,
      reference_no: "DOA-#{SecureRandom.hex(4).upcase}",
      status: Cats::Warehouse::DispatchOrderAuthorization::CONFIRMED,
      authorized_quantity: 10,
      authorized_base_quantity: 10,
      authorized_quantity_input_unit_id: unit.id,
      remaining_quantity: 10,
      transporter: transporter,
      transporter_name: transporter.name,
      driver_name: "Driver A",
      driver_id_number: "LIC-001",
      truck_plate_number: "ABC-123",
      driver_phone: driver_phone,
      created_by: actor
    )
  end
  let!(:auth_store) do
    Cats::Warehouse::DispatchOrderAuthorizationStore.create!(
      dispatch_order_authorization: authorization,
      store: create(:cats_warehouse_store, warehouse: source_wh),
      commodity: commodity,
      authorized_quantity: 10,
      base_quantity: 10,
      remaining_quantity: 10,
      dispatched_quantity: 0
    )
  end

  subject(:generator) { described_class.new(authorization: authorization, actor: actor) }

  context "when driver phone is on the authorization" do
    let(:driver_phone) { "0911000000" }

    it "creates a waybill with driver phone" do
      waybill = generator.call

      expect(waybill.waybill_transport.driver_phone).to eq("0911000000")
    end
  end

  context "when driver phone is missing but transport record has phone" do
    let(:driver_phone) { nil }

    before do
      Cats::Warehouse::TransportRecord.create!(
        dispatch_order: order,
        warehouse: source_wh,
        driver_name: "Driver A",
        vehicle_plate: "ABC-123",
        phone: "0912000000",
        recorded_by: actor
      )
    end

    it "resolves phone from transport record" do
      waybill = generator.call

      expect(waybill.waybill_transport.driver_phone).to eq("0912000000")
    end
  end

  context "when driver phone is missing everywhere" do
    let(:driver_phone) { nil }

    it "raises a clear error" do
      expect { generator.call }.to raise_error(ArgumentError, "Driver phone is required")
    end
  end
end
