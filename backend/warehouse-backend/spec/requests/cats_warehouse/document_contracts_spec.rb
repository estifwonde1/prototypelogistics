require "rails_helper"

RSpec.describe "Cats::Warehouse document contract aliases", type: :request do
  let(:headers) { auth_headers(role: "Admin") }
  let!(:warehouse) { create(:cats_warehouse_warehouse) }
  let!(:location) { create(:cats_core_location) }
  let!(:commodity) { create(:cats_core_commodity) }
  let!(:unit) { commodity.unit_of_measure }
  let!(:user) { create(:cats_core_user, role_name: "Admin") }

  describe "POST /cats_warehouse/v1/grns" do
    it "accepts legacy grn_items and normalizes them to items" do
      post "/cats_warehouse/v1/grns",
           params: {
             payload: {
               warehouse_id: warehouse.id,
               received_on: Date.current.to_s,
               received_by_id: user.id,
               reference_no: "GRN-LEGACY-1",
               grn_items: [
                 {
                   commodity_id: commodity.id,
                   quantity: 5,
                   unit_id: unit.id
                 }
               ]
             }
           },
           as: :json,
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response.dig("data", "grn_items")).to be_present
    end
  end

  describe "POST /cats_warehouse/v1/gins" do
    it "accepts legacy gin_items and normalizes them to items" do
      post "/cats_warehouse/v1/gins",
           params: {
             payload: {
               warehouse_id: warehouse.id,
               issued_on: Date.current.to_s,
               issued_by_id: user.id,
               reference_no: "GIN-LEGACY-1",
               gin_items: [
                 {
                   commodity_id: commodity.id,
                   quantity: 2,
                   unit_id: unit.id
                 }
               ]
             }
           },
           as: :json,
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response.dig("data", "gin_items")).to be_present
    end
  end

  describe "POST /cats_warehouse/v1/inspections" do
    it "accepts legacy inspection_items and normalizes them to items" do
      post "/cats_warehouse/v1/inspections",
           params: {
             payload: {
               warehouse_id: warehouse.id,
               inspected_on: Date.current.to_s,
               inspector_id: user.id,
               reference_no: "INSP-LEGACY-1",
               inspection_items: [
                 {
                   commodity_id: commodity.id,
                   quantity_received: 4,
                   quantity_damaged: 0,
                   quantity_lost: 0,
                   quality_status: "good",
                   packaging_condition: "intact"
                 }
               ]
             }
           },
           as: :json,
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response.dig("data", "inspection_items")).to be_present
    end
  end

  describe "POST /cats_warehouse/v1/waybills" do
    let!(:transporter) do
      Cats::Core::Transporter.create!(
        code: "TR-001",
        name: "Test Transporter",
        address: "Addis Ababa",
        contact_phone: "0911223344"
      )
    end

    it "accepts legacy waybill_items and waybill_transport aliases" do
      post "/cats_warehouse/v1/waybills",
           params: {
             payload: {
               reference_no: "WB-LEGACY-1",
               issued_on: Date.current.to_s,
               source_location_id: location.id,
               destination_location_id: location.id,
               waybill_transport: {
                 transporter_id: transporter.id,
                 vehicle_plate_no: "ABC-123",
                 driver_name: "Driver One",
                 driver_phone: "0911000000"
               },
               waybill_items: [
                 {
                   commodity_id: commodity.id,
                   quantity: 1,
                   unit_id: unit.id
                 }
               ]
             }
           },
           as: :json,
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response.dig("data", "waybill_items")).to be_present
      expect(json_response.dig("data", "waybill_transport", "vehicle_plate_no")).to eq("ABC-123")
    end
  end
end
