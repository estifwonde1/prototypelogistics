require "rails_helper"

RSpec.describe Cats::Warehouse::StoreOccupancyUpdater, type: :service do
  let(:warehouse) { create(:cats_warehouse_warehouse) }
  let(:store) do
    create(:cats_warehouse_store, warehouse: warehouse,
           length: 10, width: 10, height: 5,
           usable_space: 500, available_space: 500)
  end

  def make_stack(quantity:, length: 2, width: 2, height: 2)
    stack = create(:cats_warehouse_stack,
                   store: store,
                   length: length, width: width, height: height,
                   quantity: quantity,
                   stack_status: quantity.positive? ? "active" : "empty")
    # occupied_volume = l*w*h when quantity > 0
    stack.update_columns(occupied_volume: quantity.positive? ? length * width * height : 0)
    stack
  end

  it "sets occupied_space to sum of non-empty stack volumes" do
    make_stack(quantity: 10, length: 2, width: 2, height: 2) # volume = 8
    make_stack(quantity: 5,  length: 1, width: 1, height: 1) # volume = 1

    described_class.call(store: store)

    store.reload
    expect(store.occupied_space).to eq(9.0)
    expect(store.available_space).to eq(491.0)
  end

  it "ignores empty stacks" do
    make_stack(quantity: 0, length: 3, width: 3, height: 3) # empty — should not count

    described_class.call(store: store)

    store.reload
    expect(store.occupied_space).to eq(0.0)
    expect(store.available_space).to eq(500.0)
  end

  it "clamps available_space to 0 when occupied exceeds usable" do
    # Force a stack with volume larger than usable_space (edge case)
    stack = make_stack(quantity: 1, length: 10, width: 10, height: 6) # volume = 600 > 500
    stack.update_columns(occupied_volume: 600)

    described_class.call(store: store)

    store.reload
    expect(store.available_space).to eq(0.0)
  end

  it "raises ArgumentError when neither store nor store_id is given" do
    expect { described_class.call }.to raise_error(ArgumentError, /store or store_id is required/)
  end

  it "accepts store_id keyword" do
    make_stack(quantity: 1, length: 2, width: 2, height: 2)

    described_class.call(store_id: store.id)

    expect(store.reload.occupied_space).to eq(8.0)
  end
end
