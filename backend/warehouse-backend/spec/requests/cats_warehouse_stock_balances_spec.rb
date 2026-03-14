require "rails_helper"

RSpec.describe "Cats::Warehouse StockBalances", type: :request do
  it "lists stock balances with auth" do
    module_rec = Cats::Core::ApplicationModule.find_or_create_by!(prefix: "core") { |m| m.name = "Core" }
    user = Cats::Core::User.create!(
      first_name: "Stock",
      last_name: "Viewer",
      email: "stock@example.com",
      password: "Password1!",
      application_module: module_rec
    )

    role = Cats::Core::Role.find_or_create_by!(name: "Warehouse Manager", application_module_id: module_rec.id)
    user.roles << role unless user.roles.exists?(role.id)

    token = user.signed_id(purpose: "auth", expires_in: 1.hour)

    get "/cats_warehouse/v1/stock_balances", headers: { "Authorization" => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
  end
end
