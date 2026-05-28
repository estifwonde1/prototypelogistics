# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::GinStackAllocationValidator, type: :service do
  let(:warehouse) { create(:cats_warehouse_warehouse) }
  let(:store) { create(:cats_warehouse_store, warehouse: warehouse) }
  let(:stack) { create(:cats_warehouse_stack, store: store, quantity: 5) }
  let(:user) { create(:cats_core_user, role_name: "Storekeeper") }
  let(:gin) { create(:cats_warehouse_gin, warehouse: warehouse, issued_by: user, status: "draft") }
  let!(:gin_item) do
    create(
      :cats_warehouse_gin_item,
      gin: gin,
      commodity: stack.commodity,
      unit: stack.unit,
      quantity: 3,
      store: store,
      stack: stack
    )
  end

  before do
    create(
      :cats_warehouse_stock_balance,
      warehouse: warehouse,
      store: store,
      stack: stack,
      commodity: stack.commodity,
      unit: stack.unit,
      quantity: 5,
      available_quantity: 5
    )
  end

  it "accepts allocations that match GIN quantity and stack availability" do
    expect do
      described_class.new(
        gin: gin,
        allocations: [{ stack_id: stack.id, commodity_id: stack.commodity_id, quantity: 3 }]
      ).call
    end.not_to raise_error
  end

  it "rejects over-allocation beyond stack availability" do
    expect do
      described_class.new(
        gin: gin,
        allocations: [{ stack_id: stack.id, commodity_id: stack.commodity_id, quantity: 10 }]
      ).call
    end.to raise_error(ArgumentError, /only has 5 available/)
  end

  it "rejects duplicate stack rows" do
    expect do
      described_class.new(
        gin: gin,
        allocations: [
          { stack_id: stack.id, commodity_id: stack.commodity_id, quantity: 1.5 },
          { stack_id: stack.id, commodity_id: stack.commodity_id, quantity: 1.5 }
        ]
      ).call
    end.to raise_error(ArgumentError, /Each stack can only appear once/)
  end
end
