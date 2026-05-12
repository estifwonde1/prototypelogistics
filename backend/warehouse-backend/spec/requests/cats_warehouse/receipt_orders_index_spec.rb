# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GET /cats_warehouse/v1/receipt_orders warehouse filter + RA visibility", type: :request do
  def auth_headers_for(user)
    { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" }
  end

  let(:hub) { create(:cats_warehouse_hub) }
  let(:wh_secondary) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:wh_target) { create(:cats_warehouse_warehouse, hub: hub) }
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
      reference_no: "RO-IDX-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let(:receipt_line) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: receipt_order,
      commodity: commodity,
      unit: unit,
      quantity: 100,
      line_reference_no: "RL-IDX-#{SecureRandom.hex(4)}"
    )
  end

  before do
    receipt_line
    Cats::Warehouse::UserAssignment.create!(user: wm, warehouse: wh_secondary, role_name: "Warehouse Manager")
    Cats::Warehouse::UserAssignment.create!(user: wm, warehouse: wh_target, role_name: "Warehouse Manager")
  end

  it "returns receipt orders linked only by a non-cancelled ReceiptAuthorization at that warehouse" do
    Cats::Warehouse::ReceiptAuthorization.create!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      warehouse: wh_target,
      transporter: transporter,
      authorized_quantity: 5,
      driver_name: "Driver",
      driver_id_number: "ID-1",
      truck_plate_number: "AA-1",
      waybill_number: "WB-IDX-#{SecureRandom.hex(4)}",
      status: Cats::Warehouse::ReceiptAuthorization::PENDING,
      reference_no: "RA-IDX-#{SecureRandom.hex(4)}",
      created_by: actor
    )

    get "/cats_warehouse/v1/receipt_orders",
        params: { warehouse_id: wh_target.id },
        headers: auth_headers_for(wm)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["success"]).to eq(true)
    ids = (body["data"] || []).map { |row| row["id"] || row.with_indifferent_access[:id] }
    expect(ids).to include(receipt_order.id),
                   "Expected RO #{receipt_order.id} in #{ids.inspect}"
  end

  it "returns hub-assigned receipt orders for the assigned hub manager even when the order is still draft" do
    hub_manager = create(:cats_core_user, role_name: "Hub Manager")
    Cats::Warehouse::UserAssignment.create!(user: hub_manager, hub: hub, role_name: "Hub Manager")

    draft_order = Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:draft],
      reference_no: "RO-HUB-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )

    line = Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: draft_order,
      commodity: commodity,
      unit: unit,
      quantity: 100,
      destination_hub_id: hub.id,
      line_reference_no: "RL-HUB-#{SecureRandom.hex(4)}"
    )

    Cats::Warehouse::ReceiptOrderAssignment.create!(
      receipt_order: draft_order,
      receipt_order_line: line,
      hub: hub,
      assigned_by: actor,
      assigned_to: hub_manager,
      quantity: 100,
      status: "pending"
    )

    get "/cats_warehouse/v1/receipt_orders",
        params: { hub_id: hub.id },
        headers: auth_headers_for(hub_manager)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    ids = (body["data"] || []).map { |row| row["id"] || row.with_indifferent_access[:id] }
    expect(ids).to include(draft_order.id),
                   "Expected hub-assigned RO #{draft_order.id} in #{ids.inspect}"
  end
end
