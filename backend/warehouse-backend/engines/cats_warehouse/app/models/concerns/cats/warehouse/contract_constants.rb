module Cats
  module Warehouse
    module ContractConstants
      DOCUMENT_STATUSES = {
        draft: "draft",
        assigned: "assigned",
        reserved: "reserved",
        in_progress: "in_progress",
        completed: "completed",
        confirmed: "confirmed",
        cancelled: "cancelled"
      }.freeze

      DOCUMENT_STATUS_TRANSITIONS = {
        draft: [ :assigned, :reserved, :in_progress, :confirmed, :cancelled ],
        assigned: [ :reserved, :in_progress, :confirmed, :cancelled ],
        reserved: [ :in_progress, :confirmed, :cancelled ],
        in_progress: [ :completed, :confirmed, :cancelled ],
        confirmed: [ :completed ],
        completed: [],
        cancelled: []
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
