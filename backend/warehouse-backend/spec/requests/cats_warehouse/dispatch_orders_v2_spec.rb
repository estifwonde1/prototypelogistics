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
  let(:source_wh) { create(:cats_warehouse_warehouse, hub: nil, managed_under: "federal") }
  let(:dest_location) { source_wh.location }

  let(:v2_payload) do
    {
      payload: {
        plan_reference: "PLAN-#{SecureRandom.hex(4)}",
        description: "v2 test order",
        lines: [{
          commodity_id: commodity.id,
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
  end

  it "creates a v2 dispatch order with balanced allocations" do
    post "/cats_warehouse/v1/dispatch_orders", params: v2_payload, headers: auth_headers_for(officer), as: :json

    expect(response).to have_http_status(:created)
    body = JSON.parse(response.body)
    expect(body.dig("data", "plan_reference")).to eq(v2_payload[:payload][:plan_reference])
    expect(body.dig("data", "dispatch_order_lines")).to be_present
  end

  it "self-approves for creator only" do
    post "/cats_warehouse/v1/dispatch_orders", params: v2_payload, headers: auth_headers_for(officer), as: :json
    order_id = JSON.parse(response.body).dig("data", "id")

    post "/cats_warehouse/v1/dispatch_orders/#{order_id}/self_approve",
         headers: auth_headers_for(officer),
         as: :json
    expect(response).to have_http_status(:ok)

    post "/cats_warehouse/v1/dispatch_orders/#{order_id}/self_approve",
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
