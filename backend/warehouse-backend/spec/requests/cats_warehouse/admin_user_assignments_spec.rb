require "rails_helper"

RSpec.describe "Cats Warehouse Admin UserAssignments", type: :request do
  it "bulk updates assignments for a hub manager" do
    admin_headers = auth_headers(role: "Admin")
    user = create(:cats_core_user, role_name: "Hub Manager")
    hub_a = create(:cats_warehouse_hub)
    hub_b = create(:cats_warehouse_hub)

    patch "/cats_warehouse/v1/admin/user_assignments/bulk",
          params: {
            payload: {
              user_id: user.id,
              role_name: "Hub Manager",
              hub_ids: [hub_a.id, hub_b.id]
            }
          },
          as: :json,
          headers: admin_headers

    expect(response).to have_http_status(:ok)
    assignments = JSON.parse(response.body).dig("data", "assignments")
    expect(assignments.length).to eq(2)
  end

  it "deletes an assignment" do
    admin_headers = auth_headers(role: "Admin")
    assignment = create(:cats_warehouse_user_assignment)

    delete "/cats_warehouse/v1/admin/user_assignments/#{assignment.id}", headers: admin_headers

    expect(response).to have_http_status(:ok)
  end

  it "rejects invalid bulk payloads" do
    admin_headers = auth_headers(role: "Admin")
    user = create(:cats_core_user, role_name: "Hub Manager")

    patch "/cats_warehouse/v1/admin/user_assignments/bulk",
          params: { payload: { user_id: user.id, role_name: "Hub Manager", hub_ids: [] } },
          as: :json,
          headers: admin_headers

    expect(response).to have_http_status(:ok)
    assignments = JSON.parse(response.body).dig("data", "assignments")
    expect(assignments).to eq([])
  end

  it "rejects non-admin access" do
    headers = auth_headers(role: "Storekeeper")
    get "/cats_warehouse/v1/admin/user_assignments", headers: headers
    expect(response).to have_http_status(:forbidden)
  end
end
