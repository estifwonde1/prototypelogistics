require "rails_helper"

RSpec.describe Cats::Warehouse::NotificationFanout do
  it "writes in-app notifications even when warehouse jobs are disabled" do
    prev_jobs = ENV["ENABLE_WAREHOUSE_JOBS"]
    prev_inapp = ENV["ENABLE_IN_APP_NOTIFICATIONS"]
    ENV["ENABLE_WAREHOUSE_JOBS"] = "false"
    ENV["ENABLE_IN_APP_NOTIFICATIONS"] = "true"

    assignee = create(:cats_core_user, role_name: "Hub Manager")
    hub = create(:cats_warehouse_hub)
    Cats::Warehouse::UserAssignment.create!(user: assignee, hub: hub, role_name: "Hub Manager")

    creator = create(:cats_core_user, role_name: "Officer")
    warehouse = create(:cats_warehouse_warehouse, hub: hub)
    order = Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      warehouse: warehouse,
      location: warehouse.location,
      created_by: creator,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-FAN-#{SecureRandom.hex(3)}"
    )

    described_class.deliver(
      "receipt_order.assigned",
      { receipt_order_id: order.id, assigned_to_ids: [ assignee.id ] }
    )

    expect(Cats::Warehouse::InAppNotification.where(recipient: assignee, type: "receipt_order.assigned").count).to eq(1)
  ensure
    ENV["ENABLE_WAREHOUSE_JOBS"] = prev_jobs
    ENV["ENABLE_IN_APP_NOTIFICATIONS"] = prev_inapp
  end
end
