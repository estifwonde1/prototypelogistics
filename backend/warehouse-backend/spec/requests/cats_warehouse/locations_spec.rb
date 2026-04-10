require "rails_helper"

RSpec.describe "Cats Warehouse Locations", type: :request do
  it "lists regions, zones, and woredas" do
    headers = auth_headers(role: "Admin")
    region = Cats::Core::Location.find_or_create_by!(name: "Afar", location_type: Cats::Core::Location::REGION, code: "AF")
    Cats::Core::Location.find_or_create_by!(name: "Addis Ababa", location_type: Cats::Core::Location::REGION, code: "AA")
    Cats::Core::Location.find_or_create_by!(name: "Central Ethiopia", location_type: Cats::Core::Location::REGION, code: "CE")
    zone = Cats::Core::Location.find_or_create_by!(name: "Some Zone", location_type: Cats::Core::Location::ZONE, code: "SZ", ancestry: region.id.to_s)
    Cats::Core::Location.find_or_create_by!(name: "Some Woreda", location_type: Cats::Core::Location::WOREDA, code: "SW", ancestry: "#{region.id}/#{zone.id}")

    get "/cats_warehouse/v1/locations/regions", headers: headers
    expect(response).to have_http_status(:ok)
    region_names = JSON.parse(response.body).dig("data", "locations").map { |location| location["name"] }
    expect(region_names).to eq(Cats::Warehouse::LocationsController::ETHIOPIA_REGION_NAMES & region_names)
    expect(region_names).to include("Afar", "Addis Ababa")
    expect(region_names).not_to include("Central Ethiopia")

    get "/cats_warehouse/v1/locations/zones", params: { region_id: region&.id }, headers: headers
    expect(response).to have_http_status(:ok)

    zone_id = JSON.parse(response.body).dig("data", "locations")&.first&.dig("id")
    get "/cats_warehouse/v1/locations/woredas", params: { zone_id: zone_id }, headers: headers
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
