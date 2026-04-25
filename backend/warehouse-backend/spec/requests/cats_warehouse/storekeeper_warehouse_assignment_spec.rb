# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Storekeeper Warehouse-Level Assignment", type: :request do
  let(:hub) { create(:cats_warehouse_hub) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:store1) { create(:cats_warehouse_store, warehouse: warehouse, name: "Store 1") }
  let(:store2) { create(:cats_warehouse_store, warehouse: warehouse, name: "Store 2") }
  let(:store3) { create(:cats_warehouse_store, warehouse: warehouse, name: "Store 3") }
  let(:storekeeper) { create(:cats_core_user, role_name: "Storekeeper") }

  def auth_headers_for(user)
    { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" }
  end

  describe "warehouse-level assignment" do
    before do
      # Force creation of stores
      store1
      store2
      store3

      # Create warehouse-level assignment
      Cats::Warehouse::UserAssignment.create!(
        user: storekeeper,
        role_name: "Storekeeper",
        warehouse: warehouse
      )
    end

    it "allows storekeeper to see all stores in the warehouse" do
      headers = auth_headers_for(storekeeper)
      get "/cats_warehouse/v1/stores", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      
      store_ids = json["data"].map { |s| s["id"] }
      expect(store_ids).to contain_exactly(store1.id, store2.id, store3.id)
    end

    it "allows storekeeper to access any store in the warehouse" do
      headers = auth_headers_for(storekeeper)
      
      get "/cats_warehouse/v1/stores/#{store1.id}", headers: headers
      expect(response).to have_http_status(:ok)
      
      get "/cats_warehouse/v1/stores/#{store2.id}", headers: headers
      expect(response).to have_http_status(:ok)
      
      get "/cats_warehouse/v1/stores/#{store3.id}", headers: headers
      expect(response).to have_http_status(:ok)
    end
  end

  describe "store-level assignment" do
    before do
      # Create store-level assignment (only store1)
      Cats::Warehouse::UserAssignment.create!(
        user: storekeeper,
        role_name: "Storekeeper",
        store: store1
      )
    end

    it "allows storekeeper to see only assigned store" do
      headers = auth_headers_for(storekeeper)
      get "/cats_warehouse/v1/stores", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      
      store_ids = json["data"].map { |s| s["id"] }
      expect(store_ids).to contain_exactly(store1.id)
    end

    it "allows access to assigned store but blocks others" do
      headers = auth_headers_for(storekeeper)
      
      get "/cats_warehouse/v1/stores/#{store1.id}", headers: headers
      expect(response).to have_http_status(:ok)
      
      get "/cats_warehouse/v1/stores/#{store2.id}", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "transition from warehouse-level to store-level" do
    it "narrows access when warehouse assignment is replaced with store assignment" do
      # Start with warehouse-level assignment
      warehouse_assignment = Cats::Warehouse::UserAssignment.create!(
        user: storekeeper,
        role_name: "Storekeeper",
        warehouse: warehouse
      )

      # Force creation of stores
      store1
      store2
      store3

      headers = auth_headers_for(storekeeper)
      get "/cats_warehouse/v1/stores", headers: headers
      json = JSON.parse(response.body)
      expect(json["data"].map { |s| s["id"] }).to contain_exactly(store1.id, store2.id, store3.id)

      # Replace with store-level assignment
      warehouse_assignment.destroy!
      Cats::Warehouse::UserAssignment.create!(
        user: storekeeper,
        role_name: "Storekeeper",
        store: store1
      )

      # Now should only see store1
      get "/cats_warehouse/v1/stores", headers: headers
      json = JSON.parse(response.body)
      expect(json["data"].map { |s| s["id"] }).to contain_exactly(store1.id)
    end
  end
end
