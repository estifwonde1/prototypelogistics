# frozen_string_literal: true

module Cats
  module Warehouse
    module RequiresEstablishedCapacity
      extend ActiveSupport::Concern

      class_methods do
        def requires_warehouse_capacity_established(warehouse_association: :warehouse)
          validate do
            wh = if warehouse_association.is_a?(Proc)
                   instance_exec(&warehouse_association)
                 else
                   send(warehouse_association)
                 end
            next if wh.blank?
            next if wh.capacity_established?

            errors.add(:base, "Warehouse capacity must be established before this operation")
          end
        end
      end
    end
  end
end
