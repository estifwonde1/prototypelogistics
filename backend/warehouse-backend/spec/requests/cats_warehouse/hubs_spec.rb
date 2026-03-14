require "rails_helper"

RSpec.describe "Cats Warehouse Hubs", type: :request do
  it "supports CRUD" do
    headers = auth_headers(role: "Hub Manager")
    location = create(:cats_core_location)

    post "/cats_warehouse/v1/hubs", params: { payload: { location_id: location.id, name: "Hub A" } }, as: :json, headers: headers
    expect(response).to have_http_status(:created)
    hub_id = json_response.dig("data", "id")

    get "/cats_warehouse/v1/hubs/#{hub_id}", headers: headers
    expect(response).to have_http_status(:ok)
    expect(json_response.dig("data", "hub", "id")).to eq(hub_id)

    patch "/cats_warehouse/v1/hubs/#{hub_id}", params: { payload: { status: "Active" } }, as: :json, headers: headers
    expect(response).to have_http_status(:ok)

    delete "/cats_warehouse/v1/hubs/#{hub_id}", headers: auth_headers(role: "Admin")
    expect(response).to have_http_status(:ok)
  end
end
