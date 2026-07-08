# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Transfer Requests", type: :request do
  let(:hub) { create(:cats_warehouse_hub) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:store1) { create(:cats_warehouse_store, warehouse: warehouse, name: "Store 1") }
  let(:store2) { create(:cats_warehouse_store, warehouse: warehouse, name: "Store 2") }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { create(:cats_core_unit_of_measure) }
  let(:storekeeper) { create(:cats_core_user, role_name: "Storekeeper") }
  let(:warehouse_manager) { create(:cats_core_user, role_name: "Warehouse Manager") }

  let(:source_stack) do
    create(:cats_warehouse_stack,
           store: store1,
           commodity: commodity,
           unit: unit,
           quantity: 100)
  end

  def auth_headers_for(user)
    { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" }
  end

  def create_reserved_transfer_request(**attrs)
    qty = attrs[:quantity] || 30
    tr = Cats::Warehouse::TransferRequest.create!(
      {
        source_store: store1,
        destination_store: store2,
        source_stack: source_stack,
        commodity: commodity,
        unit: attrs[:unit] || unit,
        quantity: qty,
        reason: "Test transfer",
        requested_by: storekeeper,
        warehouse: warehouse,
        status: "Pending",
        fulfilled_quantity: 0,
        rejected_quantity: 0,
        reserved_quantity: 0
      }.merge(attrs.except(:unit))
    )
    Cats::Warehouse::TransferRequestStockHold.reserve!(tr)
    tr.reload
  end

  def approve_tranche_params(qty, **extra)
    {
      quantity: qty,
      entered_unit_id: (extra[:unit] || unit).id,
      entered_quantity: qty
    }.merge(extra.except(:unit))
  end

  before do
    Cats::Warehouse::UserAssignment.create!(
      user: storekeeper,
      role_name: "Storekeeper",
      store: store1
    )

    Cats::Warehouse::UserAssignment.create!(
      user: warehouse_manager,
      role_name: "Warehouse Manager",
      warehouse: warehouse
    )
  end

  describe "POST /cats_warehouse/v1/transfer_requests" do
    it "allows storekeeper to create transfer request" do
      headers = auth_headers_for(storekeeper)

      payload = {
        source_stack_id: source_stack.id,
        destination_store_id: store2.id,
        quantity: 30,
        reason: "Need stock in Store 2"
      }

      post "/cats_warehouse/v1/transfer_requests", params: payload, headers: headers

      puts "Response: #{response.body}" if response.status != 201

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)

      expect(json["data"]["status"]).to eq("Pending")
      expect(json["data"]["quantity"]).to eq(30.0)
      expect(json["data"]["reason"]).to eq("Need stock in Store 2")
      expect(json["data"]["source_store"]["id"]).to eq(store1.id)
      expect(json["data"]["destination_store"]["id"]).to eq(store2.id)
      expect(json["data"]["reserved_quantity"]).to eq(30.0)

      balance = Cats::Warehouse::StockBalance.find_by(stack: source_stack, commodity: commodity, unit: unit)
      expect(balance.reserved_quantity).to eq(30.0)
      expect(balance.available_quantity).to eq(70.0)
    end

    it "rejects request if quantity exceeds available" do
      headers = auth_headers_for(storekeeper)

      payload = {
        source_stack_id: source_stack.id,
        destination_store_id: store2.id,
        quantity: 150,
        reason: "Need stock"
      }

      post "/cats_warehouse/v1/transfer_requests", params: payload, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["error"]["message"]).to include("exceeds available quantity")
    end
  end

  describe "GET /cats_warehouse/v1/transfer_requests" do
    let!(:transfer_request) do
      Cats::Warehouse::TransferRequest.create!(
        source_store: store1,
        destination_store: store2,
        source_stack: source_stack,
        commodity: commodity,
        unit: unit,
        quantity: 30,
        reason: "Test transfer",
        requested_by: storekeeper,
        warehouse: warehouse,
        status: "Pending"
      )
    end

    it "allows storekeeper to see their own requests" do
      headers = auth_headers_for(storekeeper)

      get "/cats_warehouse/v1/transfer_requests", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)

      expect(json["data"].length).to eq(1)
      expect(json["data"][0]["id"]).to eq(transfer_request.id)
    end

    it "allows warehouse manager to see all requests in their warehouse" do
      headers = auth_headers_for(warehouse_manager)

      get "/cats_warehouse/v1/transfer_requests", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)

      expect(json["data"].length).to eq(1)
      expect(json["data"][0]["id"]).to eq(transfer_request.id)
    end
  end

  describe "POST /cats_warehouse/v1/transfer_requests/:id/approve" do
    let!(:transfer_request) { create_reserved_transfer_request }

    it "allows warehouse manager to approve and execute transfer" do
      destination_stack = create(:cats_warehouse_stack,
                                 store: store2,
                                 commodity: commodity,
                                 unit: unit,
                                 quantity: 20)

      headers = auth_headers_for(warehouse_manager)

      payload = approve_tranche_params(30).merge(
        destination_stack_id: destination_stack.id,
        notes: "Approved"
      )

      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/approve", params: payload, headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)

      expect(json["data"]["status"]).to eq("Completed")

      # Verify quantities updated
      source_stack.reload
      destination_stack.reload
      expect(source_stack.quantity).to eq(70)
      expect(destination_stack.quantity).to eq(50)
    end

    it "rejects approval by storekeeper" do
      headers = auth_headers_for(storekeeper)

      payload = {
        notes: "Approved"
      }

      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/approve", params: payload, headers: headers

      expect(response).to have_http_status(:forbidden)
    end

    it "executes cross-store transfer with destination credit in destination stack unit (kg to mt)" do
      kg_unit = create(:cats_core_unit_of_measure, name: "Kilogram", abbreviation: "kg")
      mt_unit = create(:cats_core_unit_of_measure, name: "Metric Ton", abbreviation: "mt")
      source_stack.update!(unit: kg_unit, quantity: 100_000)

      Cats::Warehouse::UomConversion.create!(
        commodity_id: nil,
        from_unit_id: kg_unit.id,
        to_unit_id: mt_unit.id,
        multiplier: 0.001,
        active: true
      )

      destination_stack = create(:cats_warehouse_stack,
                                 store: store2,
                                 commodity: commodity,
                                 unit: mt_unit,
                                 quantity: 10)

      transfer_request = create_reserved_transfer_request(quantity: 25_000, unit: kg_unit)

      headers = auth_headers_for(warehouse_manager)
      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/approve",
           params: approve_tranche_params(25_000, unit: kg_unit).merge(
             destination_stack_id: destination_stack.id
           ),
           headers: headers

      expect(response).to have_http_status(:ok)

      source_stack.reload
      destination_stack.reload
      expect(source_stack.quantity).to eq(75_000)
      expect(destination_stack.quantity).to eq(35)
    end

    it "persists WM quantity and UOM overrides on approve" do
      kg_unit = create(:cats_core_unit_of_measure, name: "Kilogram", abbreviation: "kg")
      qt_unit = create(:cats_core_unit_of_measure, name: "Quintal", abbreviation: "qt")
      source_stack.update!(unit: kg_unit, quantity: 1000)

      Cats::Warehouse::UomConversion.create!(
        commodity_id: commodity.id,
        from_unit_id: qt_unit.id,
        to_unit_id: kg_unit.id,
        multiplier: 100,
        active: true
      )

      destination_stack = create(:cats_warehouse_stack,
                                 store: store2,
                                 commodity: commodity,
                                 unit: kg_unit,
                                 quantity: 0)

      transfer_request = create_reserved_transfer_request(quantity: 200, unit: kg_unit)

      headers = auth_headers_for(warehouse_manager)
      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/approve",
           params: {
             destination_stack_id: destination_stack.id,
             quantity: 200,
             entered_unit_id: qt_unit.id,
             entered_quantity: 2,
             package_count: 4
           },
           headers: headers

      expect(response).to have_http_status(:ok)

      transfer_request.reload
      source_stack.reload
      destination_stack.reload

      expect(transfer_request.quantity).to eq(200.0)
      expect(transfer_request.entered_unit_id).to eq(qt_unit.id)
      expect(transfer_request.entered_quantity).to eq(2.0)
      expect(transfer_request.package_count).to eq(4.0)
      expect(source_stack.quantity).to eq(800)
      expect(destination_stack.quantity).to eq(200)
    end

    it "auto-selects an existing destination commodity stack when units differ" do
      kg_unit = create(:cats_core_unit_of_measure, name: "Kilogram", abbreviation: "kg")
      mt_unit = create(:cats_core_unit_of_measure, name: "Metric Ton", abbreviation: "mt")
      source_stack.update!(unit: kg_unit, quantity: 100_000)

      Cats::Warehouse::UomConversion.create!(
        commodity_id: nil,
        from_unit_id: kg_unit.id,
        to_unit_id: mt_unit.id,
        multiplier: 0.001,
        active: true
      )

      destination_stack = create(:cats_warehouse_stack,
                                 store: store2,
                                 commodity: commodity,
                                 unit: mt_unit,
                                 quantity: 10)

      transfer_request = create_reserved_transfer_request(quantity: 25_000, unit: kg_unit)

      headers = auth_headers_for(warehouse_manager)
      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/approve",
           params: approve_tranche_params(25_000, unit: kg_unit),
           headers: headers

      expect(response).to have_http_status(:ok)

      destination_stack.reload
      expect(destination_stack.quantity).to eq(35)
      expect(transfer_request.reload.destination_stack_id).to eq(destination_stack.id)
    end

    it "keeps request pending after partial fulfillment until fully allocated" do
      source_stack.update!(quantity: 100)
      headers = auth_headers_for(warehouse_manager)

      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/approve",
           params: { quantity: 20, entered_unit_id: unit.id, entered_quantity: 20 },
           headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["data"]["status"]).to eq("Pending")
      expect(json["data"]["fulfilled_quantity"]).to eq(20.0)
      expect(json["data"]["remaining_quantity"]).to eq(10.0)

      source_stack.reload
      expect(source_stack.quantity).to eq(80)

      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/approve",
           params: { quantity: 10, entered_unit_id: unit.id, entered_quantity: 10 },
           headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["data"]["status"]).to eq("Completed")
      expect(json["data"]["fulfilled_quantity"]).to eq(30.0)
      expect(json["data"]["remaining_quantity"]).to eq(0.0)
    end

    it "allows rejecting remaining quantity after partial fulfillment" do
      source_stack.update!(quantity: 100)
      headers = auth_headers_for(warehouse_manager)

      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/approve",
           params: { quantity: 15, entered_unit_id: unit.id, entered_quantity: 15 },
           headers: headers

      expect(response).to have_http_status(:ok)

      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/reject",
           params: { notes: "Destination store full" },
           headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["data"]["status"]).to eq("Completed")
      expect(json["data"]["fulfilled_quantity"]).to eq(15.0)
      expect(json["data"]["rejected_quantity"]).to eq(15.0)
      expect(json["data"]["remaining_quantity"]).to eq(0.0)

      balance = Cats::Warehouse::StockBalance.find_by(stack: source_stack, commodity: commodity, unit: unit)
      expect(balance.reserved_quantity).to eq(0.0)
      expect(balance.available_quantity).to eq(source_stack.quantity)
    end

    it "releases reservation on reject without moving stock" do
      tr = create_reserved_transfer_request(quantity: 10)
      source_stack.update!(quantity: 100)
      balance = Cats::Warehouse::StockBalance.find_by!(stack: source_stack, commodity: commodity, unit: unit)
      expect(balance.reserved_quantity).to eq(10.0)

      headers = auth_headers_for(warehouse_manager)
      post "/cats_warehouse/v1/transfer_requests/#{tr.id}/reject",
           params: { notes: "Not needed" },
           headers: headers

      expect(response).to have_http_status(:ok)
      tr.reload
      source_stack.reload
      balance.reload
      expect(tr.status).to eq("Rejected")
      expect(tr.reserved_quantity).to eq(0.0)
      expect(source_stack.quantity).to eq(100.0)
      expect(balance.reserved_quantity).to eq(0.0)
      expect(balance.available_quantity).to eq(100.0)
    end

    it "returns allocations with stack details on show" do
      tr = create_reserved_transfer_request(quantity: 10)
      dest = create(:cats_warehouse_stack, store: store2, commodity: commodity, unit: unit, quantity: 0)
      headers = auth_headers_for(warehouse_manager)

      post "/cats_warehouse/v1/transfer_requests/#{tr.id}/approve",
           params: approve_tranche_params(5).merge(destination_stack_id: dest.id),
           headers: headers
      expect(response).to have_http_status(:ok)

      get "/cats_warehouse/v1/transfer_requests/#{tr.id}", headers: headers
      json = JSON.parse(response.body)
      allocation = json["data"]["allocations"].first
      expect(allocation["action"]).to eq("fulfillment")
      expect(allocation["destination_stack"]["code"]).to eq(dest.code)
      expect(allocation["source_stack"]["code"]).to eq(source_stack.code)
    end

    it "rejects approval when no conversion exists between source and destination units" do
      kg_unit = create(:cats_core_unit_of_measure, name: "Kilogram", abbreviation: "kg")
      mt_unit = create(:cats_core_unit_of_measure, name: "Metric Ton", abbreviation: "mt")
      source_stack.update!(unit: kg_unit, quantity: 100_000)

      destination_stack = create(:cats_warehouse_stack,
                                 store: store2,
                                 commodity: commodity,
                                 unit: mt_unit,
                                 quantity: 10)

      transfer_request = create_reserved_transfer_request(quantity: 25_000, unit: kg_unit)

      headers = auth_headers_for(warehouse_manager)
      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/approve",
           params: approve_tranche_params(25_000, unit: kg_unit).merge(
             destination_stack_id: destination_stack.id
           ),
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["error"]["message"]).to match(/No unit conversion/i)
    end
  end

  describe "POST /cats_warehouse/v1/transfer_requests/:id/reject" do
    let!(:transfer_request) do
      Cats::Warehouse::TransferRequest.create!(
        source_store: store1,
        destination_store: store2,
        source_stack: source_stack,
        commodity: commodity,
        unit: unit,
        quantity: 30,
        reason: "Test transfer",
        requested_by: storekeeper,
        warehouse: warehouse,
        status: "Pending"
      )
    end

    it "allows warehouse manager to reject request" do
      headers = auth_headers_for(warehouse_manager)

      payload = {
        notes: "Not enough space in destination store"
      }

      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/reject", params: payload, headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)

      expect(json["data"]["status"]).to eq("Rejected")
      expect(json["data"]["review_notes"]).to eq("Not enough space in destination store")

      # Verify source stack quantity unchanged
      source_stack.reload
      expect(source_stack.quantity).to eq(100)
    end

    it "requires rejection notes" do
      headers = auth_headers_for(warehouse_manager)

      post "/cats_warehouse/v1/transfer_requests/#{transfer_request.id}/reject", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["error"]["message"]).to include("notes are required")
    end
  end
end
