class UpdateHubTypeValues < ActiveRecord::Migration[7.0]
  def up
    # Update any existing hub_type values to match the new format
    # Map old values to new lowercase values
    execute <<-SQL
      UPDATE cats_warehouse_hubs
      SET hub_type = LOWER(hub_type)
      WHERE hub_type IS NOT NULL;
    SQL

    # Update specific old values that don't match the new format
    execute <<-SQL
      UPDATE cats_warehouse_hubs
      SET hub_type = 'regional'
      WHERE hub_type IN ('Subcity', 'subcity', 'Regional');
    SQL

    execute <<-SQL
      UPDATE cats_warehouse_hubs
      SET hub_type = 'woreda'
      WHERE hub_type IN ('Woreda');
    SQL

    execute <<-SQL
      UPDATE cats_warehouse_hubs
      SET hub_type = 'zonal'
      WHERE hub_type IN ('Zonal');
    SQL
  end

  def down
    # Optionally revert changes if needed
    # This is a data migration, so down might not be necessary
  end
end
