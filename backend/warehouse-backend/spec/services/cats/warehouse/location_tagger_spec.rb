# frozen_string_literal: true

require "rails_helper"

begin
  require "rantly/rspec_extensions"
rescue LoadError
  puts "Rantly gem not available - skipping property-based tests"
end

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

  describe "Property 1: Sub-federal order creation always tags location" do
    it "always returns the assignment location_id and location_type as hierarchical_level" do
      if defined?(Rantly)
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
      else
        # Fallback unit test when rantly is not available
        region = create(:cats_core_location, location_type: "Region")
        user = create(:cats_core_user)
        Cats::Warehouse::UserAssignment.create!(
          user: user,
          role_name: "Regional Officer",
          location: region
        )

        result = described_class.call(user: user)

        expect(result[:location_id]).to eq(region.id)
        expect(result[:hierarchical_level]).to eq("Region")
      end
    end
  end

  describe "Property 2: Missing location assignment always rejects order creation" do
    it "always raises ArgumentError when a sub-federal officer has no location" do
      if defined?(Rantly)
        property_of {
          choose("Regional Officer", "Zonal Officer", "Woreda Officer", "Kebele Officer")
        }.check(100) do |role_name|
          user = create(:cats_core_user)
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
      else
        # Fallback unit test when rantly is not available
        user = create(:cats_core_user)
        assignment = Cats::Warehouse::UserAssignment.new(
          user: user,
          role_name: "Regional Officer",
          location: nil
        )
        assignment.save(validate: false)

        expect {
          described_class.call(user: user)
        }.to raise_error(ArgumentError, "A geographic assignment is required to create orders")
      end
    end
  end

  describe "Property 3: Federal officer orders always have null location and Federal level" do
    it "always returns { location_id: nil, hierarchical_level: 'Federal' } for federal/generic/unknown roles" do
      if defined?(Rantly)
        property_of {
          choose(
            "Federal Officer",
            "Officer",
            "",
            sized(range(0, 20)) { string(:alpha) }
          )
        }.check(100) do |role_name|
          user = create(:cats_core_user)

          unless role_name.blank?
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
      else
        # Fallback unit test when rantly is not available
        user = create(:cats_core_user)
        assignment = Cats::Warehouse::UserAssignment.new(
          user: user,
          role_name: "Federal Officer",
          location: nil
        )
        assignment.save(validate: false)

        result = described_class.call(user: user)

        expect(result[:location_id]).to be_nil
        expect(result[:hierarchical_level]).to eq("Federal")
      end
    end
  end
end
