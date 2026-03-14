require "rails_helper"

RSpec.describe "Cats Warehouse Stores", type: :request do
  it "supports CRUD" do
    warehouse = create(:cats_warehouse_warehouse)

    post "/cats_warehouse/v1/stores",
         params: {
           payload: {
             warehouse_id: warehouse.id,
             name: "Store A",
             length: 10,
             width: 8,
             height: 4,
             usable_space: 320,
             available_space: 320,
             temporary: false,
             has_gangway: false
           }
         },
         as: :json
    expect(response).to have_http_status(:created)
    store_id = json_response.dig("data", "id")

    get "/cats_warehouse/v1/stores/#{store_id}"
    expect(response).to have_http_status(:ok)
    expect(json_response.dig("data", "store", "id")).to eq(store_id)

    patch "/cats_warehouse/v1/stores/#{store_id}",
          params: { payload: { available_space: 300 } },
          as: :json
    expect(response).to have_http_status(:ok)

    delete "/cats_warehouse/v1/stores/#{store_id}"
    expect(response).to have_http_status(:ok)
  end
end
