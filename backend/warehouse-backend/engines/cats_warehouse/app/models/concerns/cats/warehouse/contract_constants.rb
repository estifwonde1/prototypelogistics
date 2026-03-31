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
        "Dispatch Planner",
        "Hub Dispatch Officer",
        "Hub Dispatch Approver"
      ].freeze
    end
  end
end
