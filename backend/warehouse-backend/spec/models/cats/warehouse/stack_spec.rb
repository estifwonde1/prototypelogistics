require "rails_helper"

RSpec.describe Cats::Warehouse::Stack, type: :model do
  let(:warehouse) { create(:cats_warehouse_warehouse) }
  let(:store) do
    create(:cats_warehouse_store, warehouse: warehouse,
           length: 20, width: 20, height: 10,
           usable_space: 4000, available_space: 4000)
  end

  def build_stack(**overrides)
    build(:cats_warehouse_stack,
          store: store,
          length: 3, width: 3, height: 3,
          quantity: 0,
          **overrides)
  end

  # ── stacking rules ──────────────────────────────────────────────────────────

  describe "stacking rule enforcement" do
    let!(:rule) do
      Cats::Warehouse::StackingRule.create!(
        warehouse: warehouse,
        distance_from_wall: 0.5,
        space_between_stack: 0.5,
        distance_from_ceiling: 0.3,
        distance_from_gangway: 0.5,
        maximum_height: 4.0,
        maximum_length: 5.0,
        maximum_width: 5.0
      )
    end

    it "is valid when dimensions are within rule limits" do
      stack = build_stack(height: 3, length: 4, width: 4)
      expect(stack).to be_valid
    end

    it "is invalid when height exceeds maximum_height" do
      stack = build_stack(height: 5)
      expect(stack).not_to be_valid
      expect(stack.errors[:height]).to include(/exceeds the warehouse stacking rule maximum height/)
    end

    it "is invalid when length exceeds maximum_length" do
      stack = build_stack(length: 6)
      expect(stack).not_to be_valid
      expect(stack.errors[:length]).to include(/exceeds the warehouse stacking rule maximum length/)
    end

    it "is invalid when width exceeds maximum_width" do
      stack = build_stack(width: 6)
      expect(stack).not_to be_valid
      expect(stack.errors[:width]).to include(/exceeds the warehouse stacking rule maximum width/)
    end

    it "skips rule check when no stacking rule exists for the warehouse" do
      rule.destroy
      stack = build_stack(height: 99, length: 99, width: 99)
      # Will still fail fits_inside_store, but NOT the stacking rule check
      stack.valid?
      expect(stack.errors[:height]).not_to include(/stacking rule/)
      expect(stack.errors[:length]).not_to include(/stacking rule/)
    end

    it "does not re-run rule check on quantity-only saves" do
      stack = create(:cats_warehouse_stack,
                     store: store, length: 3, width: 3, height: 3, quantity: 0)
      # Now change the rule to be more restrictive — but only update quantity
      rule.update_columns(maximum_height: 1.0)
      stack.quantity = 5
      # dimensions_changed? returns false for quantity-only change
      expect(stack).to be_valid
    end
  end

  # ── unpositioned placeholder stacks ─────────────────────────────────────────

  describe "unpositioned reservation placeholders" do
    it "is valid with nil start_x and start_y" do
      stack = build_stack(start_x: nil, start_y: nil)
      expect(stack).to be_valid
    end

    it "does not trigger overlap validation when unpositioned" do
      create(:cats_warehouse_stack,
             store: store, start_x: nil, start_y: nil,
             length: 3, width: 3, height: 3, quantity: 0)
      second = build_stack(start_x: nil, start_y: nil)
      expect(second).to be_valid
    end

    it "does trigger overlap validation when positioned" do
      create(:cats_warehouse_stack,
             store: store, start_x: 0, start_y: 0,
             length: 3, width: 3, height: 3, quantity: 0)
      overlapping = build_stack(start_x: 1, start_y: 1)
      expect(overlapping).not_to be_valid
      expect(overlapping.errors[:base]).to include(/overlaps/)
    end
  end

  # ── sync_occupied_volume callback ───────────────────────────────────────────

  describe "sync_occupied_volume before_save" do
    it "sets occupied_volume to l*w*h when quantity > 0" do
      stack = create(:cats_warehouse_stack,
                     store: store, length: 2, width: 3, height: 4, quantity: 5)
      expect(stack.occupied_volume).to eq(24.0)
    end

    it "sets occupied_volume to 0 when quantity is 0" do
      stack = create(:cats_warehouse_stack,
                     store: store, length: 2, width: 3, height: 4, quantity: 0)
      expect(stack.occupied_volume).to eq(0.0)
    end
  end

  # ── commodity lock ───────────────────────────────────────────────────────────

  describe "commodity_lock_respected" do
    it "prevents changing commodity while stack holds goods" do
      stack = create(:cats_warehouse_stack, store: store, quantity: 10)
      other_commodity = create(:cats_core_commodity,
                               name: "Different Commodity #{SecureRandom.hex(3)}")
      stack.commodity = other_commodity
      expect(stack).not_to be_valid
      expect(stack.errors[:commodity]).to be_present
    end

    it "allows clearing commodity when stack is empty" do
      stack = create(:cats_warehouse_stack, store: store, quantity: 0)
      stack.commodity = nil
      stack.unit = nil
      expect(stack).to be_valid
    end
  end
end
