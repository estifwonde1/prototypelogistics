# frozen_string_literal: true

# Removes the generic "Officer" role and its seeded user (officer@example.com)
# from the database. The role has been replaced by the specific officer roles
# (Federal Officer, Regional Officer, Zonal Officer, Woreda Officer, Kebele Officer).
class RemoveOfficerRoleAndSeedUser < ActiveRecord::Migration[7.0]
  def up
    # Remove the seeded officer user if it still exists
    officer_user = Cats::Core::User.find_by(email: "officer@example.com")
    if officer_user
      execute("DELETE FROM cats_warehouse_user_assignments WHERE user_id = #{officer_user.id}")
      execute("DELETE FROM users_roles WHERE user_id = #{officer_user.id}") if table_exists?(:users_roles)
      officer_user.destroy
    end

    # Remove the "Officer" role if it still exists
    officer_role = Cats::Core::Role.find_by(name: "Officer")
    if officer_role
      # Delete the join table first (cats_core_role_menus_menu_items → cats_core_role_menus)
      if table_exists?(:cats_core_role_menus_menu_items)
        execute(<<~SQL)
          DELETE FROM cats_core_role_menus_menu_items
          WHERE role_menu_id IN (
            SELECT id FROM cats_core_role_menus WHERE role_id = #{officer_role.id}
          )
        SQL
      end
      execute("DELETE FROM cats_core_role_menus WHERE role_id = #{officer_role.id}") if table_exists?(:cats_core_role_menus)
      officer_role.destroy
    end
  end

  def down
    say "Officer role and seed user removal is irreversible."
  end
end
