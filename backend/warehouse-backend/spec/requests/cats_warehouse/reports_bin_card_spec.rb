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

  it "filters by inventory_lot_id when provided" do
    location = create(:cats_core_location)
    hub = create(:cats_warehouse_hub, location: location)
    warehouse = create(:cats_warehouse_warehouse, hub: hub, location: location)
    store = create(:cats_warehouse_store, warehouse: warehouse)
    sk_user = create(:cats_core_user, role_name: "Storekeeper")
    Cats::Warehouse::UserAssignment.create!(
      user: sk_user,
      warehouse: warehouse,
      role_name: "Storekeeper"
    )
    headers = { "Authorization" => "Bearer #{sk_user.signed_id(purpose: 'auth', expires_in: 1.hour)}" }

    commodity = create(:cats_core_commodity)
    unit = commodity.unit_of_measure
    stack = create(:cats_warehouse_stack, store: store, commodity: commodity, unit: unit)
    lot = Cats::Warehouse::InventoryLot.create!(
      warehouse: warehouse,
      commodity: commodity,
      batch_no: "BATCH-LOT-ID-#{SecureRandom.hex(4)}"
    )

    Cats::Warehouse::StackTransaction.create!(
      destination_id: stack.id,
      source_id: nil,
      transaction_date: Date.current,
      quantity: 4.5,
      unit_id: unit.id,
      status: "confirmed",
      inventory_lot_id: lot.id
    )

    get "/cats_warehouse/v1/reports/bin_card",
        params: {
          store_id: store.id,
          commodity_id: commodity.id,
          inventory_lot_id: lot.id
        },
        headers: headers

    expect(response).to have_http_status(:ok)
    rows = json_response["data"]
    expect(rows.length).to eq(1)
    expect(rows.first["quantity"]).to eq(4.5)
    expect(rows.first["batch_no"]).to eq(lot.batch_no)
  end

  it "includes null-inventory_lot transactions on stack_ids when include_null_inventory_lot is true" do
    location = create(:cats_core_location)
    hub = create(:cats_warehouse_hub, location: location)
    warehouse = create(:cats_warehouse_warehouse, hub: hub, location: location)
    store = create(:cats_warehouse_store, warehouse: warehouse)
    sk_user = create(:cats_core_user, role_name: "Storekeeper")
    Cats::Warehouse::UserAssignment.create!(
      user: sk_user,
      warehouse: warehouse,
      role_name: "Storekeeper"
    )
    headers = { "Authorization" => "Bearer #{sk_user.signed_id(purpose: 'auth', expires_in: 1.hour)}" }

    commodity = create(:cats_core_commodity)
    unit = commodity.unit_of_measure
    stack = create(:cats_warehouse_stack, store: store, commodity: commodity, unit: unit)

    Cats::Warehouse::StackTransaction.create!(
      destination_id: stack.id,
      source_id: nil,
      transaction_date: Date.current,
      quantity: 2.0,
      unit_id: unit.id,
      status: "confirmed",
      inventory_lot_id: nil
    )

    bogus_batch = "NO-SUCH-BATCH-#{SecureRandom.hex(4)}"

    get "/cats_warehouse/v1/reports/bin_card",
        params: {
          store_id: store.id,
          commodity_id: commodity.id,
          batch_no: bogus_batch,
          include_null_inventory_lot: false,
          stack_ids: stack.id.to_s
        },
        headers: headers

    expect(response).to have_http_status(:ok)
    expect(json_response["data"].length).to eq(0)

    get "/cats_warehouse/v1/reports/bin_card",
        params: {
          store_id: store.id,
          commodity_id: commodity.id,
          batch_no: bogus_batch,
          include_null_inventory_lot: true,
          stack_ids: stack.id.to_s
        },
        headers: headers

    expect(response).to have_http_status(:ok)
    rows = json_response["data"]
    expect(rows.length).to eq(1)
    expect(rows.first["quantity"]).to eq(2.0)
  end

  it "supports omit_lot_filter with include_null for stack-scoped history" do
    location = create(:cats_core_location)
    hub = create(:cats_warehouse_hub, location: location)
    warehouse = create(:cats_warehouse_warehouse, hub: hub, location: location)
    store = create(:cats_warehouse_store, warehouse: warehouse)
    sk_user = create(:cats_core_user, role_name: "Storekeeper")
    Cats::Warehouse::UserAssignment.create!(
      user: sk_user,
      warehouse: warehouse,
      role_name: "Storekeeper"
    )
    headers = { "Authorization" => "Bearer #{sk_user.signed_id(purpose: 'auth', expires_in: 1.hour)}" }

    commodity = create(:cats_core_commodity)
    unit = commodity.unit_of_measure
    stack = create(:cats_warehouse_stack, store: store, commodity: commodity, unit: unit)

    Cats::Warehouse::StackTransaction.create!(
      destination_id: stack.id,
      source_id: nil,
      transaction_date: Date.current,
      quantity: 1.25,
      unit_id: unit.id,
      status: "confirmed",
      inventory_lot_id: nil
    )

    get "/cats_warehouse/v1/reports/bin_card",
        params: {
          store_id: store.id,
          commodity_id: commodity.id,
          omit_lot_filter: true,
          include_null_inventory_lot: true,
          stack_ids: stack.id.to_s
        },
        headers: headers

    expect(response).to have_http_status(:ok)
    rows = json_response["data"]
    expect(rows.length).to eq(1)
    expect(rows.first["quantity"]).to eq(1.25)
  end
end
