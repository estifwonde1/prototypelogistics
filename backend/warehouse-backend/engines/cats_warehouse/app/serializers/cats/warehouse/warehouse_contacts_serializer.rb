module Cats
  module Warehouse
    class WarehouseContactsSerializer < ApplicationSerializer
      attributes :id, :warehouse_id, :manager_name, :contact_phone, :contact_email, :created_at, :updated_at
    end
  end
end
