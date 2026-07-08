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
  let(:hm) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
  let(:standalone_warehouse) do
    create(:cats_warehouse_warehouse, hub: nil, location: create(:cats_core_location), managed_under: "federal")
  end

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

  describe "storekeeper scope" do
    let(:hub) { create(:cats_warehouse_hub) }
    let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
    let(:store) { create(:cats_warehouse_store, warehouse: warehouse) }
    let(:sk_a) { create(:cats_core_user, role_name: "Storekeeper") }
    let(:sk_b) { create(:cats_core_user, role_name: "Storekeeper") }
    let(:hm) { create(:cats_core_user, role_name: "Hub Manager") }
    let(:commodity) { create(:cats_core_commodity) }
    let(:unit) { commodity.unit_of_measure }
    let(:transporter) { create(:cats_core_transporter) }

    let(:receipt_order) do
      Cats::Warehouse::ReceiptOrder.create!(
        hub: hub,
        created_by: hm,
        status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:assigned],
        reference_no: "RO-SK-#{SecureRandom.hex(4)}",
        received_date: Date.current
      )
    end

    let(:receipt_line) do
      Cats::Warehouse::ReceiptOrderLine.create!(
        receipt_order: receipt_order,
        commodity: commodity,
        unit: unit,
        quantity: 100,
        line_reference_no: "RL-SK-#{SecureRandom.hex(4)}"
      )
    end

    let!(:ra) do
      Cats::Warehouse::ReceiptAuthorization.create!(
        receipt_order: receipt_order,
        receipt_order_line: receipt_line,
        warehouse: warehouse,
        transporter: transporter,
        authorized_quantity: 10,
        driver_name: "Driver",
        driver_id_number: "ID-1",
        truck_plate_number: "AA-1",
        waybill_number: "WB-SK-#{SecureRandom.hex(4)}",
        status: Cats::Warehouse::ReceiptAuthorization::PENDING,
        reference_no: "RA-SK-#{SecureRandom.hex(4)}",
        created_by: hm,
        assigned_storekeeper_id: sk_a.id
      )
    end

    before do
      receipt_line
      Cats::Warehouse::UserAssignment.create!(user: sk_a, warehouse: warehouse, role_name: "Storekeeper")
      Cats::Warehouse::UserAssignment.create!(user: sk_b, warehouse: warehouse, role_name: "Storekeeper")
    end

    it "returns only RAs assigned to the storekeeper" do
      scope_a = described_class::Scope.new(sk_a, Cats::Warehouse::ReceiptAuthorization.all).resolve
      scope_b = described_class::Scope.new(sk_b, Cats::Warehouse::ReceiptAuthorization.all).resolve

      expect(scope_a.where(id: ra.id)).to exist
      expect(scope_b.where(id: ra.id)).not_to exist
    end

    context "when storekeepers are assigned to specific stores" do
      let(:store_b) { create(:cats_warehouse_store, warehouse: warehouse) }
      let!(:ra_store_b) do
        Cats::Warehouse::ReceiptAuthorization.create!(
          receipt_order: receipt_order,
          receipt_order_line: receipt_line,
          warehouse: warehouse,
          store: store_b,
          transporter: transporter,
          authorized_quantity: 10,
          driver_name: "Driver",
          driver_id_number: "ID-1",
          truck_plate_number: "AA-1",
          waybill_number: "WB-SK-B-#{SecureRandom.hex(4)}",
          status: Cats::Warehouse::ReceiptAuthorization::PENDING,
          reference_no: "RA-SK-B-#{SecureRandom.hex(4)}",
          created_by: hm,
          assigned_storekeeper_id: sk_b.id
        )
      end

      before do
        Cats::Warehouse::UserAssignment.where(user: sk_a, role_name: "Storekeeper").delete_all
        Cats::Warehouse::UserAssignment.where(user: sk_b, role_name: "Storekeeper").delete_all
        Cats::Warehouse::UserAssignment.create!(user: sk_a, store: store, role_name: "Storekeeper")
        Cats::Warehouse::UserAssignment.create!(user: sk_b, store: store_b, role_name: "Storekeeper")
      end

      it "limits assigned RAs to the assigned storekeeper (not by store on the RA row)" do
        scope_a = described_class::Scope.new(sk_a, Cats::Warehouse::ReceiptAuthorization.all).resolve
        scope_b = described_class::Scope.new(sk_b, Cats::Warehouse::ReceiptAuthorization.all).resolve

        expect(scope_a.where(id: ra.id)).to exist
        expect(scope_a.where(id: ra_store_b.id)).not_to exist
        expect(scope_b.where(id: ra_store_b.id)).to exist
        expect(scope_b.where(id: ra.id)).not_to exist
      end
    end

    context "when warehouse has multiple stores and RA is unassigned" do
      let!(:store_a) { create(:cats_warehouse_store, warehouse: warehouse) }
      let!(:store_b) { create(:cats_warehouse_store, warehouse: warehouse) }
      let!(:open_ra) do
        Cats::Warehouse::ReceiptAuthorization.create!(
          receipt_order: receipt_order,
          receipt_order_line: receipt_line,
          warehouse: warehouse,
          store: store_a,
          transporter: transporter,
          authorized_quantity: 10,
          driver_name: "Driver",
          driver_id_number: "ID-1",
          truck_plate_number: "AA-1",
          waybill_number: "WB-MULTI-#{SecureRandom.hex(4)}",
          status: Cats::Warehouse::ReceiptAuthorization::PENDING,
          reference_no: "RA-MULTI-#{SecureRandom.hex(4)}",
          created_by: hm
        )
      end

      before do
        Cats::Warehouse::UserAssignment.where(user: sk_a, role_name: "Storekeeper").delete_all
        Cats::Warehouse::UserAssignment.create!(user: sk_a, store: store_a, role_name: "Storekeeper")
      end

      it "shows unassigned RAs for the storekeeper's store at multi-store warehouses" do
        scope_a = described_class::Scope.new(sk_a, Cats::Warehouse::ReceiptAuthorization.all).resolve
        expect(scope_a.where(id: open_ra.id)).to exist
      end
    end

    context "when user is both warehouse manager and storekeeper at a standalone warehouse" do
      let(:standalone_wh) do
        create(:cats_warehouse_warehouse, hub: nil, location: create(:cats_core_location), managed_under: "federal")
      end
      let!(:sole_store) { create(:cats_warehouse_store, warehouse: standalone_wh) }
      let(:wm_sk) { create(:cats_core_user, role_name: "Warehouse Manager") }
      let!(:standalone_open_ra) do
        Cats::Warehouse::ReceiptAuthorization.create!(
          receipt_order: receipt_order,
          receipt_order_line: receipt_line,
          warehouse: standalone_wh,
          store: sole_store,
          transporter: transporter,
          authorized_quantity: 10,
          driver_name: "Driver",
          driver_id_number: "ID-1",
          truck_plate_number: "AA-1",
          waybill_number: "WB-STANDALONE-#{SecureRandom.hex(4)}",
          status: Cats::Warehouse::ReceiptAuthorization::PENDING,
          reference_no: "RA-STANDALONE-#{SecureRandom.hex(4)}",
          created_by: hm
        )
      end

      before do
        Cats::Warehouse::UserAssignment.create!(user: wm_sk, warehouse: standalone_wh, role_name: "Warehouse Manager")
        Cats::Warehouse::UserAssignment.create!(user: wm_sk, warehouse: standalone_wh, role_name: "Storekeeper")
      end

      it "includes unassigned RAs via the storekeeper branch of the union scope" do
        resolved = described_class::Scope.new(wm_sk, Cats::Warehouse::ReceiptAuthorization.all).resolve
        expect(resolved.where(id: standalone_open_ra.id)).to exist
      end
    end

    context "when warehouse has a single store" do
      let!(:sole_store) { create(:cats_warehouse_store, warehouse: warehouse) }
      let!(:open_ra) do
        Cats::Warehouse::ReceiptAuthorization.create!(
          receipt_order: receipt_order,
          receipt_order_line: receipt_line,
          warehouse: warehouse,
          store: sole_store,
          transporter: transporter,
          authorized_quantity: 10,
          driver_name: "Driver",
          driver_id_number: "ID-1",
          truck_plate_number: "AA-1",
          waybill_number: "WB-OPEN-#{SecureRandom.hex(4)}",
          status: Cats::Warehouse::ReceiptAuthorization::PENDING,
          reference_no: "RA-OPEN-#{SecureRandom.hex(4)}",
          created_by: hm
        )
      end

      it "includes unassigned RAs for all eligible storekeepers" do
        scope_a = described_class::Scope.new(sk_a, Cats::Warehouse::ReceiptAuthorization.all).resolve
        scope_b = described_class::Scope.new(sk_b, Cats::Warehouse::ReceiptAuthorization.all).resolve

        expect(scope_a.where(id: open_ra.id)).to exist
        expect(scope_b.where(id: open_ra.id)).to exist
      end
    end
  end

  describe "#assign_storekeeper?" do
    let(:hub) { create(:cats_warehouse_hub) }
    let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
    let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
    let(:other_wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
    let(:hm) { create(:cats_core_user, role_name: "Hub Manager") }
    let(:commodity) { create(:cats_core_commodity) }
    let(:unit) { commodity.unit_of_measure }
    let(:transporter) { create(:cats_core_transporter) }

    let(:receipt_order) do
      Cats::Warehouse::ReceiptOrder.create!(
        hub: hub,
        created_by: hm,
        status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:assigned],
        reference_no: "RO-ASN-#{SecureRandom.hex(4)}",
        received_date: Date.current
      )
    end

    let(:receipt_line) do
      Cats::Warehouse::ReceiptOrderLine.create!(
        receipt_order: receipt_order,
        commodity: commodity,
        unit: unit,
        quantity: 100,
        line_reference_no: "RL-ASN-#{SecureRandom.hex(4)}"
      )
    end

    let(:ra) do
      Cats::Warehouse::ReceiptAuthorization.create!(
        receipt_order: receipt_order,
        receipt_order_line: receipt_line,
        warehouse: warehouse,
        transporter: transporter,
        authorized_quantity: 10,
        driver_name: "Driver",
        driver_id_number: "ID-1",
        truck_plate_number: "AA-1",
        waybill_number: "WB-ASN-#{SecureRandom.hex(4)}",
        status: Cats::Warehouse::ReceiptAuthorization::PENDING,
        reference_no: "RA-ASN-#{SecureRandom.hex(4)}",
        created_by: hm
      )
    end

    before do
      receipt_line
      Cats::Warehouse::UserAssignment.create!(user: wm, warehouse: warehouse, role_name: "Warehouse Manager")
      Cats::Warehouse::UserAssignment.create!(
        user: other_wm,
        warehouse: create(:cats_warehouse_warehouse, hub: hub),
        role_name: "Warehouse Manager"
      )
    end

    it "allows warehouse manager at the RA warehouse while pending" do
      policy = described_class.new(wm, ra)
      expect(policy.assign_storekeeper?).to be(true)
    end

    it "denies warehouse manager at a different warehouse" do
      policy = described_class.new(other_wm, ra)
      expect(policy.assign_storekeeper?).to be(false)
    end

    context "when warehouse has a single store" do
      let!(:sole_store) { create(:cats_warehouse_store, warehouse: warehouse) }

      it "denies manual assignment at hub-backed warehouses" do
        policy = described_class.new(wm, ra)
        expect(policy.assign_storekeeper?).to be(false)
      end
    end

    context "when standalone warehouse has a single store" do
      let(:standalone_warehouse) do
        create(:cats_warehouse_warehouse, hub: nil, location: create(:cats_core_location), managed_under: "federal")
      end
      let!(:sole_store) { create(:cats_warehouse_store, warehouse: standalone_warehouse) }
      let(:standalone_wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
      let(:standalone_ra) do
        Cats::Warehouse::ReceiptAuthorization.create!(
          receipt_order: receipt_order,
          receipt_order_line: receipt_line,
          warehouse: standalone_warehouse,
          store: sole_store,
          transporter: transporter,
          authorized_quantity: 10,
          driver_name: "Driver",
          driver_id_number: "ID-1",
          truck_plate_number: "AA-1",
          waybill_number: "WB-STANDALONE-ASN-#{SecureRandom.hex(4)}",
          status: Cats::Warehouse::ReceiptAuthorization::PENDING,
          reference_no: "RA-STANDALONE-ASN-#{SecureRandom.hex(4)}",
          created_by: hm
        )
      end

      before do
        Cats::Warehouse::UserAssignment.create!(
          user: standalone_wm,
          warehouse: standalone_warehouse,
          role_name: "Warehouse Manager"
        )
      end

      it "allows manual assignment for independent warehouse managers" do
        policy = described_class.new(standalone_wm, standalone_ra)
        expect(policy.assign_storekeeper?).to be(true)
      end
    end
  end

  describe "#driver_confirm?" do
    let(:hub) { create(:cats_warehouse_hub) }
    let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
    let(:sk) { create(:cats_core_user, role_name: "Storekeeper") }
    let(:other_sk) { create(:cats_core_user, role_name: "Storekeeper") }
    let(:hm) { create(:cats_core_user, role_name: "Hub Manager") }
    let(:commodity) { create(:cats_core_commodity) }
    let(:unit) { commodity.unit_of_measure }
    let(:transporter) { create(:cats_core_transporter) }

    let(:receipt_order) do
      Cats::Warehouse::ReceiptOrder.create!(
        hub: hub,
        created_by: hm,
        status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:assigned],
        reference_no: "RO-DC-#{SecureRandom.hex(4)}",
        received_date: Date.current
      )
    end

    let(:receipt_line) do
      Cats::Warehouse::ReceiptOrderLine.create!(
        receipt_order: receipt_order,
        commodity: commodity,
        unit: unit,
        quantity: 100,
        line_reference_no: "RL-DC-#{SecureRandom.hex(4)}"
      )
    end

    let(:ra) do
      Cats::Warehouse::ReceiptAuthorization.create!(
        receipt_order: receipt_order,
        receipt_order_line: receipt_line,
        warehouse: warehouse,
        transporter: transporter,
        authorized_quantity: 10,
        driver_name: "Driver",
        driver_id_number: "ID-1",
        truck_plate_number: "AA-1",
        waybill_number: "WB-DC-#{SecureRandom.hex(4)}",
        status: Cats::Warehouse::ReceiptAuthorization::ACTIVE,
        reference_no: "RA-DC-#{SecureRandom.hex(4)}",
        created_by: hm,
        assigned_storekeeper_id: sk.id
      )
    end

    before { receipt_line }

    it "allows only the assigned storekeeper" do
      expect(described_class.new(sk, ra).driver_confirm?).to be(true)
      expect(described_class.new(other_sk, ra).driver_confirm?).to be(false)
    end

    context "when warehouse has a single store and RA is unassigned" do
      let!(:sole_store) { create(:cats_warehouse_store, warehouse: warehouse) }
      let(:open_ra) do
        Cats::Warehouse::ReceiptAuthorization.create!(
          receipt_order: receipt_order,
          receipt_order_line: receipt_line,
          warehouse: warehouse,
          store: sole_store,
          transporter: transporter,
          authorized_quantity: 10,
          driver_name: "Driver",
          driver_id_number: "ID-1",
          truck_plate_number: "AA-1",
          waybill_number: "WB-DC-OPEN-#{SecureRandom.hex(4)}",
          status: Cats::Warehouse::ReceiptAuthorization::ACTIVE,
          reference_no: "RA-DC-OPEN-#{SecureRandom.hex(4)}",
          created_by: hm
        )
      end

      before do
        Cats::Warehouse::UserAssignment.create!(user: sk, warehouse: warehouse, role_name: "Storekeeper")
        Cats::Warehouse::UserAssignment.create!(user: other_sk, warehouse: warehouse, role_name: "Storekeeper")
      end

      it "allows any eligible storekeeper before claim" do
        expect(described_class.new(sk, open_ra).driver_confirm?).to be(true)
        expect(described_class.new(other_sk, open_ra).driver_confirm?).to be(true)
      end
    end
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
