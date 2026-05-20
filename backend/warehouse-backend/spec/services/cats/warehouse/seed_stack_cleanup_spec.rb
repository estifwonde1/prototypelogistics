# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::SeedStackCleanup do
  let(:warehouse) { create(:cats_warehouse_warehouse, code: "ADD-WH-01") }
  let(:store) { create(:cats_warehouse_store, warehouse: warehouse, code: "ADD-WH-01-ST1") }

  def build_stack(code:, **attrs)
    create(:cats_warehouse_stack, store: store, code: code, quantity: 0, **attrs)
  end

  describe ".legacy_seed_stack?" do
    it "matches legacy store-code-S{n} pattern" do
      stack = build_stack(code: "ADD-WH-01-ST1-S4")
      expect(described_class.legacy_seed_stack?(stack)).to be(true)
    end

    it "does not match user-created codes" do
      expect(described_class.legacy_seed_stack?(build_stack(code: "stk"))).to be(false)
      expect(described_class.legacy_seed_stack?(build_stack(code: "STK_TEST 010"))).to be(false)
      expect(described_class.legacy_seed_stack?(build_stack(code: "STK-005W"))).to be(false)
    end

    it "matches SEED- prefix" do
      expect(described_class.legacy_seed_stack?(build_stack(code: "SEED-STK-001"))).to be(true)
    end
  end

  describe ".destroy_legacy_seed_stacks!" do
    it "removes legacy stacks and keeps user stacks" do
      legacy = build_stack(code: "ADD-WH-01-ST1-S1")
      user_stack = build_stack(code: "STK-NEW")

      expect { described_class.destroy_legacy_seed_stacks! }
        .to change(Cats::Warehouse::Stack, :count).by(-1)

      expect(Cats::Warehouse::Stack.exists?(legacy.id)).to be(false)
      expect(Cats::Warehouse::Stack.exists?(user_stack.id)).to be(true)
    end
  end
end
