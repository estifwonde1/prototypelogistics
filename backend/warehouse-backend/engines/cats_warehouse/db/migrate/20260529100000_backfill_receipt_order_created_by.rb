# frozen_string_literal: true

class BackfillReceiptOrderCreatedBy < ActiveRecord::Migration[7.0]
  def up
    return unless table_exists?(:cats_warehouse_receipt_orders)

    say_with_time "Backfilling missing created_by_id on receipt orders" do
      Cats::Warehouse::ReceiptOrder.backfill_missing_created_by!
    end
  end

  def down
    # Non-reversible: we cannot know which rows originally lacked created_by_id.
  end
end
