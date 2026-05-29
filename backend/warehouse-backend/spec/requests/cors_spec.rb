require "rails_helper"

RSpec.describe "CORS preflight", type: :request do
  describe "OPTIONS /cats_warehouse/v1/gins/:id/confirm" do
    it "allows Idempotency-Key in preflight for cross-origin GIN confirm" do
      options "/cats_warehouse/v1/gins/1/confirm",
        headers: {
          "Origin" => "http://localhost:5173",
          "Access-Control-Request-Method" => "POST",
          "Access-Control-Request-Headers" => "idempotency-key,authorization,content-type"
        }

      expect(response).to have_http_status(:ok)
      expect(response.headers["Access-Control-Allow-Origin"]).to eq("http://localhost:5173")
      expect(response.headers["Access-Control-Allow-Methods"]).to include("POST")

      allowed_headers = response.headers["Access-Control-Allow-Headers"].to_s.downcase
      expect(allowed_headers).to include("idempotency-key")
      expect(allowed_headers).to include("authorization")
      expect(allowed_headers).to include("content-type")
    end
  end
end
