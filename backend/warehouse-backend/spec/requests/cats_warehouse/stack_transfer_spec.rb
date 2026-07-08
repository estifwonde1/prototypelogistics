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

    it "allows transfer into an empty destination stack (nil commodity and unit)" do
      empty_stack =
        create(
          :cats_warehouse_stack,
          store: store,
          commodity: nil,
          unit: nil,
          quantity: 0,
          base_quantity: 0,
        )

      headers = auth_headers_for(storekeeper)

      payload = {
        destination_id: empty_stack.id,
        quantity: 30,
      }

      post "/cats_warehouse/v1/stacks/#{source_stack.id}/transfer", params: payload, headers: headers

      expect(response).to have_http_status(:ok)

      empty_stack.reload
      source_stack.reload
      expect(empty_stack.commodity_id).to eq(commodity.id)
      expect(empty_stack.unit_id).to eq(unit.id)
      expect(empty_stack.quantity).to eq(30)
      expect(source_stack.quantity).to eq(70)
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

    it "rejects transfer if destination holds a different commodity with stock" do
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
      expect(json["error"]["message"]).to match(/different commodity/i)
    end

    it "allows transfer into an empty reserved bay with a stale commodity_id" do
      other_commodity = create(:cats_core_commodity)
      empty_reserved =
        create(
          :cats_warehouse_stack,
          store: store,
          commodity: other_commodity,
          unit: unit,
          quantity: 0
        )

      headers = auth_headers_for(storekeeper)
      post "/cats_warehouse/v1/stacks/#{source_stack.id}/transfer",
           params: { destination_id: empty_reserved.id, quantity: 25 },
           headers: headers

      expect(response).to have_http_status(:ok)
      empty_reserved.reload
      expect(empty_reserved.commodity_id).to eq(commodity.id)
      expect(empty_reserved.quantity).to eq(25)
    end

    it "converts entered quantity from another unit and persists audit fields" do
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

      headers = auth_headers_for(storekeeper)
      post "/cats_warehouse/v1/stacks/#{source_stack.id}/transfer",
           params: {
             destination_id: destination_stack.id,
             entered_unit_id: qt_unit.id,
             entered_quantity: 2,
             package_count: 4
           },
           headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["data"]["transaction"]["quantity"]).to eq(200.0)
      expect(json["data"]["transaction"]["entered_unit_id"]).to eq(qt_unit.id)
      expect(json["data"]["transaction"]["entered_quantity"]).to eq(2.0)
      expect(json["data"]["transaction"]["package_count"]).to eq(4.0)

      txn = Cats::Warehouse::StackTransaction.order(:id).last
      expect(txn.entered_unit_id).to eq(qt_unit.id)
      expect(txn.entered_quantity.to_f).to eq(2.0)
      expect(txn.package_count.to_f).to eq(4.0)
      expect(txn.quantity.to_f).to eq(200.0)
    end

    it "credits destination in its own unit when source and destination units differ" do
      kg_unit = create(:cats_core_unit_of_measure, name: "Kilogram", abbreviation: "kg")
      mt_unit = create(:cats_core_unit_of_measure, name: "Metric Ton", abbreviation: "mt")
      source_stack.update!(unit: kg_unit, quantity: 1000)
      destination_stack.update!(unit: mt_unit, quantity: 0.5)

      Cats::Warehouse::UomConversion.create!(
        commodity_id: nil,
        from_unit_id: kg_unit.id,
        to_unit_id: mt_unit.id,
        multiplier: 0.001,
        active: true
      )

      headers = auth_headers_for(storekeeper)
      post "/cats_warehouse/v1/stacks/#{source_stack.id}/transfer",
           params: { destination_id: destination_stack.id, quantity: 200 },
           headers: headers

      expect(response).to have_http_status(:ok)

      source_stack.reload
      destination_stack.reload
      expect(source_stack.quantity).to eq(800)
      expect(destination_stack.quantity).to eq(0.7)
    end

    it "rejects transfer when no conversion exists between entered and stack units" do
      other_unit = create(:cats_core_unit_of_measure, name: "Metric Ton", abbreviation: "mt")
      headers = auth_headers_for(storekeeper)

      post "/cats_warehouse/v1/stacks/#{source_stack.id}/transfer",
           params: {
             destination_id: destination_stack.id,
             entered_unit_id: other_unit.id,
             entered_quantity: 1
           },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["error"]["message"]).to match(/No unit conversion/i)
    end
  end
end
