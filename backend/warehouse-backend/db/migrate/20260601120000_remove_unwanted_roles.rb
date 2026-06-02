# frozen_string_literal: true

# Removes legacy / unused roles from the database so they no longer appear
# in Admin → Users role pickers (Dispatch Planner, Hub Dispatch *, QA, etc.).
class RemoveUnwantedRoles < ActiveRecord::Migration[7.0]
  UNWANTED_ROLE_NAMES = [
    "Officer",
    "Dispatch Planner",
    "Hub Dispatch Officer",
    "Hub Dispatch Approver",
    "Quality Assurance",
    "Receipt Authorizer",
    "Inspector",
    "Dispatcher",
    "Superadmin",
  ].freeze

  USER_ROLE_JOIN_TABLES = %w[
    cats_core_users_cats_core_roles
    users_roles
  ].freeze

  def up
    UNWANTED_ROLE_NAMES.each do |role_name|
      role = Cats::Core::Role.find_by(name: role_name)
      next unless role

      detach_users_from_role(role.id)
      delete_role_menus(role.id)
      role.destroy
    end
  end

  def down
    say "Unwanted role removal is irreversible — re-seed or recreate roles manually if needed."
  end

  private

  def detach_users_from_role(role_id)
    USER_ROLE_JOIN_TABLES.each do |table|
      next unless table_exists?(table)

      if column_exists?(table, :cats_core_role_id)
        execute("DELETE FROM #{table} WHERE cats_core_role_id = #{role_id}")
      elsif column_exists?(table, :role_id)
        execute("DELETE FROM #{table} WHERE role_id = #{role_id}")
      end
    end
  end

  def delete_role_menus(role_id)
    return unless table_exists?(:cats_core_role_menus)

    if table_exists?(:cats_core_role_menus_menu_items)
      execute(<<~SQL.squish)
        DELETE FROM cats_core_role_menus_menu_items
        WHERE role_menu_id IN (
          SELECT id FROM cats_core_role_menus WHERE role_id = #{role_id}
        )
      SQL
    end

    execute("DELETE FROM cats_core_role_menus WHERE role_id = #{role_id}")
  end
end
