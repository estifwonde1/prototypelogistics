# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GET /cats_warehouse/v1/dashboard/warehouse_manager", type: :request do
  def auth_headers_for(user)
    { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" }
  end

  let(:hub) { create(:cats_warehouse_hub) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:other_warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
  let(:actor) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:commodity) { create(:cats_core_commodity, received_quantity: 100) }
  let(:unit) { commodity.unit_of_measure }

  before do
    Cats::Warehouse::UserAssignment.create!(
      user: wm,
      warehouse: warehouse,
      role_name: "Warehouse Manager"
    )
    Cats::Warehouse::UserAssignment.create!(
      user: wm,
      warehouse: other_warehouse,
      role_name: "Warehouse Manager"
    )
  end

  it "returns 403 when warehouse is not accessible" do
    stranger = create(:cats_core_user, role_name: "Warehouse Manager")
    Cats::Warehouse::UserAssignment.create!(
      user: stranger,
      warehouse: other_warehouse,
      role_name: "Warehouse Manager"
    )

    get "/cats_warehouse/v1/dashboard/warehouse_manager",
        params: { warehouse_id: warehouse.id },
        headers: auth_headers_for(stranger)

    expect(response).to have_http_status(:forbidden)
  end

  it "returns lightweight summary counts and previews without nested payloads" do
    draft_ro = Cats::Warehouse::ReceiptOrder.create!(
      warehouse: warehouse,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:draft],
      reference_no: "RO-WM-DASH-#{SecureRandom.hex(3)}",
      received_date: Date.current,
      name: "Supplier Alpha"
    )
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: draft_ro,
      commodity: commodity,
      unit: unit,
      quantity: 10,
      line_reference_no: "RL-WM-#{SecureRandom.hex(3)}"
    )

    draft_do = Cats::Warehouse::DispatchOrder.create!(
      warehouse: warehouse,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:draft],
      reference_no: "DO-WM-DASH-#{SecureRandom.hex(3)}",
      dispatched_date: Date.current + 3.days,
      name: "Regional Hub B"
    )

    get "/cats_warehouse/v1/dashboard/warehouse_manager",
        params: { warehouse_id: warehouse.id },
        headers: auth_headers_for(wm)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["success"]).to eq(true)

    data = body["data"]
    expect(data["receipt_orders"]).to be_a(Hash)
    expect(data["dispatch_orders"]).to be_a(Hash)
    expect(data["pending_receipt_orders"]).to be_an(Array)
    expect(data["pending_dispatch_orders"]).to be_an(Array)
    expect(data["stock_preview"]).to be_an(Array)
    expect(data["lost_commodity_records"]).to be_an(Array)

    pending_receipt = data["pending_receipt_orders"].find { |row| row["id"] == draft_ro.id }
    expect(pending_receipt).to include(
      "reference_no" => draft_ro.reference_no,
      "source_name" => "Supplier Alpha"
    )
    expect(pending_receipt).not_to have_key("receipt_order_lines")
    expect(pending_receipt).not_to have_key("receipt_order_assignments")

    pending_dispatch = data["pending_dispatch_orders"].find { |row| row["id"] == draft_do.id }
    expect(pending_dispatch).to include(
      "destination_name" => "Regional Hub B"
    )
    expect(pending_dispatch).not_to have_key("dispatch_order_lines")
  end
end
