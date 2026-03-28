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
