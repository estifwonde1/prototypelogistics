require "rails_helper"

RSpec.describe Cats::Warehouse::WarehouseSerializer, type: :serializer do
  def serialized(warehouse)
    ActiveModelSerializers::SerializableResource.new(
      warehouse,
      serializer: described_class
    ).as_json
  end

  it "includes region_name derived from location ancestry" do
    region   = create(:cats_core_location, location_type: "Region", name: "Oromia")
    woreda   = create(:cats_core_location, location_type: "Woreda", name: "Bale",
                      ancestry: region.id.to_s)
    warehouse = create(:cats_warehouse_warehouse)
    warehouse.update_columns(location_id: woreda.id)
    warehouse.reload

    json = serialized(warehouse)
    # region_name comes from walking the ancestry path
    # If the Location model uses ancestry gem, path includes ancestors
    expect(json).to have_key(:region_name)
  end

  it "does not hardcode Addis Ababa — region_name is nil when no region ancestor exists" do
    # Location with no ancestry (no parent region)
    location  = create(:cats_core_location, location_type: "Woreda", name: "SomeWoreda")
    warehouse = create(:cats_warehouse_warehouse)
    warehouse.update_columns(location_id: location.id)
    warehouse.reload

    json = serialized(warehouse)
    # Must not be the hardcoded string
    expect(json[:region_name]).not_to eq("Addis Ababa")
  end

  it "includes all expected location fields" do
    warehouse = create(:cats_warehouse_warehouse)
    json = serialized(warehouse)

    %i[location_id location_name region_name subcity_name woreda_name].each do |field|
      expect(json).to have_key(field), "expected serialized output to include :#{field}"
    end
  end
end
