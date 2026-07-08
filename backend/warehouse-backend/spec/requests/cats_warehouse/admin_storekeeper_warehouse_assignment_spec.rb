# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Admin Storekeeper Warehouse Assignment", type: :request do
  let(:hub) { create(:cats_warehouse_hub) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:storekeeper) { create(:cats_core_user, role_name: "Storekeeper") }
  let(:admin_headers) { auth_headers(role: "Admin") }

  describe "POST /cats_warehouse/v1/admin/user_assignments" do
    it "allows admin to assign storekeeper at warehouse level" do
      payload = {
        payload: {
          user_id: storekeeper.id,
          role_name: "Storekeeper",
          warehouse_ids: [warehouse.id]
        }
      }

      post "/cats_warehouse/v1/admin/user_assignments", params: payload, headers: admin_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      
      expect(json["data"]["assignments"].length).to eq(1)
      expect(json["data"]["assignments"][0]["warehouse"]["id"]).to eq(warehouse.id)
      expect(json["data"]["assignments"][0]["store"]).to be_nil
    end
  end

  describe "PATCH /cats_warehouse/v1/admin/user_assignments/bulk" do
    it "allows admin to bulk update storekeeper warehouse assignments" do
      payload = {
        payload: {
          user_id: storekeeper.id,
          role_name: "Storekeeper",
          warehouse_ids: [warehouse.id]
        }
      }

      patch "/cats_warehouse/v1/admin/user_assignments/bulk", params: payload, headers: admin_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      
      expect(json["data"]["assignments"].length).to eq(1)
      expect(json["data"]["assignments"][0]["warehouse"]["id"]).to eq(warehouse.id)
      expect(json["data"]["assignments"][0]["store"]).to be_nil
    end
  end
end
