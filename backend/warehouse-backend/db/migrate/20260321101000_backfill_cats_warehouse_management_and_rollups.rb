class BackfillCatsWarehouseManagementAndRollups < ActiveRecord::Migration[7.0]
  class Warehouse < ActiveRecord::Base
    self.table_name = "cats_warehouse_warehouses"
  end

  class WarehouseCapacity < ActiveRecord::Base
    self.table_name = "cats_warehouse_warehouse_capacity"
  end

  class HubCapacity < ActiveRecord::Base
    self.table_name = "cats_warehouse_hub_capacity"
  end

  class HubContact < ActiveRecord::Base
    self.table_name = "cats_warehouse_hub_contacts"
  end

  class UserAssignment < ActiveRecord::Base
    self.table_name = "cats_warehouse_user_assignments"
  end

  class User < ActiveRecord::Base
    self.table_name = "cats_core_users"
  end

  def up
    Warehouse.where(managed_under: "hub").update_all(managed_under: "Hub")
    Warehouse.where(hub_id: nil, managed_under: "Hub").update_all(managed_under: "Addis Ababa Government")
    Warehouse.where(hub_id: nil, managed_under: [nil, ""]).update_all(managed_under: "Addis Ababa Government")
    Warehouse.where.not(hub_id: nil).update_all(managed_under: "Hub")
    Warehouse.where(ownership_type: [nil, ""]).update_all(ownership_type: "self_owned")

    say_with_time "Recomputing hub capacities" do
      Warehouse.group(:hub_id).count.each_key do |hub_id|
        next if hub_id.blank?

        totals = WarehouseCapacity.joins("INNER JOIN cats_warehouse_warehouses w ON w.id = cats_warehouse_warehouse_capacity.warehouse_id")
                                 .where("w.hub_id = ?", hub_id)
                                 .pick(Arel.sql("COALESCE(SUM(total_area_sqm), 0)"), Arel.sql("COALESCE(SUM(total_storage_capacity_mt), 0)"))

        record = HubCapacity.find_or_initialize_by(hub_id: hub_id)
        record.total_area_sqm = totals&.first.to_f
        record.total_capacity_mt = totals&.last.to_f
        record.save!
      end
    end

    say_with_time "Backfilling hub contacts from Hub Manager assignments" do
      UserAssignment.where(role_name: "Hub Manager").order(:id).find_each do |assignment|
        next if assignment.hub_id.blank?

        user = User.find_by(id: assignment.user_id)
        next unless user

        contact = HubContact.find_or_initialize_by(hub_id: assignment.hub_id)
        manager_name = [user.first_name, user.last_name].compact.join(" ").strip
        contact.manager_name = manager_name.presence || user.email
        contact.contact_phone = user.phone_number if user.respond_to?(:phone_number)
        contact.contact_email = user.email
        contact.save!
      end
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
