# frozen_string_literal: true

# Per-line reference used as batch identity for traceability (GRN, inspection, receipt order lines).
class AddLineReferenceNoToSourceDetailLines < ActiveRecord::Migration[7.0]
  def up
    add_column :cats_warehouse_grn_items, :line_reference_no, :string
    add_column :cats_warehouse_inspection_items, :line_reference_no, :string
    add_column :cats_warehouse_receipt_order_lines, :line_reference_no, :string

    say_with_time "Backfill line_reference_no on cats_warehouse_grn_items" do
      execute <<~SQL.squish
        UPDATE cats_warehouse_grn_items
        SET line_reference_no = 'LEGACY-GRI-' || grn_id::text || '-' || id::text
        WHERE line_reference_no IS NULL
      SQL
    end

    say_with_time "Backfill line_reference_no on cats_warehouse_inspection_items" do
      execute <<~SQL.squish
        UPDATE cats_warehouse_inspection_items
        SET line_reference_no = 'LEGACY-INS-' || inspection_id::text || '-' || id::text
        WHERE line_reference_no IS NULL
      SQL
    end

    say_with_time "Backfill line_reference_no on cats_warehouse_receipt_order_lines" do
      execute <<~SQL.squish
        UPDATE cats_warehouse_receipt_order_lines
        SET line_reference_no = 'LEGACY-ROL-' || receipt_order_id::text || '-' || id::text
        WHERE line_reference_no IS NULL
      SQL
    end

    change_column_null :cats_warehouse_grn_items, :line_reference_no, false
    change_column_null :cats_warehouse_inspection_items, :line_reference_no, false
    change_column_null :cats_warehouse_receipt_order_lines, :line_reference_no, false

    add_index :cats_warehouse_grn_items, :line_reference_no, unique: true, name: "index_cats_warehouse_grn_items_on_line_reference_no"
    add_index :cats_warehouse_inspection_items, :line_reference_no, unique: true,
              name: "index_cats_warehouse_inspection_items_on_line_reference_no"
    add_index :cats_warehouse_receipt_order_lines, :line_reference_no, unique: true,
              name: "index_cats_warehouse_receipt_order_lines_on_line_reference_no"
  end

  def down
    remove_index :cats_warehouse_grn_items, name: "index_cats_warehouse_grn_items_on_line_reference_no"
    remove_index :cats_warehouse_inspection_items, name: "index_cats_warehouse_inspection_items_on_line_reference_no"
    remove_index :cats_warehouse_receipt_order_lines, name: "index_cats_warehouse_receipt_order_lines_on_line_reference_no"

    remove_column :cats_warehouse_grn_items, :line_reference_no
    remove_column :cats_warehouse_inspection_items, :line_reference_no
    remove_column :cats_warehouse_receipt_order_lines, :line_reference_no
  end
end
