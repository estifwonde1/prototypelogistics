module Cats
  module Warehouse
    class Hub < ApplicationRecord
      self.table_name = "cats_warehouse_hubs"

      belongs_to :location, class_name: "Cats::Core::Location"
      belongs_to :geo, class_name: "Cats::Warehouse::Geo", optional: true

      has_one :hub_capacity, class_name: "Cats::Warehouse::HubCapacity", dependent: :destroy
      has_one :hub_access, class_name: "Cats::Warehouse::HubAccess", dependent: :destroy
      has_one :hub_infra, class_name: "Cats::Warehouse::HubInfra", dependent: :destroy
      has_one :hub_contacts, class_name: "Cats::Warehouse::HubContacts", dependent: :destroy

      has_many :warehouses, class_name: "Cats::Warehouse::Warehouse", dependent: :nullify

      validates :name, presence: true

      def assigned_hub_manager
        assignment = UserAssignment.includes(:user)
                                   .where(hub_id: id, role_name: "Hub Manager")
                                   .order(:id)
                                   .first
        assignment&.user
      end

      def live_hub_contact_payload
        user = assigned_hub_manager
        fallback = hub_contacts

        manager_name = [user&.first_name, user&.last_name].compact.join(" ").strip
        manager_name = user&.email if manager_name.blank?

        {
          id: fallback&.id,
          hub_id: id,
          manager_name: manager_name.presence || fallback&.manager_name,
          contact_phone: user&.phone_number.presence || fallback&.contact_phone,
          contact_email: user&.email.presence || fallback&.contact_email
        }
      end
    end
  end
end
