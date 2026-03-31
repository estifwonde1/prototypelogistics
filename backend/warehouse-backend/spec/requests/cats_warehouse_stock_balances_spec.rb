require "rails_helper"

RSpec.describe "Cats::Warehouse StockBalances", type: :request do
  it "lists stock balances with auth" do
    get "/cats_warehouse/v1/stock_balances", headers: auth_headers(role: "Warehouse Manager")
    expect(response).to have_http_status(:ok)
  end
end
