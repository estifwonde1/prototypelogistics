require "rails_helper"

RSpec.describe "Cats Warehouse Me Profile", type: :request do
  let(:user) do
    create(
      :cats_core_user,
      role_name: "Storekeeper",
      first_name: "Jane",
      last_name: "Doe",
      email: "jane.doe@example.com",
      phone_number: "0919000000",
      password: "Password1!"
    )
  end

  let(:headers) do
    { "Authorization" => "Bearer #{user.signed_id(purpose: 'auth', expires_in: 1.hour)}" }
  end

  describe "GET /cats_warehouse/v1/me/profile" do
    it "returns the current user's profile" do
      get "/cats_warehouse/v1/me/profile", headers: headers

      expect(response).to have_http_status(:ok)
      profile = JSON.parse(response.body).dig("data", "profile")
      expect(profile).to include(
        "id" => user.id,
        "first_name" => "Jane",
        "last_name" => "Doe",
        "email" => "jane.doe@example.com",
        "phone_number" => "0919000000"
      )
      expect(profile["roles"]).to include("Storekeeper")
    end

    it "rejects unauthenticated requests" do
      get "/cats_warehouse/v1/me/profile"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH /cats_warehouse/v1/me/profile" do
    it "updates phone_number" do
      patch "/cats_warehouse/v1/me/profile",
            params: { payload: { phone_number: "251911223344" } },
            as: :json,
            headers: headers

      expect(response).to have_http_status(:ok)
      profile = JSON.parse(response.body).dig("data", "profile")
      expect(profile["phone_number"]).to eq("251911223344")
      expect(user.reload.phone_number).to eq("251911223344")
    end

    it "does not change name or email when those fields are sent" do
      patch "/cats_warehouse/v1/me/profile",
            params: {
              payload: {
                phone_number: "0919112233",
                first_name: "Changed",
                last_name: "Name",
                email: "changed@example.com"
              }
            },
            as: :json,
            headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      user.reload
      expect(user.first_name).to eq("Jane")
      expect(user.last_name).to eq("Doe")
      expect(user.email).to eq("jane.doe@example.com")
    end

    it "rejects unauthenticated requests" do
      patch "/cats_warehouse/v1/me/profile",
            params: { payload: { phone_number: "0919112233" } },
            as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH /cats_warehouse/v1/me/password" do
    it "changes password with correct current password" do
      patch "/cats_warehouse/v1/me/password",
            params: {
              payload: {
                current_password: "Password1!",
                password: "NewPassword2!",
                password_confirmation: "NewPassword2!"
              }
            },
            as: :json,
            headers: headers

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig("data", "changed")).to eq(true)
      expect(user.reload.authenticate("NewPassword2!")).to be_truthy
    end

    it "rejects wrong current password" do
      patch "/cats_warehouse/v1/me/password",
            params: {
              payload: {
                current_password: "WrongPassword!",
                password: "NewPassword2!",
                password_confirmation: "NewPassword2!"
              }
            },
            as: :json,
            headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).dig("error", "message")).to eq("Current password is incorrect")
    end

    it "rejects mismatched password confirmation" do
      patch "/cats_warehouse/v1/me/password",
            params: {
              payload: {
                current_password: "Password1!",
                password: "NewPassword2!",
                password_confirmation: "DifferentPassword!"
              }
            },
            as: :json,
            headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).dig("error", "message")).to eq("Password confirmation does not match")
    end

    it "rejects unauthenticated requests" do
      patch "/cats_warehouse/v1/me/password",
            params: {
              payload: {
                current_password: "Password1!",
                password: "NewPassword2!",
                password_confirmation: "NewPassword2!"
              }
            },
            as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
