module Cats
  module Warehouse
    class DispatchOrderAuthorizationStore < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_order_authorization_stores"

      belongs_to :dispatch_order_authorization,
                 class_name: "Cats::Warehouse::DispatchOrderAuthorization",
                 foreign_key: :dispatch_order_authorization_id
      belongs_to :store,     class_name: "Cats::Warehouse::Store"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"

      validates :authorized_quantity, presence: true, numericality: { greater_than: 0 }
    end
  end
end
