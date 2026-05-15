require "rails_helper"

RSpec.describe "Cats::Warehouse GINs", type: :request do
  let(:headers) { auth_headers(role: "Admin") }

  describe "GET /cats_warehouse/v1/gins" do
    it "returns 200 with no filter" do
      create(:cats_warehouse_gin)
      get "/cats_warehouse/v1/gins", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json_response["data"]).to be_an(Array)
    end

    it "filters by warehouse_id — returns only matching GINs" do
      wh_a = create(:cats_warehouse_warehouse)
      wh_b = create(:cats_warehouse_warehouse)
      gin_a = create(:cats_warehouse_gin, warehouse: wh_a)
      gin_b = create(:cats_warehouse_gin, warehouse: wh_b)

      get "/cats_warehouse/v1/gins", params: { warehouse_id: wh_a.id }, headers: headers

      expect(response).to have_http_status(:ok)
      ids = json_response["data"].map { |g| g["id"] }
      expect(ids).to include(gin_a.id)
      expect(ids).not_to include(gin_b.id)
    end

    it "returns empty array when no GINs match the warehouse_id" do
      wh = create(:cats_warehouse_warehouse)
      get "/cats_warehouse/v1/gins", params: { warehouse_id: wh.id }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response["data"]).to be_empty
    end
  end
end
