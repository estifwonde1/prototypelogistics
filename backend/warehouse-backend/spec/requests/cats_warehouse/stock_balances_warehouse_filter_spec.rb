require "rails_helper"

RSpec.describe "Cats::Warehouse StockBalances warehouse filter", type: :request do
  let(:headers) { auth_headers(role: "Admin") }

  it "filters stock balances by warehouse_id" do
    wh_a = create(:cats_warehouse_warehouse)
    wh_b = create(:cats_warehouse_warehouse)
    store_a = create(:cats_warehouse_store, warehouse: wh_a)
    store_b = create(:cats_warehouse_store, warehouse: wh_b)
    bal_a = create(:cats_warehouse_stock_balance, warehouse: wh_a, store: store_a,
                   stack: create(:cats_warehouse_stack, store: store_a))
    bal_b = create(:cats_warehouse_stock_balance, warehouse: wh_b, store: store_b,
                   stack: create(:cats_warehouse_stack, store: store_b))

    get "/cats_warehouse/v1/stock_balances",
        params: { warehouse_id: wh_a.id },
        headers: headers

    expect(response).to have_http_status(:ok)
    ids = json_response["data"].map { |b| b["id"] }
    expect(ids).to include(bal_a.id)
    expect(ids).not_to include(bal_b.id)
  end
end
