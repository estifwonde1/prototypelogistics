require "json"
require "rack/test"
require "securerandom"

def json_request(session, method, path, payload: nil)
  headers = { "CONTENT_TYPE" => "application/json", "ACCEPT" => "application/json" }
  body = payload ? payload.to_json : nil
  session.send(method, path, body, headers)
  response_body = session.last_response.body.to_s
  parsed = if response_body.empty?
    {}
  else
    begin
      JSON.parse(response_body)
    rescue JSON::ParserError
      { "_raw" => response_body }
    end
  end
  [session.last_response.status, parsed]
end

def assert_ok!(label, status, parsed)
  unless status.between?(200, 299) && parsed["success"] == true
    raise "#{label} failed: status=#{status} body=#{parsed.inspect}"
  end
end

app = Rails.application
session = Rack::Test::Session.new(Rack::MockSession.new(app))
session.header "Host", "localhost"
code_suffix = SecureRandom.hex(4).upcase

program = Cats::Core::Program.create!(
  code: "TP-#{code_suffix}",
  name: "Test Program"
)
donor = Cats::Core::Donor.create!(
  code: "DON-#{code_suffix}",
  name: "Test Donor"
)
project = Cats::Core::Project.create!(
  code: "PRJ-#{code_suffix}",
  program: program,
  source: donor,
  year: Date.today.year,
  implementing_agency: "Test Agency"
)
unit = Cats::Core::UnitOfMeasure.create!(
  name: "Kilogram #{code_suffix}",
  abbreviation: "kg#{code_suffix.downcase}",
  unit_type: "Weight"
)
location = Cats::Core::Location.create!(
  code: "LOC-#{code_suffix}",
  name: "Test Location",
  location_type: "Region"
)
commodity = Cats::Core::Commodity.create!(
  batch_no: "BATCH-#{code_suffix}",
  unit_of_measure: unit,
  project: project,
  quantity: 100,
  best_use_before: Date.today + 365
)

status, parsed = json_request(
  session,
  :post,
  "/cats_warehouse/v1/hubs",
  payload: { payload: { location_id: location.id, name: "Hub A" } }
)
assert_ok!("Create hub", status, parsed)
hub_id = parsed.dig("data", "id")

status, parsed = json_request(session, :get, "/cats_warehouse/v1/hubs/#{hub_id}")
assert_ok!("Show hub", status, parsed)

status, parsed = json_request(
  session,
  :patch,
  "/cats_warehouse/v1/hubs/#{hub_id}",
  payload: { payload: { name: "Hub A2" } }
)
assert_ok!("Update hub", status, parsed)

status, parsed = json_request(session, :delete, "/cats_warehouse/v1/hubs/#{hub_id}")
assert_ok!("Delete hub", status, parsed)

status, parsed = json_request(
  session,
  :post,
  "/cats_warehouse/v1/hubs",
  payload: { payload: { location_id: location.id, name: "Hub B" } }
)
assert_ok!("Create hub (again)", status, parsed)
hub_id = parsed.dig("data", "id")

status, parsed = json_request(
  session,
  :post,
  "/cats_warehouse/v1/warehouses",
  payload: { payload: { location_id: location.id, hub_id: hub_id, name: "Warehouse A" } }
)
assert_ok!("Create warehouse", status, parsed)
warehouse_id = parsed.dig("data", "id")

status, parsed = json_request(session, :get, "/cats_warehouse/v1/warehouses/#{warehouse_id}")
assert_ok!("Show warehouse", status, parsed)

status, parsed = json_request(
  session,
  :patch,
  "/cats_warehouse/v1/warehouses/#{warehouse_id}",
  payload: { payload: { status: "Active" } }
)
assert_ok!("Update warehouse", status, parsed)

status, parsed = json_request(
  session,
  :post,
  "/cats_warehouse/v1/stores",
  payload: {
    payload: {
      warehouse_id: warehouse_id,
      name: "Store A",
      length: 10,
      width: 8,
      height: 4,
      usable_space: 320,
      available_space: 320,
      temporary: false,
      has_gangway: false
    }
  }
)
assert_ok!("Create store", status, parsed)
store_id = parsed.dig("data", "id")

status, parsed = json_request(session, :get, "/cats_warehouse/v1/stores/#{store_id}")
assert_ok!("Show store", status, parsed)

status, parsed = json_request(
  session,
  :patch,
  "/cats_warehouse/v1/stores/#{store_id}",
  payload: { payload: { available_space: 300 } }
)
assert_ok!("Update store", status, parsed)

status, parsed = json_request(
  session,
  :post,
  "/cats_warehouse/v1/stacks",
  payload: {
    payload: {
      store_id: store_id,
      commodity_id: commodity.id,
      unit_id: unit.id,
      length: 2,
      width: 2,
      height: 2,
      quantity: 10
    }
  }
)
assert_ok!("Create stack", status, parsed)
stack_id = parsed.dig("data", "id")

status, parsed = json_request(session, :get, "/cats_warehouse/v1/stacks/#{stack_id}")
assert_ok!("Show stack", status, parsed)

status, parsed = json_request(
  session,
  :patch,
  "/cats_warehouse/v1/stacks/#{stack_id}",
  payload: { payload: { stack_status: "In Use" } }
)
assert_ok!("Update stack", status, parsed)

status, parsed = json_request(session, :get, "/cats_warehouse/v1/grns")
assert_ok!("List GRNs", status, parsed)

status, parsed = json_request(session, :get, "/cats_warehouse/v1/gins")
assert_ok!("List GINs", status, parsed)

status, parsed = json_request(session, :get, "/cats_warehouse/v1/inspections")
assert_ok!("List inspections", status, parsed)

status, parsed = json_request(session, :get, "/cats_warehouse/v1/waybills")
assert_ok!("List waybills", status, parsed)

puts "Phase 6 smoke test passed."
