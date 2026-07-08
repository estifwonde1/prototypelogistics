require "rails_helper"

RSpec.describe "Cats::Warehouse notifications", type: :request do
  let(:user) { create(:cats_core_user, role_name: "Warehouse Manager") }
  let(:headers) { { "Authorization" => "Bearer #{user.signed_id(purpose: "auth", expires_in: 1.hour)}" } }

  before do
    Cats::Warehouse::InAppNotification.create!(
      recipient: user,
      type: "receipt_order.confirmed",
      params: { "path" => "/receipt-orders/1", "receipt_order_id" => 1 }
    )
  end

  it "lists notifications for the current user" do
    get "/cats_warehouse/v1/notifications", headers: headers
    expect(response).to have_http_status(:ok)
    body = json_response
    expect(body["success"]).to be(true)
    items = body["data"]
    expect(items).to be_an(Array)
    expect(items.first["type"]).to eq("receipt_order.confirmed")
    expect(items.first["params"]["path"]).to eq("/receipt-orders/1")
  end

  it "returns unread count" do
    get "/cats_warehouse/v1/notifications/unread_count", headers: headers
    expect(response).to have_http_status(:ok)
    expect(json_response.dig("data", "count")).to eq(1)
  end

  it "marks one notification read" do
    n = Cats::Warehouse::InAppNotification.where(recipient: user).first
    patch "/cats_warehouse/v1/notifications/#{n.id}/read", headers: headers
    expect(response).to have_http_status(:ok)
    expect(n.reload.read_at).to be_present
  end

  it "marks all read" do
    patch "/cats_warehouse/v1/notifications/read_all", headers: headers
    expect(response).to have_http_status(:ok)
    expect(Cats::Warehouse::InAppNotification.where(recipient: user).unread.count).to eq(0)
  end
end
