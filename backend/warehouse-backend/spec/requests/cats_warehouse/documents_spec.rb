require "rails_helper"

RSpec.describe "Cats Warehouse Documents", type: :request do
  it "lists document endpoints" do
    get "/cats_warehouse/v1/grns"
    expect(response).to have_http_status(:ok)
    expect(json_response["success"]).to eq(true)

    get "/cats_warehouse/v1/gins"
    expect(response).to have_http_status(:ok)
    expect(json_response["success"]).to eq(true)

    get "/cats_warehouse/v1/inspections"
    expect(response).to have_http_status(:ok)
    expect(json_response["success"]).to eq(true)

    get "/cats_warehouse/v1/waybills"
    expect(response).to have_http_status(:ok)
    expect(json_response["success"]).to eq(true)
  end
end
