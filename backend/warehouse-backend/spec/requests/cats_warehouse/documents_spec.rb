require "rails_helper"

RSpec.describe "Cats Warehouse Documents", type: :request do
  it "lists document endpoints" do
    headers = auth_headers(role: "Warehouse Manager")

    get "/cats_warehouse/v1/grns", headers: headers
    expect(response).to have_http_status(:ok)
    expect(json_response["success"]).to eq(true)

    get "/cats_warehouse/v1/gins", headers: headers
    expect(response).to have_http_status(:ok)
    expect(json_response["success"]).to eq(true)

    get "/cats_warehouse/v1/inspections", headers: headers
    expect(response).to have_http_status(:ok)
    expect(json_response["success"]).to eq(true)

    get "/cats_warehouse/v1/waybills", headers: headers
    expect(response).to have_http_status(:ok)
    expect(json_response["success"]).to eq(true)
  end
end
