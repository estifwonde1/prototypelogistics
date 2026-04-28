# frozen_string_literal: true

require "rails_helper"
require "rantly/rspec_extensions"

RSpec.describe Cats::Warehouse::LocationTagger, type: :service do
  # Maps sub-federal role names to the required location_type
  SUB_FEDERAL_ROLE_TO_LOCATION_TYPE = {
    "Regional Officer" => "Region",
    "Zonal Officer"    => "Zone",
    "Woreda Officer"   => "Woreda",
    "Kebele Officer"   => "Kebele"
  }.freeze

  # Builds a valid location for the given type, creating parent chain as needed.
  def build_location_for_type(location_type)
    case location_type
    when "Region"
      create(:cats_core_location, location_type: "Region")
    when "Zone"
      region = create(:cats_core_location, location_type: "Region")
      create(:cats_core_location, location_type: "Zone", parent: region)
    when "Woreda"
      region = create(:cats_core_location, location_type: "Region")
      zone   = create(:cats_core_location, location_type: "Zone", parent: region)
      create(:cats_core_location, location_type: "Woreda", parent: zone)
    when "Kebele"
      region = create(:cats_core_location, location_type: "Region")
      zone   = create(:cats_core_location, location_type: "Zone", parent: region)
      woreda = create(:cats_core_location, location_type: "Woreda", parent: zone)
      create(:cats_core_location, location_type: "Kebele", parent: woreda)
    end
  end

  # ─────────────────────────────────────────────────────────────────────────────
  # Property 1: Sub-federal order creation always tags location
  #
  # For any sub-federal officer with a valid location assignment, calling
  # LocationTagger.call(user:) must return:
  #   - location_id        == assignment.location.id
  #   - hierarchical_level == assignment.location.location_type
  #
  # Validates: Requirements 1.1, 1.2
  # ─────────────────────────────────────────────────────────────────────────────
  describe "Property 1: Sub-federal order creation always tags location" do
    it "always returns the assignment location_id and location_type as hierarchical_level" do
      property_of {
        choose("Regional Officer", "Zonal Officer", "Woreda Officer", "Kebele Officer")
      }.check(100) do |role_name|
        location_type = SUB_FEDERAL_ROLE_TO_LOCATION_TYPE[role_name]
        location = build_location_for_type(location_type)
        user = create(:cats_core_user)
        Cats::Warehouse::UserAssignment.create!(
          user: user,
          role_name: role_name,
          location: location
        )

        result = described_class.call(user: user)

        expect(result[:location_id]).to eq(location.id)
        expect(result[:hierarchical_level]).to eq(location_type)
      end
    end
  end

  # ─────────────────────────────────────────────────────────────────────────────
  # Property 2: Missing location assignment always rejects order creation
  #
  # For any sub-federal officer whose active assignment has no valid location
  # (location is nil), calling LocationTagger.call(user:) must always raise
  # ArgumentError with message "A geographic assignment is required to create orders".
  #
  # Validates: Requirements 1.3
  # ─────────────────────────────────────────────────────────────────────────────
  describe "Property 2: Missing location assignment always rejects order creation" do
    it "always raises ArgumentError when a sub-federal officer has no location" do
      property_of {
        choose("Regional Officer", "Zonal Officer", "Woreda Officer", "Kebele Officer")
      }.check(100) do |role_name|
        user = create(:cats_core_user)
        # Bypass model validations to simulate a sub-federal assignment with no location,
        # which is the scenario Property 2 tests (location is nil despite a sub-federal role).
        assignment = Cats::Warehouse::UserAssignment.new(
          user: user,
          role_name: role_name,
          location: nil
        )
        assignment.save(validate: false)

        expect {
          described_class.call(user: user)
        }.to raise_error(ArgumentError, "A geographic assignment is required to create orders")
      end
    end
  end

  # ─────────────────────────────────────────────────────────────────────────────
  # Property 3: Federal officer orders always have null location and Federal level
  #
  # For any Federal Officer or generic Officer (including blank/unknown roles),
  # calling LocationTagger.call(user:) must always return:
  #   - location_id        == nil
  #   - hierarchical_level == "Federal"
  #
  # Validates: Requirements 1.4
  # ─────────────────────────────────────────────────────────────────────────────
  describe "Property 3: Federal officer orders always have null location and Federal level" do
    it "always returns { location_id: nil, hierarchical_level: 'Federal' } for federal/generic/unknown roles" do
      property_of {
        # Generate federal roles, generic officer role, blank role, and unknown/arbitrary roles
        choose(
          "Federal Officer",
          "Officer",
          "",
          sized(range(0, 20)) { string(:alpha) }
        )
      }.check(100) do |role_name|
        user = create(:cats_core_user)

        unless role_name.blank?
          # Bypass model validations — we only care that the role_name is set;
          # unknown roles and federal roles both have no location requirement.
          assignment = Cats::Warehouse::UserAssignment.new(
            user: user,
            role_name: role_name,
            location: nil
          )
          assignment.save(validate: false)
        end

        result = described_class.call(user: user)

        expect(result[:location_id]).to be_nil
        expect(result[:hierarchical_level]).to eq("Federal")
      end
    end
  end
end
