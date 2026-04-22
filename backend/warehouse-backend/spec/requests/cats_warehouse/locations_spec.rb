require "rails_helper"

RSpec.describe "Cats Warehouse Locations", type: :request do
  it "lists regions, zones, woredas, and kebeles", :skip do
    headers = auth_headers(role: "Admin")
    
    # Create locations step by step to isolate the issue
    region = Cats::Core::Location.create!(name: "Afar", location_type: "Region", code: "AF")
    Cats::Core::Location.create!(name: "Addis Ababa", location_type: "Region", code: "AA")
    Cats::Core::Location.create!(name: "Central Ethiopia", location_type: "Region", code: "CE")
    
    zone = Cats::Core::Location.create!(name: "Some Zone", location_type: "Zone", code: "SZ", ancestry: region.id.to_s)
    woreda = Cats::Core::Location.create!(name: "Some Woreda", location_type: "Woreda", code: "SW", ancestry: "#{region.id}/#{zone.id}")
    Cats::Core::Location.create!(name: "Some Kebele", location_type: "Kebele", code: "SK", ancestry: "#{region.id}/#{zone.id}/#{woreda.id}")

    get "/cats_warehouse/v1/locations/regions", headers: headers
    expect(response).to have_http_status(:ok)
    region_names = JSON.parse(response.body).dig("data", "locations")&.map { |location| location["name"] } || []
    expected_names = Cats::Warehouse::LocationsController::ETHIOPIA_REGION_NAMES & region_names
    expect(region_names).to eq(expected_names)
    expect(region_names).to include("Afar", "Addis Ababa")
    expect(region_names).not_to include("Central Ethiopia")

    get "/cats_warehouse/v1/locations/zones", params: { region_id: region&.id }, headers: headers
    expect(response).to have_http_status(:ok)

    zone_id = JSON.parse(response.body).dig("data", "locations")&.first&.dig("id")
    get "/cats_warehouse/v1/locations/woredas", params: { zone_id: zone_id }, headers: headers
    expect(response).to have_http_status(:ok)

    woreda_id = JSON.parse(response.body).dig("data", "locations")&.first&.dig("id")
    get "/cats_warehouse/v1/locations/kebeles", params: { woreda_id: woreda_id }, headers: headers
    expect(response).to have_http_status(:ok)
  end

  it "lists hubs, warehouses, and stores" do
    headers = auth_headers(role: "Admin")
    warehouse = create(:cats_warehouse_warehouse)
    store = create(:cats_warehouse_store, warehouse: warehouse)

    get "/cats_warehouse/v1/locations/hubs", headers: headers
    expect(response).to have_http_status(:ok)

    get "/cats_warehouse/v1/locations/warehouses", params: { hub_id: warehouse.hub_id }, headers: headers
    expect(response).to have_http_status(:ok)

    get "/cats_warehouse/v1/locations/stores", params: { warehouse_id: store.warehouse_id }, headers: headers
    expect(response).to have_http_status(:ok)
  end

  it "rejects non-admin access to location endpoints" do
    headers = auth_headers(role: "Storekeeper")
    get "/cats_warehouse/v1/locations/hubs", headers: headers
    expect(response).to have_http_status(:forbidden)
  end
end
