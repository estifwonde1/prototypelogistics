require "rails_helper"

RSpec.describe Cats::Warehouse::WarehouseCapacitySerializer, type: :serializer do
  def serialized(capacity)
    ActiveModelSerializers::SerializableResource.new(
      capacity,
      serializer: described_class
    ).as_json
  end

  it "returns nil for no_of_stores when the warehouse has no stores" do
    capacity = create(:cats_warehouse_warehouse_capacity)

    json = serialized(capacity)

    expect(json[:no_of_stores]).to be_nil
  end

  it "returns the live store count for no_of_stores when stores exist" do
    warehouse = create(:cats_warehouse_warehouse)
    capacity = create(:cats_warehouse_warehouse_capacity, warehouse: warehouse)
    create(:cats_warehouse_store, warehouse: warehouse)
    create(:cats_warehouse_store, warehouse: warehouse)

    json = serialized(capacity.reload)

    expect(json[:no_of_stores]).to eq(2)
  end
end
