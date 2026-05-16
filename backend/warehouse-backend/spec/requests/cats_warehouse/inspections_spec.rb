require "rails_helper"

RSpec.describe "Cats::Warehouse Inspections", type: :request do
  let(:headers) { auth_headers(role: "Admin") }

  describe "GET /cats_warehouse/v1/inspections" do
    it "returns 200 with no filter" do
      create(:cats_warehouse_inspection)
      get "/cats_warehouse/v1/inspections", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json_response["data"]).to be_an(Array)
    end

    it "filters by warehouse_id — returns only matching inspections" do
      wh_a = create(:cats_warehouse_warehouse)
      wh_b = create(:cats_warehouse_warehouse)
      insp_a = create(:cats_warehouse_inspection, warehouse: wh_a)
      insp_b = create(:cats_warehouse_inspection, warehouse: wh_b)

      get "/cats_warehouse/v1/inspections", params: { warehouse_id: wh_a.id }, headers: headers

      expect(response).to have_http_status(:ok)
      ids = json_response["data"].map { |i| i["id"] }
      expect(ids).to include(insp_a.id)
      expect(ids).not_to include(insp_b.id)
    end

    it "returns empty array when no inspections match the warehouse_id" do
      wh = create(:cats_warehouse_warehouse)
      get "/cats_warehouse/v1/inspections", params: { warehouse_id: wh.id }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response["data"]).to be_empty
    end
  end
end
