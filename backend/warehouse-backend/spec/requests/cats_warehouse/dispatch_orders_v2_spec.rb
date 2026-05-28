# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Dispatch orders v2 API", type: :request do
  around do |example|
    previous = ENV["ENABLE_OFFICER_DISPATCH_V2"]
    ENV["ENABLE_OFFICER_DISPATCH_V2"] = "true"
    example.run
  ensure
    ENV["ENABLE_OFFICER_DISPATCH_V2"] = previous
  end

  def auth_headers_for(user)
    { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" }
  end

  let(:officer) { create(:cats_core_user, role_name: "Federal Officer") }
  let(:other_officer) { create(:cats_core_user, role_name: "Federal Officer") }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { commodity.unit_of_measure }
  let!(:commodity_definition) do
    Cats::Warehouse::CommodityDefinition.create!(
      name: commodity.name,
      commodity_code: "SPEC-#{SecureRandom.hex(3).upcase}",
      commodity_category_id: commodity.commodity_category_id
    )
  end
  let(:source_wh) { create(:cats_warehouse_warehouse, hub: nil, managed_under: "federal") }
  let(:dest_location) { source_wh.location }

  let(:v2_payload) do
    {
      payload: {
        description: "v2 test order",
        lines: [{
          commodity_definition_id: commodity_definition.id,
          quantity: 100,
          unit_id: unit.id,
          source_allocations: [{ warehouse_id: source_wh.id, quantity: 100, unit_id: unit.id }],
          destination_allocations: [{ destination_location_id: dest_location.id, quantity: 100, unit_id: unit.id }]
        }]
      }
    }
  end

  before do
    allow(Cats::Warehouse::NotificationFanout).to receive(:deliver)

    Cats::Warehouse::StockBalance.where(warehouse_id: source_wh.id, commodity_id: commodity.id).delete_all
    Cats::Warehouse::StockBalance.create!(
      warehouse: source_wh,
      store: nil,
      stack: nil,
      commodity: commodity,
      quantity: 500,
      unit: unit,
      base_quantity: 500,
      base_unit_id: unit.id,
      available_quantity: 500,
      reserved_quantity: 0
    )
  end

  it "creates a v2 dispatch order with balanced allocations" do
    post "/cats_warehouse/v1/dispatch_orders", params: v2_payload, headers: auth_headers_for(officer), as: :json

    expect(response).to have_http_status(:created)
    body = JSON.parse(response.body)
    expect(body.dig("data", "reference_no")).to eq("DO-#{body.dig('data', 'id')}")
    expect(body.dig("data", "dispatch_reference")).to eq(body.dig("data", "reference_no"))
    expect(body.dig("data", "dispatch_order_lines")).to be_present
    line = body.dig("data", "dispatch_order_lines").first
    expect(line["source_allocations"]).to be_present
    expect(line["destination_allocations"]).to be_present
    expect(line.dig("source_allocations", 0, "warehouse_id")).to eq(source_wh.id)
    expect(line.dig("destination_allocations", 0, "destination_location_id")).to eq(dest_location.id)
  end

  it "includes nested allocations on GET show" do
    post "/cats_warehouse/v1/dispatch_orders", params: v2_payload, headers: auth_headers_for(officer), as: :json
    order_id = JSON.parse(response.body).dig("data", "id")

    get "/cats_warehouse/v1/dispatch_orders/#{order_id}", headers: auth_headers_for(officer), as: :json
    expect(response).to have_http_status(:ok)
    line = JSON.parse(response.body).dig("data", "dispatch_order_lines").first
    expect(line["source_allocations"]).to be_present
    expect(line["destination_allocations"]).to be_present
  end

  it "confirms (and approves) for creator only on v2" do
    post "/cats_warehouse/v1/dispatch_orders", params: v2_payload, headers: auth_headers_for(officer), as: :json
    order_id = JSON.parse(response.body).dig("data", "id")

    post "/cats_warehouse/v1/dispatch_orders/#{order_id}/confirm",
         headers: auth_headers_for(other_officer),
         as: :json
    expect(response).to have_http_status(:forbidden)

    post "/cats_warehouse/v1/dispatch_orders/#{order_id}/confirm",
         headers: auth_headers_for(officer),
         as: :json
    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig("data", "status").to_s.downcase).to eq("confirmed")
    expect(body.dig("data", "approved_at")).to be_present
    expect(body.dig("data", "can_self_approve")).to eq(false)
  end

  it "allows creator to delete confirmed order before warehouse authorization" do
    post "/cats_warehouse/v1/dispatch_orders", params: v2_payload, headers: auth_headers_for(officer), as: :json
    order_id = JSON.parse(response.body).dig("data", "id")

    post "/cats_warehouse/v1/dispatch_orders/#{order_id}/confirm",
         headers: auth_headers_for(officer),
         as: :json
    expect(response).to have_http_status(:ok)

    delete "/cats_warehouse/v1/dispatch_orders/#{order_id}",
           headers: auth_headers_for(officer),
           as: :json
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig("data", "id")).to eq(order_id)
    expect(Cats::Warehouse::DispatchOrder.find_by(id: order_id)).to be_nil
  end

  it "rejects delete by non-creator" do
    post "/cats_warehouse/v1/dispatch_orders", params: v2_payload, headers: auth_headers_for(officer), as: :json
    order_id = JSON.parse(response.body).dig("data", "id")

    delete "/cats_warehouse/v1/dispatch_orders/#{order_id}",
           headers: auth_headers_for(other_officer),
           as: :json
    expect(response).to have_http_status(:forbidden)
  end

  it "returns 404 for v2-only endpoints when feature disabled" do
    ENV["ENABLE_OFFICER_DISPATCH_V2"] = "false"

    post "/cats_warehouse/v1/dispatch_orders/1/self_approve",
         headers: auth_headers_for(officer),
         as: :json
    expect(response).to have_http_status(:not_found)
  end
end
