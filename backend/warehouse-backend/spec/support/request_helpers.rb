module RequestHelpers
  def json_response
    JSON.parse(response.body)
  end

  def auth_headers(role: "Admin", user: nil)
    user ||= create(:cats_core_user, role_name: role)
    token = user.signed_id(purpose: "auth", expires_in: 1.hour)
    {
      "Authorization" => "Bearer #{token}",
      "Content-Type" => "application/json"
    }
  end
end

RSpec.configure do |config|
  config.include RequestHelpers, type: :request
end
