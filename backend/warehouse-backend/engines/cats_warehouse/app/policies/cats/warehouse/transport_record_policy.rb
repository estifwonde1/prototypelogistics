# frozen_string_literal: true

module Cats
  module Warehouse
    class TransportRecordPolicy < ApplicationPolicy
      def create?
        admin? || warehouse_manager? || hub_manager?
      end

      def update?
        create?
      end
    end
  end
end
