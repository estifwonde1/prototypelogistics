# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GET /cats_warehouse/v1/reports/bin_card", type: :request do
  it "filters by commodity_id and batch_no when provided" do
    location = create(:cats_core_location)
    hub = create(:cats_warehouse_hub, location: location)
    warehouse = create(:cats_warehouse_warehouse, hub: hub, location: location)
    store = create(:cats_warehouse_store, warehouse: warehouse)
    sk_user = create(:cats_core_user, role_name: "Storekeeper")
    # Warehouse-level assignment expands to all stores in that warehouse (see AccessContext#assigned_store_ids).
    # Store-only rows can be brittle if store_id is not persisted as expected across environments.
    Cats::Warehouse::UserAssignment.create!(
      user: sk_user,
      warehouse: warehouse,
      role_name: "Storekeeper"
    )
    headers = { "Authorization" => "Bearer #{sk_user.signed_id(purpose: 'auth', expires_in: 1.hour)}" }

    commodity_a = create(:cats_core_commodity)
    commodity_b = create(:cats_core_commodity)
    unit = commodity_a.unit_of_measure

    stack = create(:cats_warehouse_stack, store: store, commodity: commodity_a, unit: unit)

    lot_a = Cats::Warehouse::InventoryLot.create!(
      warehouse: warehouse,
      commodity: commodity_a,
      batch_no: "BATCH-ALPHA-#{SecureRandom.hex(4)}"
    )
    lot_b = Cats::Warehouse::InventoryLot.create!(
      warehouse: warehouse,
      commodity: commodity_b,
      batch_no: "BATCH-BETA-#{SecureRandom.hex(4)}"
    )

    Cats::Warehouse::StackTransaction.create!(
      destination_id: stack.id,
      source_id: nil,
      transaction_date: Date.current,
      quantity: 5.0,
      unit_id: unit.id,
      status: "confirmed",
      inventory_lot_id: lot_a.id
    )
    Cats::Warehouse::StackTransaction.create!(
      destination_id: stack.id,
      source_id: nil,
      transaction_date: Date.current,
      quantity: 3.0,
      unit_id: unit.id,
      status: "confirmed",
      inventory_lot_id: lot_b.id
    )

    get "/cats_warehouse/v1/reports/bin_card",
        params: {
          store_id: store.id,
          commodity_id: commodity_a.id,
          batch_no: lot_a.batch_no
        },
        headers: headers

    expect(response).to have_http_status(:ok)
    rows = json_response["data"]
    expect(rows).to be_a(Array)
    expect(rows.length).to eq(1)
    expect(rows.first["quantity"]).to eq(5.0)
    expect(rows.first["batch_no"]).to eq(lot_a.batch_no)
  end
end
