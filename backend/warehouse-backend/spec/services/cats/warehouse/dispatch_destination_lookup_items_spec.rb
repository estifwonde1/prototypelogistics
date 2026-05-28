# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::DispatchDestinationLookupItems, type: :service do
  let(:region) do
    Cats::Core::Location.find_or_create_by!(name: "Dest Items Region", location_type: Cats::Core::Location::REGION)
  end
  let(:zone) do
    Cats::Core::Location.find_or_create_by!(
      name: "Dest Items Zone",
      location_type: Cats::Core::Location::ZONE,
      parent: region
    )
  end
  let(:woreda_location) do
    Cats::Core::Location.find_or_create_by!(
      name: "Dest Items Woreda",
      location_type: Cats::Core::Location::WOREDA,
      parent: zone
    )
  end
  let(:fdp_location) do
    Cats::Core::Location.find_or_create_by!(
      name: "Alpha FDP",
      code: "FDP-A",
      location_type: Cats::Core::Location::FDP,
      parent: zone
    )
  end
  let!(:warehouse_a) do
    create(:cats_warehouse_warehouse, name: "Zulu Warehouse", code: "WH-Z", location: woreda_location)
  end
  let(:officer) { create(:cats_core_user) }

  before do
    officer.add_role("Regional Officer")
    Cats::Warehouse::UserAssignment.create!(
      user: officer,
      role_name: "Regional Officer",
      location: region
    )
  end

  let(:access) { Cats::Warehouse::AccessContext.new(user: officer) }

  it "labels woreda-linked warehouses with warehouse name and code" do
    items = described_class.call(access: access)
    row = items.find { |it| it[:id] == warehouse_a.location_id }

    expect(row).to include(
      name: "Zulu Warehouse",
      code: "WH-Z",
      label: "Zulu Warehouse (WH-Z)",
      location_type: Cats::Core::Location::WAREHOUSE
    )
    expect(row[:meta][:warehouse_id]).to eq(warehouse_a.id)
  end

  it "orders warehouses before FDPs" do
    items = described_class.call(access: access)
    warehouse_index = items.index { |it| it[:location_type] == Cats::Core::Location::WAREHOUSE }
    fdp_index = items.index { |it| it[:location_type] == Cats::Core::Location::FDP }

    expect(warehouse_index).to be < fdp_index
  end

  it "filters to warehouses only" do
    items = described_class.call(access: access, destination_kind: "warehouse")

    expect(items.pluck(:location_type).uniq).to eq([Cats::Core::Location::WAREHOUSE])
    expect(items.pluck(:id)).to include(warehouse_a.location_id)
  end

  it "filters to FDPs only" do
    items = described_class.call(access: access, destination_kind: "fdp")

    expect(items.pluck(:location_type).uniq).to eq([Cats::Core::Location::FDP])
    expect(items.pluck(:id)).to include(fdp_location.id)
  end

  it "filters by query on warehouse name" do
    items = described_class.call(access: access, query: "zulu")

    expect(items.size).to eq(1)
    expect(items.first[:name]).to eq("Zulu Warehouse")
  end

  it "does not emit duplicate destination ids when an FDP location is also a warehouse location_id" do
    fdp_as_warehouse_site = create(
      :cats_warehouse_warehouse,
      name: "Shared Site",
      code: "WH-SHARED",
      location: fdp_location
    )

    items = described_class.call(access: access)
    ids = items.map { |it| it[:id] }

    expect(ids.count(fdp_location.id)).to eq(1)
    expect(items.find { |it| it[:id] == fdp_location.id }[:location_type]).to eq(Cats::Core::Location::WAREHOUSE)
    expect(items.map { |it| it[:meta][:warehouse_id] }).to include(fdp_as_warehouse_site.id)
  end
end
