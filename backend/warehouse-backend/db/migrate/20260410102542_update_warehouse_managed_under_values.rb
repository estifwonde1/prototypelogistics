class UpdateWarehouseManagedUnderValues < ActiveRecord::Migration[7.0]
  def up
    # Update existing managed_under values to match the new format
    execute <<-SQL
      UPDATE cats_warehouse_warehouses
      SET managed_under = 'regional'
      WHERE managed_under = 'Regional Government';
    SQL

    execute <<-SQL
      UPDATE cats_warehouse_warehouses
      SET managed_under = 'zonal'
      WHERE managed_under = 'Zone/Subcity';
    SQL

    execute <<-SQL
      UPDATE cats_warehouse_warehouses
      SET managed_under = 'woreda'
      WHERE managed_under = 'Woreda';
    SQL
  end

  def down
    # Optionally revert changes if needed
    execute <<-SQL
      UPDATE cats_warehouse_warehouses
      SET managed_under = 'Regional Government'
      WHERE managed_under = 'regional';
    SQL

    execute <<-SQL
      UPDATE cats_warehouse_warehouses
      SET managed_under = 'Zone/Subcity'
      WHERE managed_under = 'zonal';
    SQL

    execute <<-SQL
      UPDATE cats_warehouse_warehouses
      SET managed_under = 'Woreda'
      WHERE managed_under = 'woreda';
    SQL
  end
end
