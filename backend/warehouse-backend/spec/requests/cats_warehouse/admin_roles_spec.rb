require "rails_helper"

RSpec.describe "Cats Warehouse Admin Roles", type: :request do
  it "lists roles for the warehouse module" do
    admin_headers = auth_headers(role: "Admin")

    get "/cats_warehouse/v1/admin/roles", headers: admin_headers

    expect(response).to have_http_status(:ok)
    roles = JSON.parse(response.body).dig("data", "roles")
    expect(roles).to be_present
  end
end
