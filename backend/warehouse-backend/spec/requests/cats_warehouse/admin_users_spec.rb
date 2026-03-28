require "rails_helper"

RSpec.describe "Cats Warehouse Admin Users", type: :request do
  it "lists users filtered by warehouse and role" do
    admin_headers = auth_headers(role: "Admin")

    warehouse = create(:cats_warehouse_warehouse)
    user = create(:cats_core_user, role_name: "Warehouse Manager")
    create(:cats_warehouse_user_assignment, user: user, warehouse: warehouse, role_name: "Warehouse Manager")

    get "/cats_warehouse/v1/admin/users",
        params: { warehouse_id: warehouse.id, role_name: "Warehouse Manager" },
        headers: admin_headers

    expect(response).to have_http_status(:ok)
    ids = JSON.parse(response.body).dig("data", "users").map { |u| u["id"] }
    expect(ids).to include(user.id)
  end

  it "creates a user with role" do
    admin_headers = auth_headers(role: "Admin")

    payload = {
      payload: {
        first_name: "New",
        last_name: "User",
        email: "new.user@example.com",
        password: "Password1!",
        password_confirmation: "Password1!",
        phone_number: "0919000000",
        role_name: "Storekeeper"
      }
    }

    post "/cats_warehouse/v1/admin/users", params: payload, as: :json, headers: admin_headers

    expect(response).to have_http_status(:created)
    body = JSON.parse(response.body)
    expect(body.dig("data", "user", "email")).to eq("new.user@example.com")
  end

  it "updates and deletes a user" do
    admin_headers = auth_headers(role: "Admin")
    user = create(:cats_core_user, role_name: "Storekeeper")

    patch "/cats_warehouse/v1/admin/users/#{user.id}",
          params: { payload: { first_name: "Updated", last_name: "Name" } },
          as: :json,
          headers: admin_headers

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig("data", "user", "first_name")).to eq("Updated")

    delete "/cats_warehouse/v1/admin/users/#{user.id}", headers: admin_headers
    expect(response).to have_http_status(:ok)
  end

  it "rejects non-admin access" do
    headers = auth_headers(role: "Storekeeper")
    get "/cats_warehouse/v1/admin/users", headers: headers
    expect(response).to have_http_status(:forbidden)
  end
end
