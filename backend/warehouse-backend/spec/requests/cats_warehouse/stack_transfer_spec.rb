# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Stack Transfer", type: :request do
  let(:hub) { create(:cats_warehouse_hub) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:store) { create(:cats_warehouse_store, warehouse: warehouse) }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { create(:cats_core_unit_of_measure) }
  let(:storekeeper) { create(:cats_core_user, role_name: "Storekeeper") }

  let(:source_stack) do
    create(:cats_warehouse_stack,
           store: store,
           commodity: commodity,
           unit: unit,
           quantity: 100)
  end

  let(:destination_stack) do
    create(:cats_warehouse_stack,
           store: store,
           commodity: commodity,
           unit: unit,
           quantity: 50)
  end

  def auth_headers_for(user)
    { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" }
  end

  before do
    Cats::Warehouse::UserAssignment.create!(
      user: storekeeper,
      role_name: "Storekeeper",
      store: store
    )
  end

  describe "POST /cats_warehouse/v1/stacks/:id/transfer" do
    it "allows storekeeper to transfer stock between stacks in same store" do
      headers = auth_headers_for(storekeeper)

      payload = {
        destination_id: destination_stack.id,
        quantity: 30
      }

      post "/cats_warehouse/v1/stacks/#{source_stack.id}/transfer", params: payload, headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)

      expect(json["data"]["message"]).to eq("Stack transfer completed successfully")
      expect(json["data"]["transaction"]["quantity"]).to eq(30.0)

      # Verify quantities updated
      source_stack.reload
      destination_stack.reload
      expect(source_stack.quantity).to eq(70)
      expect(destination_stack.quantity).to eq(80)
    end

    it "rejects transfer if destination is in different store" do
      other_store = create(:cats_warehouse_store, warehouse: warehouse)
      other_stack = create(:cats_warehouse_stack,
                           store: other_store,
                           commodity: commodity,
                           unit: unit,
                           quantity: 50)

      headers = auth_headers_for(storekeeper)

      payload = {
        destination_id: other_stack.id,
        quantity: 30
      }

      post "/cats_warehouse/v1/stacks/#{source_stack.id}/transfer", params: payload, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["error"]["message"]).to include("same store")
    end

    it "rejects transfer if quantity exceeds available" do
      headers = auth_headers_for(storekeeper)

      payload = {
        destination_id: destination_stack.id,
        quantity: 150
      }

      post "/cats_warehouse/v1/stacks/#{source_stack.id}/transfer", params: payload, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["error"]["message"]).to include("Insufficient quantity")
    end

    it "rejects transfer if commodities don't match" do
      other_commodity = create(:cats_core_commodity)
      other_stack = create(:cats_warehouse_stack,
                           store: store,
                           commodity: other_commodity,
                           unit: unit,
                           quantity: 50)

      headers = auth_headers_for(storekeeper)

      payload = {
        destination_id: other_stack.id,
        quantity: 30
      }

      post "/cats_warehouse/v1/stacks/#{source_stack.id}/transfer", params: payload, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["error"]["message"]).to include("same commodity")
    end
  end
end
