require "rails_helper"

RSpec.describe "Cats::Warehouse Auth", type: :request do
  it "returns a token for valid credentials" do
    module_rec = Cats::Core::ApplicationModule.find_or_create_by!(prefix: "core") { |m| m.name = "Core" }
    user = Cats::Core::User.create!(
      first_name: "Auth",
      last_name: "User",
      email: "auth@example.com",
      password: "Password1!",
      application_module: module_rec
    )

    post "/cats_warehouse/v1/auth/login", params: {
      payload: { email: user.email, password: "Password1!" }
    }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["success"]).to be(true)
    expect(body.dig("data", "token")).to be_present
  end
end
