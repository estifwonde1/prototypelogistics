require "rails_helper"

RSpec.describe Cats::Warehouse::GrnCreator, type: :service do
  it "creates a GRN with items" do
    warehouse = create(:cats_warehouse_warehouse)
    store = create(:cats_warehouse_store, warehouse: warehouse)
    stack = create(:cats_warehouse_stack, store: store)
    user = create(:cats_core_user, role_name: "Storekeeper")

    item = {
      commodity: stack.commodity,
      unit: stack.unit,
      quantity: 5,
      store: store,
      stack: stack,
      quality_status: "Good"
    }

    grn = described_class.new(
      warehouse: warehouse,
      received_on: Date.today,
      received_by: user,
      items: [item]
    ).call

    expect(grn).to be_persisted
    expect(grn.grn_items.count).to eq(1)
  end

  it "raises when items are missing" do
    warehouse = create(:cats_warehouse_warehouse)
    user = create(:cats_core_user, role_name: "Storekeeper")

    expect do
      described_class.new(warehouse: warehouse, received_on: Date.today, received_by: user, items: []).call
    end.to raise_error(ArgumentError, /items are required/)
  end
end
