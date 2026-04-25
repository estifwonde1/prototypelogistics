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

    it "allows warehouse manager to approve and execute transfer" do
      destination_stack = create(:cats_warehouse_stack,
                                 store: store2,
                                 commodity: commodity,
                                 unit: unit,
                                 quantity: 20)

      headers = auth_headers_for(warehouse_manager)

      payload = {
        destination_stack_id: destination_stack.id,
        notes: "Approved"
      }

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
