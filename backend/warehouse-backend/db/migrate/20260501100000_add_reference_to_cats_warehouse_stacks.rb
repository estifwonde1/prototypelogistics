class AddReferenceToCatsWarehouseStacks < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_stacks, :reference, :string
  end
end
