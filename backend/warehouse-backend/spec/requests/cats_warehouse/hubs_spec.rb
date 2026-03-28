require "rails_helper"
require "tempfile"
require "securerandom"

RSpec.describe "Cats Warehouse Hubs", type: :request do
  def auth_headers_for(user)
    { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" }
  end

  def parsed_response
    JSON.parse(response.body)
  end

  def create_user(role_name:, first_name: "Test", last_name: "User", phone_number: "0911000000")
    app_module = Cats::Core::ApplicationModule.find_or_create_by!(prefix: "CATS-WH") { |mod| mod.name = "Warehouse" }
    user = Cats::Core::User.create!(
      first_name: first_name,
      last_name: last_name,
      email: "#{role_name.parameterize}-#{SecureRandom.hex(4)}@example.com",
      password: "Password1!",
      phone_number: phone_number,
      application_module: app_module
    )
    role = Cats::Core::Role.find_or_create_by!(name: role_name, application_module_id: app_module.id)
    user.roles << role unless user.roles.exists?(role.id)
    user
  end

  def create_location(name: "Location")
    Cats::Core::Location.create!(
      name: "#{name} #{SecureRandom.hex(3)}",
      code: "LOC-#{SecureRandom.hex(3)}",
      location_type: "Region"
    )
  end

  def create_hub(location: create_location, name: "Hub")
    Cats::Warehouse::Hub.create!(
      location: location,
      name: "#{name} #{SecureRandom.hex(3)}"
    )
  end

  def create_warehouse(hub:, location: hub.location, name: "Warehouse")
    Cats::Warehouse::Warehouse.create!(
      hub: hub,
      location: location,
      name: "#{name} #{SecureRandom.hex(3)}",
      ownership_type: "self_owned"
    )
  end

  it "supports CRUD without exposing location_id in the overview payload" do
    admin = create_user(role_name: "Admin")
    headers = auth_headers_for(admin)
    location = create_location

    post "/cats_warehouse/v1/hubs",
         params: { payload: { location_id: location.id, name: "Hub A" } },
         as: :json,
         headers: headers
    expect(response).to have_http_status(:created)
    hub_id = parsed_response.dig("data", "id")

    get "/cats_warehouse/v1/hubs/#{hub_id}", headers: headers
    expect(response).to have_http_status(:ok)
    expect(parsed_response.dig("data", "id")).to eq(hub_id)
    expect(parsed_response.dig("data")).not_to have_key("location_id")

    patch "/cats_warehouse/v1/hubs/#{hub_id}",
          params: { payload: { status: "Active" } },
          as: :json,
          headers: headers
    expect(response).to have_http_status(:ok)

    delete "/cats_warehouse/v1/hubs/#{hub_id}", headers: headers
    expect(response).to have_http_status(:ok)
  end

  it "returns computed capacity totals from child warehouses" do
    admin = create_user(role_name: "Admin")
    headers = auth_headers_for(admin)
    hub = create_hub
    warehouse = create_warehouse(hub: hub)

    post "/cats_warehouse/v1/warehouses/#{warehouse.id}/capacity",
         params: {
           payload: {
             total_area_sqm: 125.5,
             total_storage_capacity_mt: 80
           }
         },
         as: :json,
         headers: headers
    expect(response).to have_http_status(:created)

    get "/cats_warehouse/v1/hubs/#{hub.id}/capacity", headers: headers
    expect(response).to have_http_status(:ok)
    expect(parsed_response.dig("data", "total_area_sqm")).to eq(125.5)
    expect(parsed_response.dig("data", "total_capacity_mt")).to eq(80.0)
  end

  it "returns live Hub Manager contact details from assignments" do
    admin = create_user(role_name: "Admin")
    hub_manager = create_user(role_name: "Hub Manager", first_name: "Helen", last_name: "Manager", phone_number: "0911223344")
    headers = auth_headers_for(admin)
    hub = create_hub

    post "/cats_warehouse/v1/admin/user_assignments",
         params: {
           payload: {
             user_id: hub_manager.id,
             role_name: "Hub Manager",
             hub_ids: [hub.id]
           }
         },
         as: :json,
         headers: headers
    expect(response).to have_http_status(:created)

    get "/cats_warehouse/v1/hubs/#{hub.id}/contacts", headers: headers
    expect(response).to have_http_status(:ok)
    expect(parsed_response.dig("data", "hub_contacts", "manager_name")).to eq("Helen Manager")
    expect(parsed_response.dig("data", "hub_contacts", "contact_phone")).to eq("0911223344")
    expect(parsed_response.dig("data", "hub_contacts", "contact_email")).to eq(hub_manager.email)
  end
end
