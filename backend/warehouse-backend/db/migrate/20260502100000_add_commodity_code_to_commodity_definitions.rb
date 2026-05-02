class AddCommodityCodeToCommodityDefinitions < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_commodity_definitions, :commodity_code, :string

    # Backfill existing rows with a generated code so the NOT NULL constraint can be added
    reversible do |dir|
      dir.up do
        execute <<~SQL
          UPDATE cats_warehouse_commodity_definitions
          SET commodity_code = CONCAT('COMM-', LPAD(id::text, 4, '0'))
          WHERE commodity_code IS NULL
        SQL
      end
    end

    change_column_null :cats_warehouse_commodity_definitions, :commodity_code, false
    add_index :cats_warehouse_commodity_definitions, :commodity_code, unique: true, name: "idx_comm_defs_on_code"
  end
end
