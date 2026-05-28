# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::DispatchDestinationLookupScope, type: :service do
  let(:region) do
    Cats::Core::Location.find_or_create_by!(name: "Dest Scope Region", location_type: Cats::Core::Location::REGION)
  end
  let(:zone) do
    Cats::Core::Location.find_or_create_by!(
      name: "Dest Scope Zone",
      location_type: Cats::Core::Location::ZONE,
      parent: region
    )
  end
  let(:woreda_location) do
    Cats::Core::Location.find_or_create_by!(
      name: "Dest Scope Woreda",
      location_type: Cats::Core::Location::WOREDA,
      parent: zone
    )
  end
  let(:fdp_location) do
    Cats::Core::Location.find_or_create_by!(
      name: "Dest Scope FDP",
      location_type: Cats::Core::Location::FDP,
      parent: zone
    )
  end
  let!(:ascu_like_warehouse) do
    create(:cats_warehouse_warehouse, name: "ascu", code: "wh02", location: woreda_location)
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

  it "includes warehouses linked to woreda locations in jurisdiction" do
    access = Cats::Warehouse::AccessContext.new(user: officer)
    scope = described_class.call(access: access)

    expect(scope.warehouses_scope.pluck(:id)).to include(ascu_like_warehouse.id)
  end

  it "includes FDP locations in jurisdiction" do
    access = Cats::Warehouse::AccessContext.new(user: officer)
    scope = described_class.call(access: access)

    expect(scope.fdp_locations_scope.pluck(:id)).to include(fdp_location.id)
  end

  it "does not expose bare woreda locations as destinations" do
    access = Cats::Warehouse::AccessContext.new(user: officer)
    scope = described_class.call(access: access)

    expect(scope.fdp_locations_scope.pluck(:id)).not_to include(woreda_location.id)
    expect(scope.warehouses_scope.pluck(:location_id)).to include(woreda_location.id)
  end
end
