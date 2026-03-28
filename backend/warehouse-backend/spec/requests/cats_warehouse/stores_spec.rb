require "rails_helper"
require "securerandom"

RSpec.describe "Cats Warehouse Stores", type: :request do
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

  def create_warehouse(name: "Warehouse")
    Cats::Warehouse::Warehouse.create!(
      location: create_location(name: "Warehouse Location"),
      hub: create_hub,
      name: "#{name} #{SecureRandom.hex(3)}",
      warehouse_type: "Main",
      status: "Active",
      ownership_type: "self_owned"
    )
  end

  it "supports CRUD" do
    user = create_user(role_name: "Admin")
    headers = auth_headers_for(user)
    warehouse = create_warehouse

    post "/cats_warehouse/v1/stores",
         params: {
           payload: {
             warehouse_id: warehouse.id,
             name: "Store A",
             length: 10,
             width: 8,
             height: 4,
             temporary: false,
             has_gangway: false
           }
         },
         as: :json,
         headers: headers
    expect(response).to have_http_status(:created)
    store_id = parsed_response.dig("data", "id")

    get "/cats_warehouse/v1/stores/#{store_id}", headers: headers
    expect(response).to have_http_status(:ok)
    expect(parsed_response.dig("data", "id")).to eq(store_id)

    patch "/cats_warehouse/v1/stores/#{store_id}",
          params: { payload: { temporary: true } },
          as: :json,
          headers: headers
    expect(response).to have_http_status(:ok)

    delete "/cats_warehouse/v1/stores/#{store_id}", headers: headers
    expect(response).to have_http_status(:ok)
  end

  it "computes store spaces on the backend and enforces warehouse dimensions" do
    user = create_user(role_name: "Warehouse Manager")
    headers = auth_headers_for(user)
    warehouse = create_warehouse
    Cats::Warehouse::UserAssignment.create!(
      user: user,
      warehouse: warehouse,
      role_name: "Warehouse Manager"
    )
    Cats::Warehouse::WarehouseCapacity.create!(
      warehouse: warehouse,
      total_area_sqm: 500,
      total_storage_capacity_mt: 1000,
      length_m: 20,
      width_m: 12,
      height_m: 6
    )

    post "/cats_warehouse/v1/stores",
         params: {
           payload: {
             warehouse_id: warehouse.id,
             name: "Store B",
             length: 10,
             width: 8,
             height: 4,
             temporary: false,
             has_gangway: false
           }
         },
         as: :json,
         headers: headers

    expect(response).to have_http_status(:created)
    expect(parsed_response.dig("data", "available_space")).to eq(80.0)
    expect(parsed_response.dig("data", "usable_space")).to eq(48.0)

    post "/cats_warehouse/v1/stores",
         params: {
           payload: {
             warehouse_id: warehouse.id,
             name: "Store Too Wide",
             length: 10,
             width: 13,
             height: 4,
             temporary: false,
             has_gangway: false
           }
         },
         as: :json,
         headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(parsed_response.dig("error", "message")).to include("Width must not exceed")
  end

  it "blocks storekeepers from creating stores" do
    user = create_user(role_name: "Storekeeper")
    headers = auth_headers_for(user)
    warehouse = create_warehouse

    post "/cats_warehouse/v1/stores",
         params: {
           payload: {
             warehouse_id: warehouse.id,
             name: "Store C",
             length: 10,
             width: 8,
             height: 4,
             temporary: false,
             has_gangway: false
           }
         },
         as: :json,
         headers: headers

    expect(response).to have_http_status(:forbidden)
  end
end
