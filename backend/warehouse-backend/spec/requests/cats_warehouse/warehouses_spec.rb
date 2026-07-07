require "rails_helper"
require "tempfile"
require "securerandom"

RSpec.describe "Cats Warehouse Warehouses", type: :request do
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

  def create_warehouse(hub:, name: "Warehouse")
    Cats::Warehouse::Warehouse.create!(
      hub: hub,
      location: hub.location,
      name: "#{name} #{SecureRandom.hex(3)}",
      managed_under: "Hub",
      ownership_type: "self_owned"
    )
  end

  it "returns live Warehouse Manager contact details from assignments" do
    admin = create_user(role_name: "Admin")
    warehouse_manager = create_user(
      role_name: "Warehouse Manager",
      first_name: "Tigist",
      last_name: "Wondimu",
      phone_number: "0911111117"
    )
    headers = auth_headers_for(admin)
    hub = create_hub
    warehouse = create_warehouse(hub: hub)

    Cats::Warehouse::WarehouseContacts.create!(
      warehouse: warehouse,
      manager_name: "Samuel Alemu",
      contact_phone: "0913000002",
      contact_email: "stale@example.com"
    )

    post "/cats_warehouse/v1/admin/user_assignments",
         params: {
           payload: {
             user_id: warehouse_manager.id,
             role_name: "Warehouse Manager",
             warehouse_ids: [warehouse.id]
           }
         },
         as: :json,
         headers: headers
    expect(response).to have_http_status(:created)

    get "/cats_warehouse/v1/warehouses/#{warehouse.id}", headers: headers
    expect(response).to have_http_status(:ok)
    contacts = parsed_response.dig("data", "warehouse_contacts")
    expect(contacts["manager_name"]).to eq("Tigist Wondimu")
    expect(contacts["contact_phone"]).to eq("0911111117")
    expect(contacts["contact_email"]).to eq(warehouse_manager.email)

    get "/cats_warehouse/v1/warehouses/#{warehouse.id}/contacts", headers: headers
    expect(response).to have_http_status(:ok)
    expect(parsed_response.dig("data", "warehouse_contacts", "manager_name")).to eq("Tigist Wondimu")
    expect(parsed_response.dig("data", "warehouse_contacts", "contact_phone")).to eq("0911111117")
    expect(parsed_response.dig("data", "warehouse_contacts", "contact_email")).to eq(warehouse_manager.email)
  end

  it "prefers the most recent Warehouse Manager when duplicate assignments exist" do
    admin = create_user(role_name: "Admin")
    stale_manager = create_user(
      role_name: "Warehouse Manager",
      first_name: "test",
      last_name: "warehouse",
      phone_number: "0910989875"
    )
    current_manager = create_user(
      role_name: "Warehouse Manager",
      first_name: "Tigist",
      last_name: "Wondimu",
      phone_number: "0911111117"
    )
    headers = auth_headers_for(admin)
    warehouse = create_warehouse(hub: create_hub)

    Cats::Warehouse::UserAssignment.create!(
      user: stale_manager,
      warehouse: warehouse,
      role_name: "Warehouse Manager"
    )
    Cats::Warehouse::UserAssignment.create!(
      user: current_manager,
      warehouse: warehouse,
      role_name: "Warehouse Manager"
    )

    get "/cats_warehouse/v1/warehouses/#{warehouse.id}", headers: headers
    expect(response).to have_http_status(:ok)
    contacts = parsed_response.dig("data", "warehouse_contacts")
    expect(contacts["manager_name"]).to eq("Tigist Wondimu")
    expect(contacts["contact_phone"]).to eq("0911111117")
    expect(contacts["contact_email"]).to eq(current_manager.email)
  end

  it "removes other Warehouse Manager assignments when a new manager is assigned" do
    admin = create_user(role_name: "Admin")
    stale_manager = create_user(role_name: "Warehouse Manager", first_name: "Stale", last_name: "Manager")
    current_manager = create_user(role_name: "Warehouse Manager", first_name: "Tigist", last_name: "Wondimu")
    headers = auth_headers_for(admin)
    warehouse = create_warehouse(hub: create_hub)

    Cats::Warehouse::UserAssignment.create!(
      user: stale_manager,
      warehouse: warehouse,
      role_name: "Warehouse Manager"
    )

    post "/cats_warehouse/v1/admin/user_assignments",
         params: {
           payload: {
             user_id: current_manager.id,
             role_name: "Warehouse Manager",
             warehouse_ids: [warehouse.id]
           }
         },
         as: :json,
         headers: headers
    expect(response).to have_http_status(:created)

    expect(
      Cats::Warehouse::UserAssignment.where(warehouse_id: warehouse.id, role_name: "Warehouse Manager").pluck(:user_id)
    ).to eq([current_manager.id])
  end

  it "derives warehouse location and managed_under from the hub" do
    admin = create_user(role_name: "Admin")
    headers = auth_headers_for(admin)
    location = create_location(name: "Other Location")
    hub = create_hub

    post "/cats_warehouse/v1/warehouses",
         params: { payload: { location_id: location.id, hub_id: hub.id, name: "Warehouse A", ownership_type: "self_owned" } },
         as: :json,
         headers: headers
    expect(response).to have_http_status(:created)
    warehouse_id = parsed_response.dig("data", "id")

    get "/cats_warehouse/v1/warehouses/#{warehouse_id}", headers: headers
    expect(response).to have_http_status(:ok)
    expect(parsed_response.dig("data", "id")).to eq(warehouse_id)
    expect(parsed_response.dig("data", "location_id")).to eq(hub.location_id)
    expect(parsed_response.dig("data", "managed_under")).to eq("Hub")
    expect(parsed_response.dig("data", "ownership_type")).to eq("self_owned")

    patch "/cats_warehouse/v1/warehouses/#{warehouse_id}",
          params: { payload: { status: "Active" } },
          as: :json,
          headers: headers
    expect(response).to have_http_status(:ok)

    delete "/cats_warehouse/v1/warehouses/#{warehouse_id}", headers: headers
    expect(response).to have_http_status(:ok)
  end

  it "requires a rental agreement document for rental warehouses" do
    admin = create_user(role_name: "Admin")
    headers = auth_headers_for(admin)
    hub = create_hub

    post "/cats_warehouse/v1/warehouses",
         params: { payload: { hub_id: hub.id, name: "Warehouse Rental", ownership_type: "rental" } },
         as: :json,
         headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(parsed_response.dig("error", "message")).to be_present
  end

  it "accepts rental warehouses when a rental agreement document is attached" do
    admin = create_user(role_name: "Admin")
    headers = auth_headers_for(admin)
    hub = create_hub
    file = Tempfile.new(["rental-agreement", ".pdf"])
    file.write("sample rental agreement")
    file.rewind

    post "/cats_warehouse/v1/warehouses",
         params: {
           payload: {
             hub_id: hub.id,
             name: "Warehouse Rental",
             ownership_type: "rental",
             rental_agreement_document: Rack::Test::UploadedFile.new(file.path, "application/pdf")
           }
         },
         headers: headers

    expect(response).to have_http_status(:created)
    expect(parsed_response.dig("data", "rental_agreement_document", "filename")).to eq(File.basename(file.path))
  ensure
    file.close! if file
  end
end
