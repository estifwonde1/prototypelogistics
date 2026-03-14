require "rails_helper"

RSpec.describe "Cats Warehouse Warehouses", type: :request do
  it "supports CRUD" do
    location = create(:cats_core_location)
    hub = create(:cats_warehouse_hub)

    post "/cats_warehouse/v1/warehouses",
         params: { payload: { location_id: location.id, hub_id: hub.id, name: "Warehouse A" } },
         as: :json
    expect(response).to have_http_status(:created)
    warehouse_id = json_response.dig("data", "id")

    get "/cats_warehouse/v1/warehouses/#{warehouse_id}"
    expect(response).to have_http_status(:ok)
    expect(json_response.dig("data", "warehouse", "id")).to eq(warehouse_id)

    patch "/cats_warehouse/v1/warehouses/#{warehouse_id}",
          params: { payload: { status: "Active" } },
          as: :json
    expect(response).to have_http_status(:ok)

    delete "/cats_warehouse/v1/warehouses/#{warehouse_id}"
    expect(response).to have_http_status(:ok)
  end
end
