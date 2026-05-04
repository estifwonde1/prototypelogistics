require "rails_helper"

RSpec.describe Cats::Warehouse::ReceiptOrderAssignmentService, "notification recipients" do
  describe "#notification_recipient_user_ids (private)" do
    let(:warehouse) { create(:cats_warehouse_warehouse) }
    let(:store) { create(:cats_warehouse_store, warehouse: warehouse) }
    let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
    let(:sk) { create(:cats_core_user, role_name: "Storekeeper") }

    before do
      Cats::Warehouse::UserAssignment.create!(user: wm, warehouse: warehouse, role_name: "Warehouse Manager")
      Cats::Warehouse::UserAssignment.create!(user: sk, store: store, role_name: "Storekeeper")
    end

    it "includes all storekeepers for the store even when assigned_to is the warehouse manager" do
      assignment = instance_double(
        Cats::Warehouse::ReceiptOrderAssignment,
        assigned_to_id: wm.id,
        store_id: store.id
      )

      service = described_class.new(order: instance_double(Cats::Warehouse::ReceiptOrder), actor: wm, assignments: [])
      ids = service.send(:notification_recipient_user_ids, [ assignment ])

      expect(ids).to include(wm.id, sk.id)
      expect(ids.uniq.size).to eq(2)
    end

    it "includes storekeepers when assigned_to_id is blank but store_id is set" do
      assignment = instance_double(
        Cats::Warehouse::ReceiptOrderAssignment,
        assigned_to_id: nil,
        store_id: store.id
      )

      service = described_class.new(order: instance_double(Cats::Warehouse::ReceiptOrder), actor: wm, assignments: [])
      ids = service.send(:notification_recipient_user_ids, [ assignment ])

      expect(ids).to eq([ sk.id ])
    end
  end
end
