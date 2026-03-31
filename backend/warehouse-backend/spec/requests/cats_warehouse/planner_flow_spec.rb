require "rails_helper"
require_relative "../../factories/core"
require_relative "../../factories/warehouse"

RSpec.describe "Cats::Warehouse planner flow", type: :request do
  let!(:location_source) { create(:cats_core_location, code: "PLN-SRC", name: "Planner Source") }
  let!(:location_destination) { create(:cats_core_location, code: "PLN-DST", name: "Planner Destination") }
  let!(:hub) { Cats::Warehouse::Hub.create!(location: location_source, name: "Planner Hub") }
  let!(:warehouse) do
    Cats::Warehouse::Warehouse.create!(
      location: location_source,
      hub: hub,
      code: "PLN-WH",
      name: "Planner Warehouse",
      managed_under: "Hub",
      ownership_type: "self_owned"
    )
  end
  let!(:store) do
    Cats::Warehouse::Store.create!(
      warehouse: warehouse,
      code: "PLN-ST",
      name: "Planner Store",
      length: 10,
      width: 8,
      height: 4,
      usable_space: 320,
      available_space: 320,
      temporary: false,
      has_gangway: false
    )
  end
  let!(:commodity) { create(:cats_core_commodity, name: "Planner Commodity", batch_no: "PLN-BATCH") }
  let!(:unit) { commodity.unit_of_measure }
  let!(:transporter) do
    Cats::Core::Transporter.create!(
      code: "PLN-TR",
      name: "Planner Transporter",
      address: "Addis",
      contact_phone: "0911111119"
    )
  end

  let!(:planner) { create(:cats_core_user, role_name: "Dispatch Planner") }
  let!(:officer) { create(:cats_core_user, role_name: "Hub Dispatch Officer") }
  let!(:approver) { create(:cats_core_user, role_name: "Hub Dispatch Approver") }

  let(:planner_headers) { { "Authorization" => "Bearer #{planner.signed_id(purpose: "auth", expires_in: 1.hour)}" } }
  let(:officer_headers) { { "Authorization" => "Bearer #{officer.signed_id(purpose: "auth", expires_in: 1.hour)}" } }
  let(:approver_headers) { { "Authorization" => "Bearer #{approver.signed_id(purpose: "auth", expires_in: 1.hour)}" } }

  before do
    Cats::Warehouse::UserAssignment.create!(user: officer, hub: hub, role_name: "Hub Dispatch Officer")
    Cats::Warehouse::UserAssignment.create!(user: approver, hub: hub, role_name: "Hub Dispatch Approver")
  end

  it "supports planner authorization lifecycle and dispatch gating" do
    post "/cats_warehouse/v1/dispatch_plans",
         params: {
           payload: {
             reference_no: "DP-PLN-001",
             description: "Planner flow",
             prepared_by_id: planner.id
           }
         },
         as: :json,
         headers: planner_headers
    expect(response).to have_http_status(:created)
    dispatch_plan_id = json_response.dig("data", "id")

    post "/cats_warehouse/v1/dispatch_plan_items",
         params: {
           payload: {
             reference_no: "DPI-PLN-001",
             dispatch_plan_id: dispatch_plan_id,
             source_id: location_source.id,
             destination_id: location_destination.id,
             commodity_id: commodity.id,
             quantity: 25,
             unit_id: unit.id
           }
         },
         as: :json,
         headers: planner_headers
    expect(response).to have_http_status(:created)
    item_id = json_response.dig("data", "id")

    post "/cats_warehouse/v1/dispatches",
         params: {
           payload: {
             reference_no: "DSP-PLN-BLOCKED",
             dispatch_plan_item_id: item_id,
             transporter_id: transporter.id,
             plate_no: "AA-77777",
             driver_name: "Driver One",
             driver_phone: "0912000001",
             quantity: 25,
             unit_id: unit.id,
             prepared_by_id: planner.id
           }
         },
         as: :json,
         headers: planner_headers
    expect(response).to have_http_status(:unprocessable_entity)

    post "/cats_warehouse/v1/hub_authorizations",
         params: {
           payload: {
             dispatch_plan_item_id: item_id,
             store_id: store.id,
             quantity: 25,
             unit_id: unit.id,
             authorization_type: "Source",
             authorized_by_id: officer.id
           }
         },
         as: :json,
         headers: officer_headers
    expect(response).to have_http_status(:created)

    post "/cats_warehouse/v1/hub_authorizations",
         params: {
           payload: {
             dispatch_plan_item_id: item_id,
             store_id: store.id,
             quantity: 25,
             unit_id: unit.id,
             authorization_type: "Destination",
             authorized_by_id: approver.id
           }
         },
         as: :json,
         headers: approver_headers
    expect(response).to have_http_status(:created)

    post "/cats_warehouse/v1/dispatches",
         params: {
           payload: {
             reference_no: "DSP-PLN-OK",
             dispatch_plan_item_id: item_id,
             transporter_id: transporter.id,
             plate_no: "AA-88888",
             driver_name: "Driver Two",
             driver_phone: "0912000002",
             quantity: 25,
             unit_id: unit.id,
             prepared_by_id: planner.id
           }
         },
         as: :json,
         headers: planner_headers
    expect(response).to have_http_status(:created)
  end
end
