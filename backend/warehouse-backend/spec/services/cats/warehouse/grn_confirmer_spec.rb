require "rails_helper"

RSpec.describe Cats::Warehouse::GrnConfirmer, type: :service do
  it "confirms GRN and updates stock/stack" do
    warehouse = create(:cats_warehouse_warehouse)
    store = create(:cats_warehouse_store, warehouse: warehouse)
    stack = create(:cats_warehouse_stack, store: store, quantity: 10)
    user = create(:cats_core_user, role_name: "Storekeeper")

    grn = create(:cats_warehouse_grn, warehouse: warehouse, received_by: user, status: "draft")
    create(
      :cats_warehouse_grn_item,
      grn: grn,
      commodity: stack.commodity,
      unit: stack.unit,
      quantity: 2,
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

    described_class.new(grn: grn).call

    expect(grn.reload.status).to eq("confirmed")
    expect(stack.reload.quantity).to eq(12)

    balance = Cats::Warehouse::StockBalance.find_by(stack_id: stack.id)
    expect(balance.quantity).to eq(12)

    expect(Cats::Warehouse::StackTransaction.count).to eq(1)
  end
end
