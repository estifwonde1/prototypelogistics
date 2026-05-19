# frozen_string_literal: true

# Removes the generic "Officer" role and its seeded user (officer@example.com)
# from the database. The role has been replaced by the specific officer roles
# (Federal Officer, Regional Officer, Zonal Officer, Woreda Officer, Kebele Officer).
class RemoveOfficerRoleAndSeedUser < ActiveRecord::Migration[7.0]
  USER_ROLE_JOIN_TABLES = %w[
    cats_core_users_cats_core_roles
    cats_warehouse_user_assignments
    users_roles
  ].freeze

  def up
    officer_user = Cats::Core::User.find_by(email: "officer@example.com")
    if officer_user
      detach_user_from_database(officer_user.id)
      officer_user.destroy
    end

    officer_role = Cats::Core::Role.find_by(name: "Officer")
    if officer_role
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

  private

  def detach_user_from_database(user_id)
    USER_ROLE_JOIN_TABLES.each do |table|
      next unless table_exists?(table)

      execute("DELETE FROM #{table} WHERE user_id = #{user_id}")
    end

    fallback_user_id = Cats::Core::User.find_by(email: "admin@example.com")&.id

    foreign_key_references.each do |table, column, not_null|
      next if USER_ROLE_JOIN_TABLES.include?(table)

      quoted_table = quote_table_name(table)
      quoted_column = quote_column_name(column)

      if not_null
        if fallback_user_id
          execute(<<~SQL.squish)
            UPDATE #{quoted_table}
            SET #{quoted_column} = #{fallback_user_id}
            WHERE #{quoted_column} = #{user_id}
          SQL
        else
          execute("DELETE FROM #{quoted_table} WHERE #{quoted_column} = #{user_id}")
        end
      else
        execute(<<~SQL.squish)
          UPDATE #{quoted_table}
          SET #{quoted_column} = NULL
          WHERE #{quoted_column} = #{user_id}
        SQL
      end
    end
  end

  def foreign_key_references
    rows = connection.select_all(<<~SQL.squish)
      SELECT
        conrelid::regclass::text AS table_name,
        att.attname AS column_name,
        att.attnotnull AS not_null
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = ANY(con.conkey)
      JOIN pg_class ref ON ref.oid = con.confrelid
      JOIN pg_namespace ns ON ns.oid = con.connamespace
      WHERE con.contype = 'f'
        AND ref.relname = 'cats_core_users'
        AND ns.nspname = 'public'
    SQL

    rows.map do |row|
      table = row["table_name"].to_s.sub(/\Apublic\./, "")
      not_null = row["not_null"] == "t" || row["not_null"] == true
      [table, row["column_name"], not_null]
    end
  end
end
