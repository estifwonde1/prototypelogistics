require "rails_helper"

RSpec.describe Cats::Warehouse::GinConfirmer, type: :service do
  it "confirms GIN and reduces stock/stack" do
    warehouse = create(:cats_warehouse_warehouse)
    store = create(:cats_warehouse_store, warehouse: warehouse)
    stack = create(:cats_warehouse_stack, store: store, quantity: 10)
    user = create(:cats_core_user, role_name: "Storekeeper")

    gin = create(:cats_warehouse_gin, warehouse: warehouse, issued_by: user, status: "draft")
    create(
      :cats_warehouse_gin_item,
      gin: gin,
      commodity: stack.commodity,
      unit: stack.unit,
      quantity: 3,
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

    described_class.new(gin: gin).call

    expect(gin.reload.status).to eq("confirmed")
    expect(stack.reload.quantity).to eq(7)

    balance = Cats::Warehouse::StockBalance.find_by(stack_id: stack.id)
    expect(balance.quantity).to eq(7)

    expect(Cats::Warehouse::StackTransaction.count).to eq(1)
  end
end
