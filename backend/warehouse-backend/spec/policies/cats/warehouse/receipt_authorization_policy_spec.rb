# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::ReceiptAuthorizationPolicy::Scope, type: :policy do
  subject(:resolved) { described_class.new(wm, Cats::Warehouse::ReceiptAuthorization.all).resolve }

  let(:hub) { create(:cats_warehouse_hub) }
  let(:wh_a) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:wh_b) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:actor) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { commodity.unit_of_measure }
  let(:transporter) { create(:cats_core_transporter) }

  let(:receipt_order) do
    Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:assigned],
      reference_no: "RO-POLICY-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let(:receipt_line) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: receipt_order,
      commodity: commodity,
      unit: unit,
      quantity: 100,
      line_reference_no: "RL-POLICY-#{SecureRandom.hex(4)}"
    )
  end

  def build_ra(warehouse:)
    Cats::Warehouse::ReceiptAuthorization.create!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      warehouse: warehouse,
      transporter: transporter,
      authorized_quantity: 10,
      driver_name: "Driver",
      driver_id_number: "ID-1",
      truck_plate_number: "AA-1",
      waybill_number: "WB-POL-#{SecureRandom.hex(4)}",
      status: Cats::Warehouse::ReceiptAuthorization::PENDING,
      reference_no: "RA-POL-#{SecureRandom.hex(4)}",
      created_by: actor
    )
  end

  before { receipt_line }

  it "includes RAs for assignee warehouses even without a UserAssignment on that warehouse" do
    Cats::Warehouse::UserAssignment.create!(user: wm, warehouse: wh_a, role_name: "Warehouse Manager")
    Cats::Warehouse::ReceiptOrderAssignment.create!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      hub_id: hub.id,
      warehouse_id: wh_b.id,
      assigned_by: actor,
      assigned_to_id: wm.id,
      quantity: 10,
      status: "assigned"
    )
    ra_b = build_ra(warehouse: wh_b)

    expect(resolved.where(id: ra_b.id)).to exist
  end

  it "excludes warehouses only linked via rejected assignments" do
    Cats::Warehouse::UserAssignment.create!(user: wm, warehouse: wh_a, role_name: "Warehouse Manager")
    ra_b = build_ra(warehouse: wh_b)
    Cats::Warehouse::ReceiptOrderAssignment.create!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      hub_id: hub.id,
      warehouse_id: wh_b.id,
      assigned_by: actor,
      assigned_to_id: wm.id,
      quantity: 10,
      status: "rejected"
    )

    expect(resolved.where(id: ra_b.id)).not_to exist
  end
end

RSpec.describe Cats::Warehouse::ReceiptAuthorizationPolicy, type: :policy do
  let(:hub) { create(:cats_warehouse_hub) }
  let(:hub_warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:standalone_warehouse) { create(:cats_warehouse_warehouse, hub: nil) }
  let(:hm) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }

  before do
    Cats::Warehouse::UserAssignment.create!(user: hm, hub: hub, role_name: "Hub Manager")
    Cats::Warehouse::UserAssignment.create!(
      user: wm,
      warehouse: standalone_warehouse,
      role_name: "Warehouse Manager"
    )
    Cats::Warehouse::UserAssignment.create!(
      user: wm,
      warehouse: hub_warehouse,
      role_name: "Warehouse Manager"
    )
  end

  describe "#create_for_warehouse?" do
    it "allows Hub Manager for warehouses under their hub" do
      policy = described_class.new(hm, nil)
      expect(policy.create_for_warehouse?(hub_warehouse.id)).to be(true)
    end

    it "allows Warehouse Manager only for standalone assigned warehouses" do
      policy = described_class.new(wm, nil)
      expect(policy.create_for_warehouse?(standalone_warehouse.id)).to be(true)
      expect(policy.create_for_warehouse?(hub_warehouse.id)).to be(false)
    end
  end
end
