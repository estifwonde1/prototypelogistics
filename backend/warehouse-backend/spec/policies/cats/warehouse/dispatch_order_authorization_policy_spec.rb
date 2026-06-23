# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::DispatchOrderAuthorizationPolicy, type: :policy do
  let(:standalone_warehouse) do
    create(:cats_warehouse_warehouse, hub: nil, location: create(:cats_core_location), managed_under: "federal")
  end
  let!(:warehouse_capacity) { create(:cats_warehouse_warehouse_capacity, warehouse: standalone_warehouse) }
  let!(:sole_store) { create(:cats_warehouse_store, warehouse: standalone_warehouse, name: "Bay 1") }
  let(:wm) { create(:cats_core_user, role_name: "Warehouse Manager") }
  let(:transporter) { create(:cats_core_transporter) }
  let(:storekeeper) { create(:cats_core_user, role_name: "Storekeeper") }
  let(:dispatch_order) do
    Cats::Warehouse::DispatchOrder.create!(
      warehouse: standalone_warehouse,
      created_by: wm,
      status: "confirmed",
      reference_no: "DO-SK-#{SecureRandom.hex(4)}"
    )
  end

  let!(:dao) do
    Cats::Warehouse::DispatchOrderAuthorization.create!(
      dispatch_order: dispatch_order,
      warehouse: standalone_warehouse,
      transporter: transporter,
      authorized_quantity: 25,
      driver_name: "Driver",
      driver_id_number: "ID-1",
      truck_plate_number: "AA-1",
      status: Cats::Warehouse::DispatchOrderAuthorization::CONFIRMED,
      reference_no: "DA-SK-#{SecureRandom.hex(4)}",
      created_by: wm
    )
  end

  describe "storekeeper scope for single-store independent warehouse" do
    before do
      Cats::Warehouse::UserAssignment.create!(
        user: storekeeper,
        warehouse: standalone_warehouse,
        role_name: "Storekeeper"
      )
    end

    it "includes confirmed unassigned DAs at the warehouse" do
      scope = described_class::Scope.new(storekeeper, Cats::Warehouse::DispatchOrderAuthorization.all).resolve

      expect(scope.where(id: dao.id)).to exist
    end

    it "includes DAs assigned to the storekeeper" do
      other_sk = create(:cats_core_user, role_name: "Storekeeper")
      Cats::Warehouse::UserAssignment.create!(
        user: other_sk,
        warehouse: standalone_warehouse,
        role_name: "Storekeeper"
      )
      dao.update!(assigned_storekeeper_id: storekeeper.id)

      scope = described_class::Scope.new(storekeeper, Cats::Warehouse::DispatchOrderAuthorization.all).resolve
      other_scope = described_class::Scope.new(other_sk, Cats::Warehouse::DispatchOrderAuthorization.all).resolve

      expect(scope.where(id: dao.id)).to exist
      expect(other_scope.where(id: dao.id)).not_to exist
    end

    it "excludes draft DAs that are unassigned" do
      dao.update!(status: Cats::Warehouse::DispatchOrderAuthorization::DRAFT)

      scope = described_class::Scope.new(storekeeper, Cats::Warehouse::DispatchOrderAuthorization.all).resolve

      expect(scope.where(id: dao.id)).not_to exist
    end
  end
end
