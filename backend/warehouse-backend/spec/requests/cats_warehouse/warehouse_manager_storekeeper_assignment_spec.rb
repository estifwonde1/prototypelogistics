# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Warehouse Manager Storekeeper Assignment", type: :request do
  let(:hub) { create(:cats_warehouse_hub) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:store1) { create(:cats_warehouse_store, warehouse: warehouse, name: "Store 1") }
  let(:store2) { create(:cats_warehouse_store, warehouse: warehouse, name: "Store 2") }
  let(:store3) { create(:cats_warehouse_store, warehouse: warehouse, name: "Store 3") }
  let(:warehouse_manager) { create(:cats_core_user, role_name: "Warehouse Manager") }
  let(:storekeeper) { create(:cats_core_user, role_name: "Storekeeper") }

  def auth_headers_for(user)
    { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" }
  end

  before do
    # Assign warehouse manager to the warehouse
    Cats::Warehouse::UserAssignment.create!(
      user: warehouse_manager,
      role_name: "Warehouse Manager",
      warehouse: warehouse
    )

    # Assign storekeeper at warehouse level initially
    Cats::Warehouse::UserAssignment.create!(
      user: storekeeper,
      role_name: "Storekeeper",
      warehouse: warehouse
    )

    # Force creation of stores
    store1
    store2
    store3
  end

  describe "GET /cats_warehouse/v1/stores/storekeepers" do
    it "returns all storekeepers in the warehouse manager's warehouse" do
      headers = auth_headers_for(warehouse_manager)
      get "/cats_warehouse/v1/stores/storekeepers", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      
      expect(json["data"]["storekeepers"].length).to eq(1)
      expect(json["data"]["storekeepers"][0]["id"]).to eq(storekeeper.id)
      expect(json["data"]["storekeepers"][0]["assignment_type"]).to eq("warehouse")
      expect(json["data"]["storekeepers"][0]["warehouse_id"]).to eq(warehouse.id)
      expect(json["data"]["storekeepers"][0]["assigned_store_ids"]).to be_empty
    end
  end

  describe "POST /cats_warehouse/v1/stores/:id/assign_storekeeper" do
    it "allows warehouse manager to assign storekeeper to specific stores" do
      headers = auth_headers_for(warehouse_manager)
      
      payload = {
        user_id: storekeeper.id,
        store_ids: [store1.id, store2.id]
      }

      post "/cats_warehouse/v1/stores/#{store1.id}/assign_storekeeper", params: payload, headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      
      expect(json["data"]["assignment_type"]).to eq("store")
      expect(json["data"]["store_ids"]).to contain_exactly(store1.id, store2.id)

      # Verify the storekeeper now only sees assigned stores
      storekeeper_headers = auth_headers_for(storekeeper)
      get "/cats_warehouse/v1/stores", headers: storekeeper_headers
      
      stores_json = JSON.parse(response.body)
      store_ids = stores_json["data"].map { |s| s["id"] }
      expect(store_ids).to contain_exactly(store1.id, store2.id)
    end

    it "allows warehouse manager to reset storekeeper to warehouse-level access" do
      # Ensure stores exist
      store1
      store2
      store3
      
      # First assign to specific stores
      Cats::Warehouse::UserAssignment.where(user_id: storekeeper.id, role_name: "Storekeeper").delete_all
      Cats::Warehouse::UserAssignment.create!(user: storekeeper, role_name: "Storekeeper", store: store1)

      headers = auth_headers_for(warehouse_manager)
      
      payload = {
        user_id: storekeeper.id
        # Don't send store_ids at all to indicate warehouse-level
      }

      # Warehouse manager can access all stores in their warehouse, so use store1
      post "/cats_warehouse/v1/stores/#{store1.id}/assign_storekeeper", params: payload, headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      
      expect(json["data"]["assignment_type"]).to eq("warehouse")

      # Verify the storekeeper now sees all stores
      storekeeper_headers = auth_headers_for(storekeeper)
      get "/cats_warehouse/v1/stores", headers: storekeeper_headers
      
      stores_json = JSON.parse(response.body)
      store_ids = stores_json["data"].map { |s| s["id"] }
      expect(store_ids).to contain_exactly(store1.id, store2.id, store3.id)
    end

    it "rejects assignment if user is not a storekeeper" do
      non_storekeeper = create(:cats_core_user, role_name: "Officer")
      
      headers = auth_headers_for(warehouse_manager)
      
      payload = {
        user_id: non_storekeeper.id,
        store_ids: [store1.id]
      }

      post "/cats_warehouse/v1/stores/#{store1.id}/assign_storekeeper", params: payload, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["error"]["message"]).to include("not a Storekeeper")
    end
  end

  describe "Store serializer with assigned_storekeepers" do
    it "includes warehouse-level storekeepers on all stores" do
      headers = auth_headers_for(warehouse_manager)
      get "/cats_warehouse/v1/stores/#{store1.id}", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      
      expect(json["data"]["assigned_storekeepers"].length).to eq(1)
      expect(json["data"]["assigned_storekeepers"][0]["id"]).to eq(storekeeper.id)
    end

    it "includes store-level storekeepers only on their assigned stores" do
      # Change to store-level assignment
      Cats::Warehouse::UserAssignment.where(user_id: storekeeper.id, role_name: "Storekeeper").delete_all
      Cats::Warehouse::UserAssignment.create!(user: storekeeper, role_name: "Storekeeper", store: store1)

      headers = auth_headers_for(warehouse_manager)
      
      # Store 1 should have the storekeeper
      get "/cats_warehouse/v1/stores/#{store1.id}", headers: headers
      json1 = JSON.parse(response.body)
      expect(json1["data"]["assigned_storekeepers"].length).to eq(1)
      
      # Store 2 should not have the storekeeper
      get "/cats_warehouse/v1/stores/#{store2.id}", headers: headers
      json2 = JSON.parse(response.body)
      expect(json2["data"]["assigned_storekeepers"].length).to eq(0)
    end
  end
end
