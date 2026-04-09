require "rails_helper"

RSpec.describe "Debug Stock Balance 3", type: :request do
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

  it "debugs stock balance scoping with GRN" do
    admin = create(:cats_core_user, role_name: "Admin")
    admin_headers = { "Authorization" => "Bearer #{admin.signed_id(purpose: "auth", expires_in: 1.hour)}" }
    
    # Create a GRN
    post "/cats_warehouse/v1/grns",
         params: {
           payload: {
             warehouse_id: warehouse.id,
             received_on: Date.current.to_s,
             received_by_id: admin.id,
             reference_no: "GRN-001",
             items: [
               {
                 commodity_id: commodity.id,
                 quantity: 4,
                 unit_id: unit.id,
                 store_id: store.id,
                 stack_id: stack.id
               }
             ]
           }
         },
         headers: admin_headers,
         as: :json

    # Create another warehouse/stack for the "other" balance
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
    
    puts "\n=== Balances: #{Cats::Warehouse::StockBalance.count} ==="
    puts "=== Balance WH IDs: #{Cats::Warehouse::StockBalance.pluck(:warehouse_id).inspect} ==="
    puts "=== Manager WH ID: #{warehouse.id} ==="
    
    manager_headers = { "Authorization" => "Bearer #{manager.signed_id(purpose: "auth", expires_in: 1.hour)}" }

    begin
      get "/cats_warehouse/v1/stock_balances", headers: manager_headers
      puts "=== Response Status: #{response.status} ==="
      puts "=== Response Body: #{response.body[0..500]} ==="
    rescue => e
      puts "=== Exception: #{e.class}: #{e.message} ==="
      puts "=== Backtrace: #{e.backtrace.first(10).join("\n")} ==="
    end
  end
end
