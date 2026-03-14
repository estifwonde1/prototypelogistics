require "rails_helper"

RSpec.describe "Cats Warehouse Stacks", type: :request do
  it "supports CRUD" do
    store = create(:cats_warehouse_store)
    commodity = create(:cats_core_commodity)
    unit = create(:cats_core_unit_of_measure)

    post "/cats_warehouse/v1/stacks",
         params: {
           payload: {
             store_id: store.id,
             commodity_id: commodity.id,
             unit_id: unit.id,
             length: 2,
             width: 2,
             height: 2,
             quantity: 10
           }
         },
         as: :json
    expect(response).to have_http_status(:created)
    stack_id = json_response.dig("data", "id")

    get "/cats_warehouse/v1/stacks/#{stack_id}"
    expect(response).to have_http_status(:ok)
    expect(json_response.dig("data", "stack", "id")).to eq(stack_id)

    patch "/cats_warehouse/v1/stacks/#{stack_id}",
          params: { payload: { stack_status: "In Use" } },
          as: :json
    expect(response).to have_http_status(:ok)

    delete "/cats_warehouse/v1/stacks/#{stack_id}"
    expect(response).to have_http_status(:ok)
  end
end
