# frozen_string_literal: true

class SyncDispatchOrderReferences < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL.squish
      UPDATE cats_warehouse_dispatch_orders
      SET dispatch_reference = COALESCE(NULLIF(TRIM(reference_no), ''), 'DO-' || id::text)
      WHERE reference_no IS NOT NULL
        AND TRIM(reference_no) <> ''
        AND (dispatch_reference IS NULL OR dispatch_reference <> reference_no)
    SQL
  end

  def down
    # irreversible data fix
  end
end
