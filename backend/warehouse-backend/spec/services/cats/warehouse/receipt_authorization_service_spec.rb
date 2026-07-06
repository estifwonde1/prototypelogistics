# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::ReceiptAuthorizationService, type: :model do
  let(:location) { create(:cats_core_location) }
  let(:hub) { create(:cats_warehouse_hub, location: location) }
  let(:warehouse_a) { create(:cats_warehouse_warehouse, hub: hub, location: location) }
  let(:warehouse_b) { create(:cats_warehouse_warehouse, hub: hub, location: location) }
  let(:other_hub) { create(:cats_warehouse_hub, location: create(:cats_core_location, code: "LOC-B", name: "B")) }
  let(:warehouse_other) { create(:cats_warehouse_warehouse, hub: other_hub, location: other_hub.location) }

  let(:actor) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { commodity.unit_of_measure }
  let(:transporter) { create(:cats_core_transporter) }

  let(:receipt_order) do
    Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:confirmed],
      reference_no: "RO-RA-SVC-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  let(:receipt_line) do
    Cats::Warehouse::ReceiptOrderLine.create!(
      receipt_order: receipt_order,
      commodity: commodity,
      unit: unit,
      quantity: 1_000,
      line_reference_no: "RL-#{SecureRandom.hex(5)}"
    )
  end

  let(:assignment) do
    Cats::Warehouse::ReceiptOrderAssignment.create!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      hub_id: hub.id,
      warehouse_id: warehouse_a.id,
      assigned_by: actor,
      quantity: 500,
      status: "assigned"
    )
  end

  before do
    receipt_line
    allow(Cats::Warehouse::NotificationFanout).to receive(:deliver)
  end

  def build_service(**opts)
    described_class.new(
      receipt_order: receipt_order,
      actor: actor,
      store: nil,
      authorized_quantity: opts.fetch(:authorized_quantity, 100),
      driver_name: "Driver",
      driver_id_number: "ID-1",
      truck_plate_number: "AA-11111",
      transporter: transporter,
      waybill_number: nil,
      receipt_order_assignment: opts[:receipt_order_assignment],
      explicit_warehouse: opts[:explicit_warehouse],
      receipt_order_line: opts[:receipt_order_line],
      force_plan_change_notification: opts.fetch(:force_plan_change_notification, false)
    )
  end

  it "creates RA following a warehouse assignment" do
    assignment
    ra = build_service(receipt_order_assignment: assignment).call
    expect(ra).to be_persisted
    expect(ra.warehouse_id).to eq(warehouse_a.id)
    expect(ra.receipt_order_assignment_id).to eq(assignment.id)
    expect(ra.receipt_order_line_id).to eq(receipt_line.id)
  end

  it "copies assignee from superseded planned row when target warehouse has no WM user assignment" do
    wm = create(:cats_core_user, role_name: "Warehouse Manager")
    Cats::Warehouse::UserAssignment.create!(user: wm, warehouse: warehouse_a, role_name: "Warehouse Manager")
    assignment.update!(assigned_to_id: wm.id)

    ra = build_service(
      explicit_warehouse: warehouse_b,
      receipt_order_line: receipt_line,
      authorized_quantity: 40
    ).call
    override = Cats::Warehouse::ReceiptOrderAssignment.find_by!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      warehouse_id: warehouse_b.id
    )
    expect(override.assigned_to_id).to eq(wm.id)
    expect(ra.receipt_order_assignment_id).to eq(override.id)
  end

  it "creates RA with hub direct routing to another in-hub warehouse" do
    assignment
    wm_bole = create(:cats_core_user, role_name: "Warehouse Manager")
    Cats::Warehouse::UserAssignment.create!(user: wm_bole, warehouse: warehouse_b, role_name: "Warehouse Manager")

    ra = build_service(
      explicit_warehouse: warehouse_b,
      receipt_order_line: receipt_line,
      authorized_quantity: 50
    ).call
    expect(ra.warehouse_id).to eq(warehouse_b.id)
    expect(ra.receipt_order_assignment_id).to be_present
    override_assignment = Cats::Warehouse::ReceiptOrderAssignment.find_by(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      warehouse_id: warehouse_b.id
    )
    expect(override_assignment).to be_present
    expect(override_assignment.quantity.to_f).to eq(50)
    expect(override_assignment.assigned_to_id).to eq(wm_bole.id)
    expect(ra.receipt_order_assignment_id).to eq(override_assignment.id)
    assignment.reload
    expect(assignment.status.to_s.downcase).to eq("rejected")

    expect(Cats::Warehouse::NotificationFanout).to have_received(:deliver).with(
      "receipt_order.assigned",
      hash_including(receipt_order_id: receipt_order.id, assigned_to_ids: [ wm_bole.id ])
    ).at_least(:once)
  end

  it "rejects when assignment and explicit warehouse are both set" do
    assignment
    expect do
      build_service(
        receipt_order_assignment: assignment,
        explicit_warehouse: warehouse_b,
        receipt_order_line: receipt_line
      ).call
    end.to raise_error(ArgumentError, /not both/)
  end

  it "rejects override when quantity exceeds receipt line total" do
    expect do
      build_service(
        explicit_warehouse: warehouse_b,
        receipt_order_line: receipt_line,
        authorized_quantity: 2_000
      ).call
    end.to raise_error(ArgumentError, /exceeds/)
  end

  it "rejects override warehouse outside receipt order hub" do
    expect do
      build_service(
        explicit_warehouse: warehouse_other,
        receipt_order_line: receipt_line,
        authorized_quantity: 10
      ).call
    end.to raise_error(ArgumentError, /hub/)
  end

  it "allows explicit routing to a standalone warehouse planned on a hub receipt order" do
    standalone = create(
      :cats_warehouse_warehouse,
      hub: nil,
      location: create(:cats_core_location, code: "LOC-STAND", name: "Standalone")
    )
    receipt_line.update!(destination_warehouse_id: standalone.id)

    ra = build_service(
      explicit_warehouse: standalone,
      receipt_order_line: receipt_line,
      authorized_quantity: 25
    ).call

    expect(ra.warehouse_id).to eq(standalone.id)
    expect(ra.store_id).to be_nil
  end

  it "allows explicit routing to a standalone warehouse with a warehouse-level assignment only" do
    standalone = create(
      :cats_warehouse_warehouse,
      hub: nil,
      location: create(:cats_core_location, code: "LOC-STAND2", name: "Standalone 2")
    )
    Cats::Warehouse::ReceiptOrderAssignment.create!(
      receipt_order: receipt_order,
      receipt_order_line: receipt_line,
      warehouse_id: standalone.id,
      assigned_by: actor,
      quantity: 400,
      status: "assigned"
    )

    ra = build_service(
      explicit_warehouse: standalone,
      receipt_order_line: receipt_line,
      authorized_quantity: 25
    ).call

    expect(ra.warehouse_id).to eq(standalone.id)
    expect(ra.store_id).to be_nil
  end
end
