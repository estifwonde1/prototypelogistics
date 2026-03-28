require "rails_helper"
require_relative "../../factories/core"
require_relative "../../factories/warehouse"

RSpec.describe "Cats::Warehouse Phase 1 inventory workflows", type: :request do
  def json_response
    JSON.parse(response.body)
  end

  let!(:location) { create(:cats_core_location, code: "LOC-A", name: "Location A") }
  let!(:hub) { Cats::Warehouse::Hub.create!(location: location, name: "Hub A") }
  let!(:warehouse) do
    Cats::Warehouse::Warehouse.create!(
      location: location,
      hub: hub,
      code: "WH-A",
      name: "Warehouse A",
      managed_under: "Hub",
      ownership_type: "self_owned"
    )
  end
  let!(:store) do
    Cats::Warehouse::Store.create!(
      warehouse: warehouse,
      code: "ST-A",
      name: "Store A",
      length: 10,
      width: 8,
      height: 4,
      usable_space: 320,
      available_space: 320,
      temporary: false,
      has_gangway: false
    )
  end
  let!(:commodity) { create(:cats_core_commodity, name: "Maize", batch_no: "BATCH-A") }
  let!(:unit) { commodity.unit_of_measure }
  let!(:stack) do
    Cats::Warehouse::Stack.create!(
      store: store,
      commodity: commodity,
      unit: unit,
      code: "STACK-A",
      length: 2,
      width: 2,
      height: 2,
      quantity: 0
    )
  end
  let!(:admin) { create(:cats_core_user, role_name: "Admin") }
  let(:headers) { { "Authorization" => "Bearer #{admin.signed_id(purpose: "auth", expires_in: 1.hour)}" } }

  def create_grn!(quantity:, reference_no: "GRN-001")
    post "/cats_warehouse/v1/grns",
         params: {
           payload: {
             warehouse_id: warehouse.id,
             received_on: Date.current.to_s,
             received_by_id: admin.id,
             reference_no: reference_no,
             items: [
               {
                 commodity_id: commodity.id,
                 quantity: quantity,
                 unit_id: unit.id,
                 store_id: store.id,
                 stack_id: stack.id
               }
             ]
           }
         },
         as: :json,
         headers: headers

    expect(response).to have_http_status(:created)
    json_response.dig("data", "id")
  end

  def create_gin!(quantity:, reference_no: "GIN-001")
    post "/cats_warehouse/v1/gins",
         params: {
           payload: {
             warehouse_id: warehouse.id,
             issued_on: Date.current.to_s,
             issued_by_id: admin.id,
             reference_no: reference_no,
             items: [
               {
                 commodity_id: commodity.id,
                 quantity: quantity,
                 unit_id: unit.id,
                 store_id: store.id,
                 stack_id: stack.id
               }
             ]
           }
         },
         as: :json,
         headers: headers

    expect(response).to have_http_status(:created)
    json_response.dig("data", "id")
  end

  def create_inspection!(quantity_damaged:, quantity_lost:, quantity_received:, source_id:, reference_no: "INSP-001")
    post "/cats_warehouse/v1/inspections",
         params: {
           payload: {
             warehouse_id: warehouse.id,
             inspected_on: Date.current.to_s,
             inspector_id: admin.id,
             source_type: "Grn",
             source_id: source_id,
             reference_no: reference_no,
             items: [
               {
                 commodity_id: commodity.id,
                 quantity_received: quantity_received,
                 quantity_damaged: quantity_damaged,
                 quantity_lost: quantity_lost,
                 quality_status: "Damaged"
               }
             ]
           }
         },
         as: :json,
         headers: headers

    expect(response).to have_http_status(:created)
    json_response.dig("data", "id")
  end

  describe "GRN confirmation" do
    it "increases stock balance and exposes readable bin card fields" do
      grn_id = create_grn!(quantity: 5)

      post "/cats_warehouse/v1/grns/#{grn_id}/confirm", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response.dig("data", "status")).to eq("Confirmed")

      balance = Cats::Warehouse::StockBalance.find_by!(
        warehouse_id: warehouse.id,
        store_id: store.id,
        stack_id: stack.id,
        commodity_id: commodity.id,
        unit_id: unit.id
      )

      expect(balance.quantity).to eq(5.0)

      get "/cats_warehouse/v1/reports/bin_card",
          params: { stack_id: stack.id },
          headers: headers

      expect(response).to have_http_status(:ok)
      entry = json_response.fetch("data").first
      expect(entry["reference_type"]).to eq("Cats::Warehouse::Grn")
      expect(entry["reference_no"]).to eq("GRN-001")
      expect(entry["commodity_name"]).to eq("Maize")
      expect(entry["destination_stack_code"]).to eq("STACK-A")
      expect(entry["destination_store_name"]).to eq("Store A")
      expect(entry["destination_warehouse_name"]).to eq("Warehouse A")
    end
  end

  describe "GIN confirmation" do
    it "decreases stock and blocks negative inventory" do
      grn_id = create_grn!(quantity: 5, reference_no: "GRN-ISSUE")
      post "/cats_warehouse/v1/grns/#{grn_id}/confirm", headers: headers
      expect(response).to have_http_status(:ok)

      gin_id = create_gin!(quantity: 3)
      post "/cats_warehouse/v1/gins/#{gin_id}/confirm", headers: headers

      expect(response).to have_http_status(:ok)
      expect(
        Cats::Warehouse::StockBalance.find_by!(
          warehouse_id: warehouse.id,
          store_id: store.id,
          stack_id: stack.id,
          commodity_id: commodity.id,
          unit_id: unit.id
        ).quantity
      ).to eq(2.0)

      oversized_gin_id = create_gin!(quantity: 5, reference_no: "GIN-OVERSIZED")
      post "/cats_warehouse/v1/gins/#{oversized_gin_id}/confirm", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response.dig("error", "message")).to include("cannot be negative")
      expect(
        Cats::Warehouse::StockBalance.find_by!(
          warehouse_id: warehouse.id,
          store_id: store.id,
          stack_id: stack.id,
          commodity_id: commodity.id,
          unit_id: unit.id
        ).quantity
      ).to eq(2.0)
    end
  end

  describe "Inspection confirmation" do
    it "applies stock adjustments and blocks losses above available stock" do
      grn_id = create_grn!(quantity: 5, reference_no: "GRN-INSP")
      post "/cats_warehouse/v1/grns/#{grn_id}/confirm", headers: headers
      expect(response).to have_http_status(:ok)

      inspection_id = create_inspection!(
        quantity_received: 5,
        quantity_damaged: 2,
        quantity_lost: 1,
        source_id: grn_id
      )

      post "/cats_warehouse/v1/inspections/#{inspection_id}/confirm", headers: headers

      expect(response).to have_http_status(:ok)
      expect(
        Cats::Warehouse::StockBalance.find_by!(
          warehouse_id: warehouse.id,
          store_id: store.id,
          stack_id: stack.id,
          commodity_id: commodity.id,
          unit_id: unit.id
        ).quantity
      ).to eq(2.0)

      excessive_inspection_id = create_inspection!(
        quantity_received: 5,
        quantity_damaged: 3,
        quantity_lost: 0,
        source_id: grn_id,
        reference_no: "INSP-OVERSIZED"
      )

      post "/cats_warehouse/v1/inspections/#{excessive_inspection_id}/confirm", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_response.dig("error", "message")).to include("exceeds available stock")
      expect(
        Cats::Warehouse::StockBalance.find_by!(
          warehouse_id: warehouse.id,
          store_id: store.id,
          stack_id: stack.id,
          commodity_id: commodity.id,
          unit_id: unit.id
        ).quantity
      ).to eq(2.0)
    end
  end

  describe "assignment scoped inventory visibility" do
    it "returns only balances inside the assigned warehouse scope" do
      other_location = create(:cats_core_location, code: "LOC-B", name: "Location B")
      other_hub = Cats::Warehouse::Hub.create!(location: other_location, name: "Hub B")
      other_warehouse = Cats::Warehouse::Warehouse.create!(
        location: other_location,
        hub: other_hub,
        code: "WH-B",
        name: "Warehouse B",
        managed_under: "Hub",
        ownership_type: "self_owned"
      )
      other_store = Cats::Warehouse::Store.create!(
        warehouse: other_warehouse,
        code: "ST-B",
        name: "Store B",
        length: 10,
        width: 8,
        height: 4,
        usable_space: 320,
        available_space: 320,
        temporary: false,
        has_gangway: false
      )
      other_stack = Cats::Warehouse::Stack.create!(
        store: other_store,
        commodity: commodity,
        unit: unit,
        code: "STACK-B",
        length: 2,
        width: 2,
        height: 2,
        quantity: 0
      )

      Cats::Warehouse::StockBalance.create!(
        warehouse: warehouse,
        store: store,
        stack: stack,
        commodity: commodity,
        unit: unit,
        quantity: 4
      )
      Cats::Warehouse::StockBalance.create!(
        warehouse: other_warehouse,
        store: other_store,
        stack: other_stack,
        commodity: commodity,
        unit: unit,
        quantity: 7
      )

      manager = create(:cats_core_user, role_name: "Warehouse Manager")
      Cats::Warehouse::UserAssignment.create!(
        user: manager,
        warehouse: warehouse,
        role_name: "Warehouse Manager"
      )
      manager_headers = { "Authorization" => "Bearer #{manager.signed_id(purpose: "auth", expires_in: 1.hour)}" }

      get "/cats_warehouse/v1/stock_balances", headers: manager_headers

      expect(response).to have_http_status(:ok)
      balances = json_response.fetch("data")
      expect(balances.size).to eq(1)
      expect(balances.first["warehouse_id"]).to eq(warehouse.id)
      expect(balances.first["warehouse_name"]).to eq("Warehouse A")
    end
  end

  describe "storekeeper workflow scope" do
    it "allows draft GRN creation within the assigned store and blocks confirmation" do
      storekeeper = create(:cats_core_user, role_name: "Storekeeper")
      Cats::Warehouse::UserAssignment.create!(
        user: storekeeper,
        store: store,
        role_name: "Storekeeper"
      )
      storekeeper_headers = {
        "Authorization" => "Bearer #{storekeeper.signed_id(purpose: "auth", expires_in: 1.hour)}"
      }

      post "/cats_warehouse/v1/grns",
           params: {
             payload: {
               warehouse_id: warehouse.id,
               received_on: Date.current.to_s,
               received_by_id: storekeeper.id,
               reference_no: "GRN-STOREKEEPER",
               items: [
                 {
                   commodity_id: commodity.id,
                   quantity: 2,
                   unit_id: unit.id,
                   store_id: store.id,
                   stack_id: stack.id
                 }
               ]
             }
           },
           as: :json,
           headers: storekeeper_headers

      expect(response).to have_http_status(:created)
      created_grn_id = json_response.dig("data", "id")

      post "/cats_warehouse/v1/grns/#{created_grn_id}/confirm", headers: storekeeper_headers

      expect(response).to have_http_status(:forbidden)
      expect(json_response.dig("error", "message")).to eq("Not authorized")
    end
  end
end
