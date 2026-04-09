require "rails_helper"

RSpec.describe Cats::Warehouse::InspectionConfirmer, type: :service do
  it "confirms inspection and applies GRN item updates" do
    warehouse = create(:cats_warehouse_warehouse)
    store = create(:cats_warehouse_store, warehouse: warehouse)
    stack = create(:cats_warehouse_stack, store: store, quantity: 10)
    receiver = create(:cats_core_user, role_name: "Storekeeper")
    inspector = create(:cats_core_user, role_name: "Inspector")

    grn = create(:cats_warehouse_grn, warehouse: warehouse, received_by: receiver, status: "confirmed")
    grn_item = create(
      :cats_warehouse_grn_item,
      grn: grn,
      commodity: stack.commodity,
      unit: stack.unit,
      quantity: 10,
      store: store,
      stack: stack
    )

    create(
      :cats_warehouse_stock_balance,
      warehouse: warehouse,
      store: store,
      stack: stack,
      commodity: stack.commodity,
      unit: stack.unit,
      quantity: 10
    )

    inspection = create(
      :cats_warehouse_inspection,
      warehouse: warehouse,
      inspector: inspector,
      source: grn,
      status: "draft"
    )

    create(
      :cats_warehouse_inspection_item,
      inspection: inspection,
      commodity: stack.commodity,
      quantity_received: 10,
      quantity_damaged: 2,
      quantity_lost: 0,
      quality_status: "Damaged"
    )

    described_class.new(inspection: inspection).call

    expect(inspection.reload.status).to eq("confirmed")
    expect(grn_item.reload.quality_status).to eq("Damaged")
    expect(stack.reload.quantity).to eq(8)

    balance = Cats::Warehouse::StockBalance.find_by(stack_id: stack.id)
    expect(balance.quantity).to eq(8)
  end
end
