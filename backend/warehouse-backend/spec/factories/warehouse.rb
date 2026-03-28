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

  factory :cats_warehouse_user_assignment, class: "Cats::Warehouse::UserAssignment" do
    user { association :cats_core_user, role_name: "Warehouse Manager" }
    warehouse { association :cats_warehouse_warehouse }
    role_name { "Warehouse Manager" }
  end
end
