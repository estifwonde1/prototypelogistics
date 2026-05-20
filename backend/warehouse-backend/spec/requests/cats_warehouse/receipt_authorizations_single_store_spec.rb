# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Single-store receipt authorization routing", type: :request do
  def auth_headers_for(user)
    { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" }
  end

  let(:hub) { create(:cats_warehouse_hub) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let!(:sole_store) { create(:cats_warehouse_store, warehouse: warehouse, name: "Only Store") }
  let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
  let(:hm) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:sk1) { create(:cats_core_user, role_name: "Storekeeper") }
  let(:sk2) { create(:cats_core_user, role_name: "Storekeeper") }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { commodity.unit_of_measure }
  let(:transporter) { create(:cats_core_transporter) }

  let(:receipt_order) do
    Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: hm,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-SS-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let(:receipt_line) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: receipt_order,
      commodity: commodity,
      unit: unit,
      quantity: 100,
      line_reference_no: "RL-SS-#{SecureRandom.hex(4)}"
    )
  end

  let!(:hub_assignment) do
    Cats::Warehouse::ReceiptOrderAssignment.create!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      hub_id: hub.id,
      warehouse_id: warehouse.id,
      assigned_by: hm,
      quantity: 50,
      status: "assigned"
    )
  end

  def ra_payload(**extra)
    {
      payload: {
        receipt_order_id: receipt_order.id,
        receipt_order_assignment_id: hub_assignment.id,
        receipt_order_line_id: receipt_line.id,
        transporter_name: transporter.name,
        authorized_quantity: 10,
        driver_name: "Driver",
        driver_id_number: "ID-1",
        truck_plate_number: "AA-SS-1",
        waybill_number: "WB-#{SecureRandom.hex(4)}"
      }.merge(extra)
    }
  end

  before do
    receipt_line
    Cats::Warehouse::UserAssignment.create!(user: wm, warehouse: warehouse, role_name: "Warehouse Manager")
    Cats::Warehouse::UserAssignment.create!(user: hm, hub: hub, role_name: "Hub Manager")
    Cats::Warehouse::UserAssignment.create!(user: sk1, warehouse: warehouse, role_name: "Storekeeper")
    Cats::Warehouse::UserAssignment.create!(user: sk2, warehouse: warehouse, role_name: "Storekeeper")
    allow(Cats::Warehouse::NotificationFanout).to receive(:deliver)
  end

  it "broadcasts to all storekeepers and skips WM created notification" do
    post "/cats_warehouse/v1/receipt_authorizations",
         params: ra_payload,
         headers: auth_headers_for(hm),
         as: :json

    expect(response).to have_http_status(:created)
    body = JSON.parse(response.body)
    ra_id = body.dig("data", "id")

    expect(body.dig("data", "direct_to_storekeepers")).to eq(true)
    expect(body.dig("data", "awaiting_storekeeper_assignment")).to eq(false)
    expect(body.dig("data", "store_id")).to eq(sole_store.id)

    expect(Cats::Warehouse::NotificationFanout).to have_received(:deliver).with(
      "receipt_authorization.broadcast_to_storekeepers",
      hash_including(
        receipt_authorization_id: ra_id,
        storekeeper_user_ids: match_array([sk1.id, sk2.id])
      )
    )
    expect(Cats::Warehouse::NotificationFanout).not_to have_received(:deliver).with(
      "receipt_authorization.created",
      anything
    )

    get "/cats_warehouse/v1/receipt_authorizations",
        headers: auth_headers_for(sk1),
        as: :json
    ids_sk1 = JSON.parse(response.body).fetch("data").map { |row| row["id"] }
    expect(ids_sk1).to include(ra_id)

    get "/cats_warehouse/v1/receipt_authorizations",
        headers: auth_headers_for(sk2),
        as: :json
    ids_sk2 = JSON.parse(response.body).fetch("data").map { |row| row["id"] }
    expect(ids_sk2).to include(ra_id)

    post "/cats_warehouse/v1/receipt_authorizations/#{ra_id}/assign_storekeeper",
         params: { payload: { storekeeper_user_id: sk1.id } },
         headers: auth_headers_for(wm),
         as: :json

    expect(response).to have_http_status(:forbidden)
  end

  context "when warehouse has multiple stores" do
    let!(:second_store) { create(:cats_warehouse_store, warehouse: warehouse, name: "Second Store") }

    it "requires WM assignment before storekeepers see the RA" do
      post "/cats_warehouse/v1/receipt_authorizations",
           params: ra_payload,
           headers: auth_headers_for(hm),
           as: :json

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      ra_id = body.dig("data", "id")

      expect(body.dig("data", "direct_to_storekeepers")).to eq(false)
      expect(body.dig("data", "awaiting_storekeeper_assignment")).to eq(true)

      expect(Cats::Warehouse::NotificationFanout).to have_received(:deliver).with(
        "receipt_authorization.created",
        hash_including(receipt_authorization_id: ra_id)
      )
      expect(Cats::Warehouse::NotificationFanout).not_to have_received(:deliver).with(
        "receipt_authorization.broadcast_to_storekeepers",
        anything
      )

      get "/cats_warehouse/v1/receipt_authorizations",
          headers: auth_headers_for(sk1),
          as: :json
      expect(JSON.parse(response.body).fetch("data").map { |row| row["id"] }).not_to include(ra_id)

      post "/cats_warehouse/v1/receipt_authorizations/#{ra_id}/assign_storekeeper",
           params: { payload: { storekeeper_user_id: sk1.id } },
           headers: auth_headers_for(wm),
           as: :json
      expect(response).to have_http_status(:ok)

      get "/cats_warehouse/v1/receipt_authorizations",
          headers: auth_headers_for(sk1),
          as: :json
      expect(JSON.parse(response.body).fetch("data").map { |row| row["id"] }).to include(ra_id)
    end
  end

  it "claims the RA for the first storekeeper who records an inspection" do
    ra = Cats::Warehouse::ReceiptAuthorizationService.new(
      receipt_order:            receipt_order,
      actor:                    hm,
      store:                    nil,
      authorized_quantity:      10,
      driver_name:              "Driver",
      driver_id_number:         "ID-1",
      truck_plate_number:       "AA-CLAIM",
      transporter:              transporter,
      waybill_number:           "WB-CLAIM-#{SecureRandom.hex(4)}",
      receipt_order_assignment: hub_assignment,
      receipt_order_line:       receipt_line
    ).call

    expect(ra.assigned_storekeeper_id).to be_nil

    Cats::Warehouse::InspectionCreator.new(
      warehouse:                 warehouse,
      inspected_on:              Date.current,
      inspector:                 sk1,
      items:                     [{ commodity_id: commodity.id, unit_id: unit.id, quantity_received: 5.0, quality_status: "Good" }],
      receipt_order:             receipt_order,
      receipt_authorization_id:  ra.id,
      status:                    "draft"
    ).call

    ra.reload
    expect(ra.assigned_storekeeper_id).to eq(sk1.id)

    scope_sk2 = Cats::Warehouse::ReceiptAuthorizationPolicy::Scope.new(
      sk2,
      Cats::Warehouse::ReceiptAuthorization.all
    ).resolve
    expect(scope_sk2.where(id: ra.id)).not_to exist
  end
end
