class AddQaAndReceiptAuthorizerRoles < ActiveRecord::Migration[7.0]
  NEW_ROLES = ["Quality Assurance", "Receipt Authorizer"].freeze

  def up
    # Find the warehouse application module
    warehouse_module = execute(
      "SELECT id FROM cats_core_application_modules WHERE name = 'Warehouse' LIMIT 1"
    ).first

    return unless warehouse_module

    module_id = warehouse_module["id"]

    NEW_ROLES.each do |role_name|
      exists = execute(
        "SELECT 1 FROM cats_core_roles WHERE name = #{ActiveRecord::Base.connection.quote(role_name)} AND application_module_id = #{module_id} LIMIT 1"
      ).any?

      unless exists
        execute(
          "INSERT INTO cats_core_roles (name, application_module_id, created_at, updated_at) VALUES (#{ActiveRecord::Base.connection.quote(role_name)}, #{module_id}, NOW(), NOW())"
        )
      end
    end
  end

  def down
    warehouse_module = execute(
      "SELECT id FROM cats_core_application_modules WHERE name = 'Warehouse' LIMIT 1"
    ).first

    return unless warehouse_module

    module_id = warehouse_module["id"]

    NEW_ROLES.each do |role_name|
      execute(
        "DELETE FROM cats_core_roles WHERE name = #{ActiveRecord::Base.connection.quote(role_name)} AND application_module_id = #{module_id}"
      )
    end
  end
end
