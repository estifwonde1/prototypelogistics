module Cats
  module Warehouse
    # Persisted row in `cats_core_notifications` (one row per recipient user).
    # The table column `type` stores the machine event name (not Rails STI).
    class InAppNotification < ApplicationRecord
      self.table_name = "cats_core_notifications"
      self.inheritance_column = nil

      belongs_to :recipient, polymorphic: true

      validates :recipient, presence: true
      validates :type, presence: true
      validates :params, presence: true

      scope :unread, -> { where(read_at: nil) }

      def mark_read!
        update!(read_at: Time.current)
      end
    end
  end
end
