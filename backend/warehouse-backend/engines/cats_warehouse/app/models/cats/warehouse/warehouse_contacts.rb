module Cats
  module Warehouse
    class WarehouseContacts < ApplicationRecord
      self.table_name = "cats_warehouse_warehouse_contacts"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"

      validates :manager_name, presence: true
      validates :contact_email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
    end
  end
end
