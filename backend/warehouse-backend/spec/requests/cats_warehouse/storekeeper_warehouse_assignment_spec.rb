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

    it "does not show stores until the manager assigns one explicitly" do
      headers = auth_headers_for(storekeeper)
      get "/cats_warehouse/v1/stores", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      
      store_ids = json["data"].map { |s| s["id"] }
      expect(store_ids).to be_empty
    end

    it "does not allow access to stores before explicit store assignment" do
      headers = auth_headers_for(storekeeper)
      
      get "/cats_warehouse/v1/stores/#{store1.id}", headers: headers
      expect(response).to have_http_status(:not_found)
      
      get "/cats_warehouse/v1/stores/#{store2.id}", headers: headers
      expect(response).to have_http_status(:not_found)
      
      get "/cats_warehouse/v1/stores/#{store3.id}", headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it "does not expose warehouse pool rows as switchable assignments" do
      headers = auth_headers_for(storekeeper)
      get "/cats_warehouse/v1/me/assignments", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["data"]["assignments"]).to be_empty
    end
  end

  describe "warehouse-level assignment in a single-store warehouse" do
    let(:single_store_warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
    let!(:warehouse_capacity) { create(:cats_warehouse_warehouse_capacity, warehouse: single_store_warehouse) }
    let!(:sole_store) { create(:cats_warehouse_store, warehouse: single_store_warehouse, name: "Only Store") }

    before do
      Cats::Warehouse::UserAssignment.create!(
        user: storekeeper,
        role_name: "Storekeeper",
        warehouse: single_store_warehouse
      )
    end

    it "allows storekeeper to see the sole store" do
      headers = auth_headers_for(storekeeper)
      get "/cats_warehouse/v1/stores", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)

      store_ids = json["data"].map { |s| s["id"] }
      expect(store_ids).to contain_exactly(sole_store.id)
    end

    it "allows access to the sole store" do
      headers = auth_headers_for(storekeeper)

      get "/cats_warehouse/v1/stores/#{sole_store.id}", headers: headers
      expect(response).to have_http_status(:ok)
    end

    it "exposes the warehouse assignment with the sole store for workspace selection" do
      headers = auth_headers_for(storekeeper)
      get "/cats_warehouse/v1/me/assignments", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      assignments = json["data"]["assignments"]
      expect(assignments.length).to eq(1)
      expect(assignments[0]["warehouse"]["id"]).to eq(single_store_warehouse.id)
      expect(assignments[0]["store"]["id"]).to eq(sole_store.id)
    end

    it "lists the sole store via storekeeper_stores" do
      headers = auth_headers_for(storekeeper)
      get "/cats_warehouse/v1/me/storekeeper_stores", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      store_ids = json["data"]["stores"].map { |s| s["id"] }
      expect(store_ids).to contain_exactly(sole_store.id)
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

    it "exposes store-level assignments as switchable assignments" do
      headers = auth_headers_for(storekeeper)
      get "/cats_warehouse/v1/me/assignments", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      assignments = json["data"]["assignments"]
      expect(assignments.length).to eq(1)
      expect(assignments[0]["store"]["id"]).to eq(store1.id)
    end
  end

  describe "transition from warehouse pool to store-level" do
    it "grants access only after a store assignment is created" do
      Cats::Warehouse::UserAssignment.create!(
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
      expect(json["data"].map { |s| s["id"] }).to be_empty

      Cats::Warehouse::UserAssignment.create!(
        user: storekeeper,
        role_name: "Storekeeper",
        store: store1
      )

      get "/cats_warehouse/v1/stores", headers: headers
      json = JSON.parse(response.body)
      expect(json["data"].map { |s| s["id"] }).to contain_exactly(store1.id)
    end
  end
end
