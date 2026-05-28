# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::DispatchAllocationReconciler, type: :service do
  let(:user) { Cats::Core::User.first || create(:user) }
  let(:commodity) { Cats::Core::Commodity.first }
  let(:unit) { commodity.unit_of_measure }
  let(:warehouse) { Cats::Warehouse::Warehouse.first }
  let(:destination) { Cats::Core::Location.where(location_type: Cats::Core::Location::WAREHOUSE).first }

  before do
    skip "Requires seeded warehouse and location data" if warehouse.blank? || destination.blank? || commodity.blank?

    Cats::Warehouse::StockBalance.where(warehouse_id: warehouse.id, commodity_id: commodity.id).delete_all
    Cats::Warehouse::StockBalance.create!(
      warehouse: warehouse,
      store: nil,
      stack: nil,
      commodity: commodity,
      quantity: 10_000,
      unit: unit,
      base_quantity: 10_000,
      base_unit_id: unit.id,
      available_quantity: 10_000,
      reserved_quantity: 0
    )
  end

  it "raises when source and destination totals do not match line base quantity" do
    order = Cats::Warehouse::DispatchOrderCreatorForOfficer.new(
      actor: user,
      dispatch_reference: "TEST-#{SecureRandom.hex(3)}",
      lines: [{
        commodity_id: commodity.id,
        quantity: 100,
        unit_id: unit.id,
        source_allocations: [{ warehouse_id: warehouse.id, quantity: 60, unit_id: unit.id }],
        destination_allocations: [{ destination_location_id: destination.id, quantity: 100, unit_id: unit.id }]
      }]
    ).call

    expect {
      described_class.call(order, strict: true)
    }.to raise_error(ArgumentError, /Source allocations/)
  end
end
