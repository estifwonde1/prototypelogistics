# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::DocumentScopeQuery, type: :query do
  let(:hub) { create(:cats_warehouse_hub) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:actor) { create(:cats_core_user, role_name: "Federal Officer") }

  def scoped_ids(user, base_scope = Cats::Warehouse::ReceiptOrder.all)
    described_class.new(user: user, scope: base_scope).call.pluck(:id)
  end

  def create_ro(**attrs)
    order = Cats::Warehouse::ReceiptOrder.new(
      {
        created_by: actor,
        reference_no: "RO-SCOPE-#{SecureRandom.hex(4)}",
        received_date: Date.current
      }.merge(attrs)
    )
    order.save!(validate: false)
    order
  end

  describe "receipt orders for warehouse manager" do
    let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }

    before do
      Cats::Warehouse::UserAssignment.create!(
        user: wm,
        warehouse: warehouse,
        role_name: "Warehouse Manager"
      )
    end

    it "excludes draft receipt orders tied to the warehouse" do
      draft_ro = create_ro(
        warehouse: warehouse,
        status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:draft]
      )

      expect(scoped_ids(wm)).not_to include(draft_ro.id)
    end

    it "includes confirmed receipt orders tied to the warehouse" do
      confirmed_ro = create_ro(
        warehouse: warehouse,
        status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed]
      )

      expect(scoped_ids(wm)).to include(confirmed_ro.id)
    end
  end

  describe "receipt orders for hub manager" do
    let(:hm) { create(:cats_core_user, role_name: "Hub Manager") }

    before do
      Cats::Warehouse::UserAssignment.create!(user: hm, hub: hub, role_name: "Hub Manager")
    end

    it "excludes draft receipt orders destined to the hub" do
      draft_ro = create_ro(
        hub: hub,
        status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:draft]
      )

      expect(scoped_ids(hm)).not_to include(draft_ro.id)
    end
  end
end

RSpec.describe Cats::Warehouse::WarehouseReceiptOrderScope, type: :service do
  let(:warehouse) { create(:cats_warehouse_warehouse) }
  let(:actor) { create(:cats_core_user, role_name: "Federal Officer") }

  it "excludes draft orders for warehouse_id filter path" do
    draft_ro = Cats::Warehouse::ReceiptOrder.create!(
      warehouse: warehouse,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:draft],
      reference_no: "RO-WH-SCOPE-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )

    ids = described_class.relation_for_warehouse(warehouse_id: warehouse.id).pluck(:id)
    expect(ids).not_to include(draft_ro.id)
  end

  it "includes confirmed orders for warehouse_id filter path" do
    confirmed_ro = Cats::Warehouse::ReceiptOrder.create!(
      warehouse: warehouse,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-WH-SCOPE-C-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )

    ids = described_class.relation_for_warehouse(warehouse_id: warehouse.id).pluck(:id)
    expect(ids).to include(confirmed_ro.id)
  end
end
