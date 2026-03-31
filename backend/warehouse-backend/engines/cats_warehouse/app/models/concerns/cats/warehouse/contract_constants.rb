module Cats
  module Warehouse
    module ContractConstants
      DOCUMENT_STATUSES = {
        draft: "Draft",
        confirmed: "Confirmed"
      }.freeze

      ROLE_NAMES = [
        "Admin",
        "Superadmin",
        "Hub Manager",
        "Warehouse Manager",
        "Storekeeper",
        "Inspector",
        "Dispatcher",
        "Officer"
      ].freeze
    end
  end
end
