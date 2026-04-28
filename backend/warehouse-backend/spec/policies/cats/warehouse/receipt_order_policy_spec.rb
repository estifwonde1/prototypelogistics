# frozen_string_literal: true

require "rails_helper"
require "rantly/rspec_extensions"

RSpec.describe Cats::Warehouse::ReceiptOrderPolicy, type: :policy do
  POLICY_LEVEL_ORDER = %w[Federal Region Zone Woreda Kebele].freeze

  POLICY_ROLE_TO_LOCATION_TYPE = {
    "Regional Officer" => "Region",
    "Zonal Officer"    => "Zone",
    "Woreda Officer"   => "Woreda",
    "Kebele Officer"   => "Kebele"
  }.freeze

  # Build a location for the given type, creating the required parent chain.
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

  # Create a ReceiptOrder with the given hierarchical_level and status.
  # Uses save!(validate: false) to bypass hub/warehouse validations.
  def create_order_at_level(hierarchical_level:, created_by:, status: "draft")
    order = Cats::Warehouse::ReceiptOrder.new(
      hierarchical_level: hierarchical_level,
      created_by:         created_by,
      status:             status
    )
    order.save!(validate: false)
    order
  end

  # ─────────────────────────────────────────────────────────────────────────────
  # Property 6: Out-of-scope order operations always return not-authorized
  #
  # For any sub-federal officer and any order whose hierarchical_level is
  # strictly higher (lower index in LEVEL_ORDER) than the officer's own level,
  # all operations — show?, update?, confirm?, destroy? — SHALL return false.
  #
  # Validates: Requirements 2.3, 3.3, 3.5
  # ─────────────────────────────────────────────────────────────────────────────
  describe "Property 6: Out-of-scope order operations always return not-authorized" do
    it "returns false for all operations when the order is at a higher hierarchical level" do
      property_of {
        choose("Regional Officer", "Zonal Officer", "Woreda Officer", "Kebele Officer")
      }.check(100) do |role_name|
        location_type       = POLICY_ROLE_TO_LOCATION_TYPE[role_name]
        officer_level_index = POLICY_LEVEL_ORDER.index(location_type)

        # Build a location for the officer
        officer_location = build_location_for_type(location_type)

        # Create the officer user and their UserAssignment
        user = create(:cats_core_user)
        Cats::Warehouse::UserAssignment.create!(
          user:      user,
          role_name: role_name,
          location:  officer_location
        )

        # A separate user to be the order creator (avoids FK issues)
        order_creator = create(:cats_core_user)

        # Pick a hierarchical_level that is ABOVE the officer's level
        # (lower index in LEVEL_ORDER → strictly higher in hierarchy)
        above_levels = POLICY_LEVEL_ORDER[0...officer_level_index]

        # Regional Officers only have "Federal" above them; others have more.
        # Skip if there are no levels above (shouldn't happen for sub-federal, but guard anyway).
        next if above_levels.empty?

        above_level = above_levels.sample

        # Create the out-of-scope order at the higher level.
        # status: "draft" ensures update?, confirm?, and destroy? are not blocked
        # by the status check — only the level check should block them.
        order = create_order_at_level(
          hierarchical_level: above_level,
          created_by:         order_creator,
          status:             "draft"
        )

        policy = described_class.new(user, order)

        expect(policy.show?).to eq(false),
          "Expected show? to be false for #{role_name} (level #{location_type}) " \
          "on order with hierarchical_level=#{above_level}"

        expect(policy.update?).to eq(false),
          "Expected update? to be false for #{role_name} (level #{location_type}) " \
          "on order with hierarchical_level=#{above_level}"

        expect(policy.confirm?).to eq(false),
          "Expected confirm? to be false for #{role_name} (level #{location_type}) " \
          "on order with hierarchical_level=#{above_level}"

        expect(policy.destroy?).to eq(false),
          "Expected destroy? to be false for #{role_name} (level #{location_type}) " \
          "on order with hierarchical_level=#{above_level}"
      end
    end
  end
end
