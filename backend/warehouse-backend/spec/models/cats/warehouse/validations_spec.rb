require "rails_helper"

RSpec.describe "Cats::Warehouse model validations", type: :model do
  it "validates hub name" do
    hub = build(:cats_warehouse_hub, name: nil)
    expect(hub).not_to be_valid
    expect(hub.errors[:name]).to be_present
  end

  it "validates warehouse name" do
    warehouse = build(:cats_warehouse_warehouse, name: nil)
    expect(warehouse).not_to be_valid
    expect(warehouse.errors[:name]).to be_present
  end

  it "validates store dimensions and space" do
    store = build(:cats_warehouse_store, length: nil, width: nil, height: nil, usable_space: nil, available_space: nil)
    expect(store).not_to be_valid
    expect(store.errors[:length]).to be_present
    expect(store.errors[:usable_space]).to be_present
  end

  it "validates stack dimensions" do
    stack = build(:cats_warehouse_stack, length: nil, width: nil, height: nil)
    expect(stack).not_to be_valid
    expect(stack.errors[:length]).to be_present
  end

  it "validates stock balance quantity" do
    balance = build(:cats_warehouse_stock_balance, quantity: nil)
    expect(balance).not_to be_valid
    expect(balance.errors[:quantity]).to be_present
  end

  it "validates GRN received_on" do
    grn = build(:cats_warehouse_grn, received_on: nil)
    expect(grn).not_to be_valid
    expect(grn.errors[:received_on]).to be_present
  end

  it "validates GIN issued_on" do
    gin = build(:cats_warehouse_gin, issued_on: nil)
    expect(gin).not_to be_valid
    expect(gin.errors[:issued_on]).to be_present
  end

  it "validates inspection inspected_on" do
    inspection = build(:cats_warehouse_inspection, inspected_on: nil)
    expect(inspection).not_to be_valid
    expect(inspection.errors[:inspected_on]).to be_present
  end

  it "validates waybill issued_on" do
    waybill = build(:cats_warehouse_waybill, issued_on: nil)
    expect(waybill).not_to be_valid
    expect(waybill.errors[:issued_on]).to be_present
  end
end
