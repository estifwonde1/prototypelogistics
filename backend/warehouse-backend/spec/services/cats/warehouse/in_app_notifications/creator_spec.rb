require "rails_helper"

RSpec.describe Cats::Warehouse::InAppNotifications::Creator, type: :model do
  it "creates rows for receipt_order.assigned assignees" do
    prev = ENV["ENABLE_IN_APP_NOTIFICATIONS"]
    ENV["ENABLE_IN_APP_NOTIFICATIONS"] = "true"

    creator = create(:cats_core_user, role_name: "Officer")
    assignee = create(:cats_core_user, role_name: "Warehouse Manager")
    warehouse = create(:cats_warehouse_warehouse)
    create(:cats_warehouse_user_assignment, user: assignee, warehouse: warehouse, role_name: "Warehouse Manager")

    order = Cats::Warehouse::ReceiptOrder.create!(
      hub: warehouse.hub,
      warehouse: warehouse,
      location: warehouse.location,
      created_by: creator,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-TEST-#{SecureRandom.hex(3)}"
    )

    described_class.call(
      "receipt_order.assigned",
      { receipt_order_id: order.id, assigned_to_ids: [ assignee.id ] }
    )

    rows = Cats::Warehouse::InAppNotification.where(recipient: assignee, type: "receipt_order.assigned")
    expect(rows.count).to eq(1)
    expect(rows.first.params["path"]).to eq("/receipt-orders/#{order.id}")
  ensure
    ENV["ENABLE_IN_APP_NOTIFICATIONS"] = prev
  end

  it "creates rows for receipt_authorization.plan_deviated by notify_user_ids" do
    prev = ENV["ENABLE_IN_APP_NOTIFICATIONS"]
    ENV["ENABLE_IN_APP_NOTIFICATIONS"] = "true"

    wm = create(:cats_core_user, role_name: "Warehouse Manager")
    wh = create(:cats_warehouse_warehouse)
    create(:cats_warehouse_user_assignment, user: wm, warehouse: wh, role_name: "Warehouse Manager")

    order = Cats::Warehouse::ReceiptOrder.create!(
      hub: wh.hub,
      warehouse: wh,
      location: wh.location,
      created_by: create(:cats_core_user, role_name: "Officer"),
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-PD-#{SecureRandom.hex(3)}",
      received_date: Date.current
    )

    described_class.call(
      "receipt_authorization.plan_deviated",
      {
        receipt_order_id: order.id,
        receipt_authorization_id: 999,
        notify_user_ids: [ wm.id ],
        advisory_only: true
      }
    )

    row = Cats::Warehouse::InAppNotification.find_by(recipient: wm, type: "receipt_authorization.plan_deviated")
    expect(row).to be_present
    expect(row.params["path"]).to eq("/receipt-orders/#{order.id}")
  ensure
    ENV["ENABLE_IN_APP_NOTIFICATIONS"] = prev
  end

  it "uses My Assignments deep link for storekeepers" do
    prev = ENV["ENABLE_IN_APP_NOTIFICATIONS"]
    ENV["ENABLE_IN_APP_NOTIFICATIONS"] = "true"

    creator = create(:cats_core_user, role_name: "Officer")
    store = create(:cats_warehouse_store)
    assignee = create(:cats_core_user, role_name: "Storekeeper")
    Cats::Warehouse::UserAssignment.create!(user: assignee, store: store, role_name: "Storekeeper")

    order = Cats::Warehouse::ReceiptOrder.create!(
      hub: store.warehouse.hub,
      warehouse: store.warehouse,
      location: store.warehouse.location,
      created_by: creator,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-SK-#{SecureRandom.hex(3)}"
    )

    described_class.call(
      "receipt_order.assigned",
      { receipt_order_id: order.id, assigned_to_ids: [ assignee.id ] }
    )

    row = Cats::Warehouse::InAppNotification.find_by(recipient: assignee, type: "receipt_order.assigned")
    expect(row.params["path"]).to eq("/storekeeper/assignments?receipt_order_id=#{order.id}")
  ensure
    ENV["ENABLE_IN_APP_NOTIFICATIONS"] = prev
  end
end
