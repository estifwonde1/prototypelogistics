require "rails_helper"

RSpec.describe "Cats::Warehouse GRNs", type: :request do
  let(:headers) { auth_headers(role: "Admin") }

  describe "GET /cats_warehouse/v1/grns" do
    it "returns 200 with no filter" do
      create(:cats_warehouse_grn)
      get "/cats_warehouse/v1/grns", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json_response["data"]).to be_an(Array)
    end

    it "filters by warehouse_id — returns only matching GRNs" do
      wh_a = create(:cats_warehouse_warehouse)
      wh_b = create(:cats_warehouse_warehouse)
      grn_a = create(:cats_warehouse_grn, warehouse: wh_a)
      _grn_b = create(:cats_warehouse_grn, warehouse: wh_b)

      get "/cats_warehouse/v1/grns", params: { warehouse_id: wh_a.id }, headers: headers

      expect(response).to have_http_status(:ok)
      ids = json_response["data"].map { |g| g["id"] }
      expect(ids).to include(grn_a.id)
      expect(ids).not_to include(_grn_b.id)
    end

    it "returns empty array when no GRNs match the warehouse_id" do
      wh = create(:cats_warehouse_warehouse)
      get "/cats_warehouse/v1/grns", params: { warehouse_id: wh.id }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response["data"]).to be_empty
    end
  end
end
