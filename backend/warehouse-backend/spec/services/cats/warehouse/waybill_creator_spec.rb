require "rails_helper"

RSpec.describe Cats::Warehouse::WaybillCreator, type: :service do
  it "creates a waybill with transport and items" do
    transporter = create(:cats_core_transporter)
    commodity = create(:cats_core_commodity)
    unit = create(:cats_core_unit_of_measure)
    source = create(:cats_core_location)
    destination = create(:cats_core_location)

    transport = {
      transporter: transporter,
      vehicle_plate_no: "ABC-123",
      driver_name: "Driver A",
      driver_phone: "+251911111111"
    }

    items = [{ commodity: commodity, unit: unit, quantity: 5 }]

    waybill = described_class.new(
      reference_no: "WB-001",
      issued_on: Date.today,
      source_location: source,
      destination_location: destination,
      transport: transport,
      items: items
    ).call

    expect(waybill).to be_persisted
    expect(waybill.waybill_items.count).to eq(1)
    expect(waybill.waybill_transport).to be_present
  end
end
