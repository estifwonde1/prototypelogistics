FactoryBot.define do
  factory :cats_warehouse_geo, class: "Cats::Warehouse::Geo" do
    latitude { 9.03 }
    longitude { 38.74 }
    address { "Addis" }
  end

  factory :cats_warehouse_hub, class: "Cats::Warehouse::Hub" do
    location { association :cats_core_location }
    geo { association :cats_warehouse_geo }
    name { "Hub #{generate(:core_name)}" }
  end

  factory :cats_warehouse_warehouse, class: "Cats::Warehouse::Warehouse" do
    location { association :cats_core_location }
    hub { association :cats_warehouse_hub }
    geo { association :cats_warehouse_geo }
    name { "Warehouse #{generate(:core_name)}" }
  end

  factory :cats_warehouse_store, class: "Cats::Warehouse::Store" do
    warehouse { association :cats_warehouse_warehouse }
    name { "Store #{generate(:core_name)}" }
    length { 10 }
    width { 8 }
    height { 4 }
    usable_space { 320 }
    available_space { 320 }
    temporary { false }
    has_gangway { false }
  end

  factory :cats_warehouse_stack, class: "Cats::Warehouse::Stack" do
    store { association :cats_warehouse_store }
    commodity { association :cats_core_commodity }
    unit { association :cats_core_unit_of_measure }
    length { 2 }
    width { 2 }
    height { 2 }
    quantity { 10 }
  end

  factory :cats_warehouse_stock_balance, class: "Cats::Warehouse::StockBalance" do
    warehouse { association :cats_warehouse_warehouse }
    store { association :cats_warehouse_store }
    stack { association :cats_warehouse_stack }
    commodity { association :cats_core_commodity }
    unit { association :cats_core_unit_of_measure }
    quantity { 100 }
  end

  factory :cats_warehouse_grn, class: "Cats::Warehouse::Grn" do
    warehouse { association :cats_warehouse_warehouse }
    received_on { Date.today }
    received_by { association :cats_core_user, role_name: "Storekeeper" }
    status { "Draft" }
  end

  factory :cats_warehouse_grn_item, class: "Cats::Warehouse::GrnItem" do
    grn { association :cats_warehouse_grn }
    commodity { association :cats_core_commodity }
    unit { association :cats_core_unit_of_measure }
    quantity { 10 }
    store { association :cats_warehouse_store }
    stack { association :cats_warehouse_stack }
  end

  factory :cats_warehouse_gin, class: "Cats::Warehouse::Gin" do
    warehouse { association :cats_warehouse_warehouse }
    issued_on { Date.today }
    issued_by { association :cats_core_user, role_name: "Storekeeper" }
    status { "Draft" }
  end

  factory :cats_warehouse_gin_item, class: "Cats::Warehouse::GinItem" do
    gin { association :cats_warehouse_gin }
    commodity { association :cats_core_commodity }
    unit { association :cats_core_unit_of_measure }
    quantity { 10 }
    store { association :cats_warehouse_store }
    stack { association :cats_warehouse_stack }
  end

  factory :cats_warehouse_inspection, class: "Cats::Warehouse::Inspection" do
    warehouse { association :cats_warehouse_warehouse }
    inspected_on { Date.today }
    inspector { association :cats_core_user, role_name: "Inspector" }
    status { "Draft" }
  end

  factory :cats_warehouse_inspection_item, class: "Cats::Warehouse::InspectionItem" do
    inspection { association :cats_warehouse_inspection }
    commodity { association :cats_core_commodity }
    quantity_received { 10 }
    quantity_damaged { 0 }
  end

  factory :cats_warehouse_waybill, class: "Cats::Warehouse::Waybill" do
    issued_on { Date.today }
    source_location { association :cats_core_location }
    destination_location { association :cats_core_location }
    status { "Draft" }
  end

  factory :cats_warehouse_waybill_item, class: "Cats::Warehouse::WaybillItem" do
    waybill { association :cats_warehouse_waybill }
    commodity { association :cats_core_commodity }
    unit { association :cats_core_unit_of_measure }
    quantity { 5 }
  end
end
