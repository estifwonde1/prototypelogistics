require "rails_helper"

RSpec.describe Cats::Warehouse::WaybillConfirmer, type: :service do
  it "confirms a waybill" do
    waybill = create(:cats_warehouse_waybill, status: "Draft")

    described_class.new(waybill: waybill).call

    expect(waybill.reload.status).to eq("Confirmed")
  end
end
