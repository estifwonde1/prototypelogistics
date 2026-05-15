require "rails_helper"

RSpec.describe Cats::Warehouse::InventoryLedger, type: :service do
  let(:warehouse) { create(:cats_warehouse_warehouse) }
  let!(:warehouse_capacity) { create(:cats_warehouse_warehouse_capacity, warehouse: warehouse) }
  let(:store) do
    create(:cats_warehouse_store, warehouse: warehouse,
           length: 20, width: 20, height: 10,
           usable_space: 4000, available_space: 4000)
  end
  let(:commodity) { create(:cats_core_commodity, volume_per_metric_ton: 1.2) }
  let(:unit)      { commodity.unit_of_measure }
  let(:stack) do
    s = create(:cats_warehouse_stack,
               store: store, commodity: commodity, unit: unit,
               length: 5, width: 5, height: 5,
               quantity: 0, base_quantity: 0,
               stack_status: "empty")
    s.update_columns(occupied_volume: 0)
    s
  end
  let(:grn)  { create(:cats_warehouse_grn, warehouse: warehouse) }
  let(:user) { create(:cats_core_user) }

  def make_item(quantity:, stack: self.stack)
    create(:cats_warehouse_grn_item,
           grn: grn,
           commodity: commodity,
           unit: unit,
           store: store,
           stack: stack,
           quantity: quantity,
           line_reference_no: "LR-#{SecureRandom.hex(4)}")
  end

  def apply_receipt(item)
    described_class.apply_receipt!(
      warehouse: warehouse,
      item: item,
      transaction_date: Date.today,
      reference: grn
    )
  end

  # ── apply_receipt! ──────────────────────────────────────────────────────────

  describe ".apply_receipt!" do
    it "increments StockBalance quantity" do
      item = make_item(quantity: 10)
      apply_receipt(item)

      balance = Cats::Warehouse::StockBalance.find_by!(stack_id: stack.id)
      expect(balance.quantity).to eq(10)
    end

    it "increments Stack quantity and sets status to active" do
      item = make_item(quantity: 5)
      apply_receipt(item)

      expect(stack.reload.quantity).to eq(5)
      expect(stack.reload.stack_status).to eq("active")
    end

    it "creates a StackTransaction" do
      item = make_item(quantity: 3)
      expect { apply_receipt(item) }.to change(Cats::Warehouse::StackTransaction, :count).by(1)

      tx = Cats::Warehouse::StackTransaction.last
      expect(tx.destination_id).to eq(stack.id)
      expect(tx.quantity).to eq(3)
    end

    it "updates store occupied_space and available_space via StoreOccupancyUpdater" do
      item = make_item(quantity: 10)
      apply_receipt(item)

      store.reload
      # stack volume = 5*5*5 = 125 m³; store usable = 4000
      expect(store.occupied_space).to eq(125.0)
      expect(store.available_space).to eq(3875.0)
    end

    context "space check — commodity has volume_per_metric_ton" do
      it "raises InsufficientSpaceError when incoming volume exceeds stack remaining space" do
        # stack volume = 125 m³; commodity = 1.2 m³/MT; 200 MT = 240 m³ > 125
        item = make_item(quantity: 200)

        expect { apply_receipt(item) }.to raise_error(
          Cats::Warehouse::InsufficientSpaceError,
          /Insufficient stack capacity/
        )
      end

      it "raises InsufficientSpaceError when incoming volume exceeds store available_space" do
        # Shrink store available_space to near zero
        store.update_columns(available_space: 0.5)
        item = make_item(quantity: 1) # 1 MT * 1.2 = 1.2 m³ > 0.5

        expect { apply_receipt(item) }.to raise_error(
          Cats::Warehouse::InsufficientSpaceError,
          /Insufficient store capacity/
        )
      end

      it "allows receipt when volume fits" do
        # 10 MT * 1.2 = 12 m³ < 125 stack volume
        item = make_item(quantity: 10)
        expect { apply_receipt(item) }.not_to raise_error
      end
    end

    context "space check — commodity has no volume_per_metric_ton" do
      let(:commodity) { create(:cats_core_commodity, volume_per_metric_ton: nil) }

      it "blocks receipt when density is unknown" do
        item = make_item(quantity: 10)
        expect { apply_receipt(item) }.to raise_error(
          Cats::Warehouse::InsufficientSpaceError,
          /volume_per_metric_ton/
        )
      end
    end
  end

  # ── stack emptying via apply_issue! ─────────────────────────────────────────

  describe "stack emptying through apply_issue!" do
    before do
      # First receive goods so the stack has quantity
      item = make_item(quantity: 10)
      apply_receipt(item)
    end

    it "clears commodity, unit, base_unit when stack reaches zero — single save!" do
      gin  = create(:cats_warehouse_gin, warehouse: warehouse)
      item = create(:cats_warehouse_gin_item,
                    gin: gin,
                    commodity: commodity,
                    unit: unit,
                    store: store,
                    stack: stack,
                    quantity: 10)

      described_class.apply_issue!(
        warehouse: warehouse,
        item: item,
        transaction_date: Date.today,
        reference: gin
      )

      stack.reload
      expect(stack.quantity).to eq(0)
      expect(stack.stack_status).to eq("empty")
      expect(stack.commodity_id).to be_nil
      expect(stack.unit_id).to be_nil
      expect(stack.base_unit_id).to be_nil
      expect(stack.occupied_volume).to eq(0)
    end

    it "does NOT clear commodity when stack still has goods" do
      gin  = create(:cats_warehouse_gin, warehouse: warehouse)
      item = create(:cats_warehouse_gin_item,
                    gin: gin,
                    commodity: commodity,
                    unit: unit,
                    store: store,
                    stack: stack,
                    quantity: 5) # only partial issue

      described_class.apply_issue!(
        warehouse: warehouse,
        item: item,
        transaction_date: Date.today,
        reference: gin
      )

      stack.reload
      expect(stack.quantity).to eq(5)
      expect(stack.commodity_id).to eq(commodity.id)
    end
  end

  # ── apply_adjustment! ───────────────────────────────────────────────────────

  describe ".apply_adjustment!" do
    before do
      item = make_item(quantity: 20)
      apply_receipt(item)
    end

    it "applies a positive adjustment" do
      adj_item = make_item(quantity: 5)
      described_class.apply_adjustment!(
        warehouse: warehouse,
        item: adj_item,
        quantity_delta: 5,
        transaction_date: Date.today,
        reference: grn
      )

      expect(stack.reload.quantity).to eq(25)
    end

    it "applies a negative adjustment" do
      adj_item = make_item(quantity: 5)
      described_class.apply_adjustment!(
        warehouse: warehouse,
        item: adj_item,
        quantity_delta: -5,
        transaction_date: Date.today,
        reference: grn
      )

      expect(stack.reload.quantity).to eq(15)
    end

    it "raises when adjustment would make balance negative" do
      adj_item = make_item(quantity: 999)
      expect do
        described_class.apply_adjustment!(
          warehouse: warehouse,
          item: adj_item,
          quantity_delta: -999,
          transaction_date: Date.today,
          reference: grn
        )
      end.to raise_error(ActiveRecord::RecordInvalid)
    end
  end
end
