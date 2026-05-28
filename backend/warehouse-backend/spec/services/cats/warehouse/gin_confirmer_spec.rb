# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::GinConfirmer, type: :service do
  it "confirms GIN and reduces stock/stack" do
    warehouse = create(:cats_warehouse_warehouse)
    store = create(:cats_warehouse_store, warehouse: warehouse)
    stack = create(:cats_warehouse_stack, store: store, quantity: 10)
    user = create(:cats_core_user, role_name: "Storekeeper")

    gin = create(:cats_warehouse_gin, warehouse: warehouse, issued_by: user, status: "draft")
    create(
      :cats_warehouse_gin_item,
      gin: gin,
      commodity: stack.commodity,
      unit: stack.unit,
      quantity: 3,
      store: store,
      stack: stack
    )

    create(
      :cats_warehouse_stock_balance,
      warehouse: warehouse,
      store: store,
      stack: stack,
      commodity: stack.commodity,
      unit: stack.unit,
      quantity: 10
    )

    described_class.new(gin: gin).call

    expect(gin.reload.status).to eq("confirmed")
    expect(stack.reload.quantity).to eq(7)

    balance = Cats::Warehouse::StockBalance.find_by(stack_id: stack.id)
    expect(balance.quantity).to eq(7)

    expect(Cats::Warehouse::StackTransaction.count).to eq(1)
  end

  it "deducts inventory from multiple stack allocations on confirm" do
    warehouse = create(:cats_warehouse_warehouse)
    store = create(:cats_warehouse_store, warehouse: warehouse)
    commodity = create(:cats_core_commodity)
    unit = commodity.unit_of_measure
    stack_a = create(:cats_warehouse_stack, store: store, commodity: commodity, unit: unit, quantity: 5)
    stack_b = create(:cats_warehouse_stack, store: store, commodity: commodity, unit: unit, quantity: 5)
    user = create(:cats_core_user, role_name: "Storekeeper")
    transporter = create(:cats_core_transporter)

    order = Cats::Warehouse::DispatchOrder.create!(
      reference_no: "DO-MULTI-#{SecureRandom.hex(3).upcase}",
      dispatch_reference: "DO-MULTI-#{SecureRandom.hex(3).upcase}",
      created_by: user,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed]
    )

    auth = Cats::Warehouse::DispatchOrderAuthorization.create!(
      dispatch_order: order,
      warehouse: warehouse,
      reference_no: "DOA-#{SecureRandom.hex(4).upcase}",
      status: Cats::Warehouse::DispatchOrderAuthorization::IN_PROGRESS,
      authorized_quantity: 2,
      authorized_base_quantity: 2,
      authorized_quantity_input_unit_id: unit.id,
      remaining_quantity: 0,
      transporter: transporter,
      transporter_name: transporter.name,
      driver_name: "Driver",
      driver_id_number: "LIC",
      truck_plate_number: "PLATE",
      driver_phone: "0911000000",
      created_by: user
    )

    auth_store = Cats::Warehouse::DispatchOrderAuthorizationStore.create!(
      dispatch_order_authorization: auth,
      store: store,
      commodity: commodity,
      authorized_quantity: 2,
      base_quantity: 2,
      remaining_quantity: 0,
      dispatched_quantity: 2
    )

    execution = Cats::Warehouse::DispatchOrderAuthorizationExecution.create!(
      dispatch_order_authorization: auth,
      dispatch_order_authorization_store: auth_store,
      storekeeper: user,
      commodity: commodity,
      quantity: 2,
      base_quantity: 2,
      authorized_quantity: 2,
      status: Cats::Warehouse::DispatchOrderAuthorizationExecution::DRAFT
    )

    gin = create(:cats_warehouse_gin, warehouse: warehouse, issued_by: user, status: "draft",
                                      dispatch_order: order, dispatch_order_authorization: auth)
    create(
      :cats_warehouse_gin_item,
      gin: gin,
      commodity: commodity,
      unit: unit,
      quantity: 2,
      store: store
    )

    [stack_a, stack_b].each do |stack|
      create(
        :cats_warehouse_stock_balance,
        warehouse: warehouse,
        store: store,
        stack: stack,
        commodity: commodity,
        unit: unit,
        quantity: 5,
        available_quantity: 5
      )
    end

    Cats::Warehouse::DispatchStackAllocation.create!(
      gin: gin,
      dispatch_order_authorization_execution: execution,
      stack: stack_a,
      quantity: 1,
      base_quantity: 1,
      commodity_grade: "Grade A"
    )
    Cats::Warehouse::DispatchStackAllocation.create!(
      gin: gin,
      dispatch_order_authorization_execution: execution,
      stack: stack_b,
      quantity: 1,
      base_quantity: 1,
      commodity_grade: "Grade A"
    )

    described_class.new(gin: gin).call

    expect(gin.reload.status).to eq("confirmed")
    expect(stack_a.reload.quantity).to eq(4)
    expect(stack_b.reload.quantity).to eq(4)
    expect(Cats::Warehouse::StackTransaction.count).to eq(2)
  end

  it "requires stack allocations for dispatch authorization GINs" do
    warehouse = create(:cats_warehouse_warehouse)
    user = create(:cats_core_user, role_name: "Storekeeper")
    transporter = create(:cats_core_transporter)

    auth = Cats::Warehouse::DispatchOrderAuthorization.create!(
      dispatch_order: Cats::Warehouse::DispatchOrder.create!(
        reference_no: "DO-REQ-#{SecureRandom.hex(3).upcase}",
        dispatch_reference: "DO-REQ-#{SecureRandom.hex(3).upcase}",
        created_by: user,
        status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed]
      ),
      warehouse: warehouse,
      reference_no: "DOA-#{SecureRandom.hex(4).upcase}",
      status: Cats::Warehouse::DispatchOrderAuthorization::IN_PROGRESS,
      authorized_quantity: 2,
      authorized_base_quantity: 2,
      authorized_quantity_input_unit_id: create(:cats_core_commodity).unit_of_measure_id,
      remaining_quantity: 0,
      transporter: transporter,
      transporter_name: transporter.name,
      driver_name: "Driver",
      driver_id_number: "LIC",
      truck_plate_number: "PLATE",
      driver_phone: "0911000000",
      created_by: user
    )

    gin = create(:cats_warehouse_gin, warehouse: warehouse, issued_by: user, status: "draft",
                                      dispatch_order_authorization: auth)

    expect do
      described_class.new(gin: gin).call
    end.to raise_error(ArgumentError, /Stack allocations are required/)
  end
end
