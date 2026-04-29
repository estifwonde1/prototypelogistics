# frozen_string_literal: true

require "rails_helper"

begin
  require "rantly/rspec_extensions"
  RANTLY_AVAILABLE = true
rescue LoadError
  puts "Rantly gem not available - skipping property-based tests"
  RANTLY_AVAILABLE = false
end

RSpec.describe Cats::Warehouse::HierarchicalOrderScopeQuery, type: :query do
  # Maps sub-federal role names to their location_type and LEVEL_ORDER index
  ROLE_TO_LOCATION_TYPE = {
    "Regional Officer" => "Region",
    "Zonal Officer"    => "Zone",
    "Woreda Officer"   => "Woreda",
    "Kebele Officer"   => "Kebele"
  }.freeze

  LEVEL_ORDER = %w[Federal Region Zone Woreda Kebele].freeze

  # Build a full location tree: Region → Zone → Woreda → Kebele
  # Returns a hash with all four location records.
  def build_location_tree
    region = create(:cats_core_location, location_type: "Region")
    zone   = create(:cats_core_location, location_type: "Zone",   parent: region)
    woreda = create(:cats_core_location, location_type: "Woreda", parent: zone)
    kebele = create(:cats_core_location, location_type: "Kebele", parent: woreda)
    { region: region, zone: zone, woreda: woreda, kebele: kebele }
  end

  # Build a second, completely separate location tree (out-of-subtree locations)
  def build_outside_tree
    region2 = create(:cats_core_location, location_type: "Region")
    zone2   = create(:cats_core_location, location_type: "Zone",   parent: region2)
    woreda2 = create(:cats_core_location, location_type: "Woreda", parent: zone2)
    kebele2 = create(:cats_core_location, location_type: "Kebele", parent: woreda2)
    { region: region2, zone: zone2, woreda: woreda2, kebele: kebele2 }
  end

  # Create a ReceiptOrder with the given location and hierarchical_level.
  # Uses save(validate: false) to bypass hub/warehouse requirements since
  # we only need the scoping fields for this property test.
  def create_order(location:, hierarchical_level:, created_by:)
    order = Cats::Warehouse::ReceiptOrder.new(
      location:           location,
      hierarchical_level: hierarchical_level,
      created_by:         created_by,
      status:             "draft"
    )
    order.save!(validate: false)
    order
  end

  # ─────────────────────────────────────────────────────────────────────────────
  # Property 4: Officer order list satisfies both visibility conditions
  #
  # For any sub-federal officer at any level and any set of orders in the system,
  # the scope query SHALL return only orders where:
  #   (a) the order's location_id is within the officer's geographic subtree
  #       (descendant-or-equal of the officer's assigned location), AND
  #   (b) the order's hierarchical_level is at or below the officer's own level
  #       in LEVEL_ORDER (same index or higher index = more local).
  #
  # Validates: Requirements 2.1, 3.1, 3.2
  # ─────────────────────────────────────────────────────────────────────────────
  if RANTLY_AVAILABLE
    describe "Property 4: Officer order list satisfies both visibility conditions" do
      it "returns only orders satisfying both geographic subtree and level conditions" do
        property_of {
          choose("Regional Officer", "Zonal Officer", "Woreda Officer", "Kebele Officer")
        }.check(100) do |role_name|
        # Build the primary location tree and a separate out-of-subtree tree
        tree    = build_location_tree
        outside = build_outside_tree

        officer_location_type = ROLE_TO_LOCATION_TYPE[role_name]
        officer_location      = tree[officer_location_type.downcase.to_sym]
        officer_level_index   = LEVEL_ORDER.index(officer_location_type)

        # Create a user and assign them as the sub-federal officer
        user = create(:cats_core_user)
        Cats::Warehouse::UserAssignment.create!(
          user:      user,
          role_name: role_name,
          location:  officer_location
        )

        # A shared "created_by" user for orders (avoids FK issues)
        order_creator = create(:cats_core_user)

        # ── In-scope orders ──────────────────────────────────────────────────
        # These are orders whose location is within the officer's subtree AND
        # whose hierarchical_level is at or below the officer's own level.
        in_scope_orders = []

        # All locations in the officer's subtree (officer's location + descendants)
        subtree_locations = [officer_location_type, *LEVEL_ORDER[(officer_level_index + 1)..]]
          .map { |lt| tree[lt.downcase.to_sym] }
          .compact

        subtree_locations.each do |loc|
          # For each subtree location, create orders at every allowed level
          LEVEL_ORDER[officer_level_index..].each do |level|
            in_scope_orders << create_order(
              location:           loc,
              hierarchical_level: level,
              created_by:         order_creator
            )
          end
        end

        # ── Out-of-scope orders ──────────────────────────────────────────────
        # Case 1: Location is in the subtree but hierarchical_level is ABOVE
        #         the officer's level (excluded by condition b).
        above_level_orders = []
        if officer_level_index > 0
          LEVEL_ORDER[0...officer_level_index].each do |higher_level|
            above_level_orders << create_order(
              location:           officer_location,
              hierarchical_level: higher_level,
              created_by:         order_creator
            )
          end
        end

        # Case 2: Location is OUTSIDE the officer's subtree (excluded by condition a).
        outside_location_orders = []
        outside.each_value do |loc|
          LEVEL_ORDER[officer_level_index..].each do |level|
            outside_location_orders << create_order(
              location:           loc,
              hierarchical_level: level,
              created_by:         order_creator
            )
          end
        end

        # ── Run the query ────────────────────────────────────────────────────
        result_ids = described_class.new(
          user:  user,
          scope: Cats::Warehouse::ReceiptOrder
        ).call.pluck(:id).to_set

        in_scope_ids      = in_scope_orders.map(&:id).to_set
        above_level_ids   = above_level_orders.map(&:id).to_set
        outside_ids       = outside_location_orders.map(&:id).to_set

        # All in-scope orders must be present
        expect(result_ids).to be_superset(in_scope_ids),
          "Expected all in-scope orders to be returned for #{role_name} at #{officer_location_type}. " \
          "Missing: #{(in_scope_ids - result_ids).to_a}"

        # No above-level orders must appear
        expect(result_ids & above_level_ids).to be_empty,
          "Expected no above-level orders for #{role_name} at #{officer_location_type}. " \
          "Found: #{(result_ids & above_level_ids).to_a}"

        # No outside-subtree orders must appear
        expect(result_ids & outside_ids).to be_empty,
          "Expected no outside-subtree orders for #{role_name} at #{officer_location_type}. " \
          "Found: #{(result_ids & outside_ids).to_a}"
      end
    end
  end

  # ─────────────────────────────────────────────────────────────────────────────
  # Property 5: Federal officer list returns all orders
  #
  # For any Federal Officer or generic Officer, the scope query SHALL return
  # all orders in the system regardless of location_id or hierarchical_level.
  #
  # Validates: Requirements 2.2
  # ─────────────────────────────────────────────────────────────────────────────
  describe "Property 5: Federal officer list returns all orders" do
    it "returns all orders for federal/generic officers" do
      property_of {
        choose("Federal Officer", "Officer", "")
      }.check(100) do |role_name|
        # Build a location tree and create orders at various levels
        tree = build_location_tree

        user = create(:cats_core_user)
        if role_name.present?
          # Bypass model validations — federal officers don't need a location
          assignment = Cats::Warehouse::UserAssignment.new(
            user:      user,
            role_name: role_name,
            location:  nil
          )
          assignment.save(validate: false)
        end

        order_creator = create(:cats_core_user)

        # Create orders at all levels and locations
        all_orders = []
        tree.each_value do |loc|
          LEVEL_ORDER.each do |level|
            all_orders << create_order(
              location:           loc,
              hierarchical_level: level,
              created_by:         order_creator
            )
          end
        end

        # Also create federal orders (no location)
        3.times do
          order = Cats::Warehouse::ReceiptOrder.new(
            location:           nil,
            hierarchical_level: "Federal",
            created_by:         order_creator,
            status:             "draft"
          )
          order.save!(validate: false)
          all_orders << order
        end

        # Run the query
        result_ids = described_class.new(
          user:  user,
          scope: Cats::Warehouse::ReceiptOrder
        ).call.pluck(:id).to_set

        all_order_ids = all_orders.map(&:id).to_set

        # Federal officer should see AT LEAST all orders we created
        # (may see more from other tests, but must include all of ours)
        expect(result_ids).to be_superset(all_order_ids),
          "Expected federal officer to see all created orders. Missing: #{(all_order_ids - result_ids).to_a}"
      end
    end
  end
  else
    puts "Skipping property-based tests - rantly gem not available"
    
    # Fallback unit tests when rantly is not available
    describe "Basic functionality tests (fallback)" do
      it "scopes orders correctly for zonal officer" do
        # Build location tree
        region = create(:cats_core_location, location_type: "Region")
        zone = create(:cats_core_location, location_type: "Zone", parent: region)
        woreda = create(:cats_core_location, location_type: "Woreda", parent: zone)

        user = create(:cats_core_user)
        Cats::Warehouse::UserAssignment.create!(
          user: user,
          role_name: "Zonal Officer",
          location: zone
        )

        order_creator = create(:cats_core_user)

        # Create orders at different levels
        zone_order = create_order(location: zone, hierarchical_level: "Zone", created_by: order_creator)
        woreda_order = create_order(location: woreda, hierarchical_level: "Woreda", created_by: order_creator)
        region_order = create_order(location: region, hierarchical_level: "Region", created_by: order_creator)

        result_ids = described_class.new(
          user: user,
          scope: Cats::Warehouse::ReceiptOrder
        ).call.pluck(:id).to_set

        expect(result_ids).to include(zone_order.id)
        expect(result_ids).to include(woreda_order.id)
        expect(result_ids).not_to include(region_order.id)
      end

      it "returns all orders for federal officer" do
        user = create(:cats_core_user)
        assignment = Cats::Warehouse::UserAssignment.new(
          user: user,
          role_name: "Federal Officer",
          location: nil
        )
        assignment.save(validate: false)

        order_creator = create(:cats_core_user)
        region = create(:cats_core_location, location_type: "Region")
        test_order = create_order(location: region, hierarchical_level: "Region", created_by: order_creator)

        result_ids = described_class.new(
          user: user,
          scope: Cats::Warehouse::ReceiptOrder
        ).call.pluck(:id).to_set

        expect(result_ids).to include(test_order.id)
      end
    end
  end
end
