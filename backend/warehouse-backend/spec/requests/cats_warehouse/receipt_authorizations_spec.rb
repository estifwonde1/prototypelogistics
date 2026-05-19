# frozen_string_literal: true

require "rails_helper"

RSpec.describe "POST /cats_warehouse/v1/receipt_authorizations", type: :request do
  def auth_headers_for(user)
    { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" }
  end

  let(:location) { create(:cats_core_location) }
  let(:standalone_warehouse) { create(:cats_warehouse_warehouse, hub: nil, location: location) }
  let(:hub) { create(:cats_warehouse_hub, location: create(:cats_core_location, code: "HUB-RA", name: "Hub RA")) }
  let(:hub_warehouse) { create(:cats_warehouse_warehouse, hub: hub, location: hub.location) }
  let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
  let(:hm) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:actor) { create(:cats_core_user, role_name: "Officer") }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { commodity.unit_of_measure }
  let(:transporter) { create(:cats_core_transporter) }

  let(:standalone_receipt_order) do
    Cats::Warehouse::ReceiptOrder.create!(
      warehouse: standalone_warehouse,
      hub_id: nil,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-STANDALONE-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let(:standalone_line) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: standalone_receipt_order,
      commodity: commodity,
      unit: unit,
      quantity: 100,
      line_reference_no: "RL-STANDALONE-#{SecureRandom.hex(4)}"
    )
  end

  let(:hub_receipt_order) do
    Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-HUB-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let(:hub_line) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: hub_receipt_order,
      commodity: commodity,
      unit: unit,
      quantity: 100,
      line_reference_no: "RL-HUB-#{SecureRandom.hex(4)}"
    )
  end

  let(:hub_assignment) do
    Cats::Warehouse::ReceiptOrderAssignment.create!(
      receipt_order: hub_receipt_order,
      receipt_order_line: hub_line,
      hub_id: hub.id,
      warehouse_id: hub_warehouse.id,
      assigned_by: hm,
      quantity: 50,
      status: "assigned"
    )
  end

  def ra_payload(receipt_order_id:, **extra)
    {
      payload: {
        receipt_order_id: receipt_order_id,
        transporter_name: transporter.name,
        authorized_quantity: 10,
        driver_name: "Driver",
        driver_id_number: "ID-1",
        truck_plate_number: "AA-RA-1",
        waybill_number: "WB-#{SecureRandom.hex(4)}"
      }.merge(extra)
    }
  end

  before do
    standalone_line
    hub_line
    hub_assignment
    Cats::Warehouse::UserAssignment.create!(
      user: wm,
      warehouse: standalone_warehouse,
      role_name: "Warehouse Manager"
    )
    Cats::Warehouse::UserAssignment.create!(
      user: wm,
      warehouse: hub_warehouse,
      role_name: "Warehouse Manager"
    )
    Cats::Warehouse::UserAssignment.create!(user: hm, hub: hub, role_name: "Hub Manager")
    allow(Cats::Warehouse::NotificationFanout).to receive(:deliver)
  end

  it "allows Warehouse Manager to create RA for standalone warehouse receipt order" do
    post "/cats_warehouse/v1/receipt_authorizations",
         params: ra_payload(
           receipt_order_id: standalone_receipt_order.id,
           warehouse_id: standalone_warehouse.id,
           receipt_order_line_id: standalone_line.id
         ),
         headers: auth_headers_for(wm),
         as: :json

    expect(response).to have_http_status(:created)
    body = JSON.parse(response.body)
    expect(body["success"]).to eq(true)
    expect(body.dig("data", "warehouse_id")).to eq(standalone_warehouse.id)
  end

  it "forbids Warehouse Manager from creating RA for hub-backed warehouse" do
    post "/cats_warehouse/v1/receipt_authorizations",
         params: ra_payload(
           receipt_order_id: hub_receipt_order.id,
           receipt_order_assignment_id: hub_assignment.id
         ),
         headers: auth_headers_for(wm),
         as: :json

    expect(response).to have_http_status(:forbidden)
  end

  it "allows Hub Manager to create RA for hub warehouse assignment" do
    post "/cats_warehouse/v1/receipt_authorizations",
         params: ra_payload(
           receipt_order_id: hub_receipt_order.id,
           receipt_order_assignment_id: hub_assignment.id
         ),
         headers: auth_headers_for(hm),
         as: :json

    expect(response).to have_http_status(:created)
    body = JSON.parse(response.body)
    expect(body.dig("data", "warehouse_id")).to eq(hub_warehouse.id)
  end
end

RSpec.describe "GET /cats_warehouse/v1/receipt_authorizations", type: :request do
  def auth_headers_for(user)
    { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" }
  end

  let(:hub) { create(:cats_warehouse_hub) }
  let(:wh_a) { create(:cats_warehouse_warehouse, hub: hub, name: "Bole Central Warehouse") }
  let(:wh_b) { create(:cats_warehouse_warehouse, hub: hub, name: "asco") }
  let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
  let(:actor) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { commodity.unit_of_measure }
  let(:transporter) { create(:cats_core_transporter) }

  let(:receipt_order) do
    Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:assigned],
      reference_no: "RO-INDEX-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let(:receipt_line) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: receipt_order,
      commodity: commodity,
      unit: unit,
      quantity: 100,
      line_reference_no: "RL-INDEX-#{SecureRandom.hex(4)}"
    )
  end

  def build_ra(warehouse:)
    Cats::Warehouse::ReceiptAuthorization.create!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      warehouse: warehouse,
      transporter: transporter,
      authorized_quantity: 10,
      driver_name: "Driver",
      driver_id_number: "ID-1",
      truck_plate_number: "AA-1",
      waybill_number: "WB-INDEX-#{SecureRandom.hex(4)}",
      status: Cats::Warehouse::ReceiptAuthorization::PENDING,
      reference_no: "RA-INDEX-#{SecureRandom.hex(4)}",
      created_by: actor
    )
  end

  before do
    receipt_line
    Cats::Warehouse::UserAssignment.create!(user: wm, warehouse: wh_a, role_name: "Warehouse Manager")
    Cats::Warehouse::UserAssignment.create!(user: wm, warehouse: wh_b, role_name: "Warehouse Manager")
  end

  it "scopes receipt-order RAs to the active warehouse for warehouse managers" do
    ra_a = build_ra(warehouse: wh_a)
    ra_b = build_ra(warehouse: wh_b)

    get "/cats_warehouse/v1/receipt_authorizations",
        params: { receipt_order_id: receipt_order.id, warehouse_id: wh_a.id },
        headers: auth_headers_for(wm),
        as: :json

    expect(response).to have_http_status(:ok)
    ids = JSON.parse(response.body).fetch("data").map { |row| row["id"] }
    expect(ids).to contain_exactly(ra_a.id)
    expect(ids).not_to include(ra_b.id)
  end
end
