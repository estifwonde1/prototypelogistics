# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationStoreSerializer < ApplicationSerializer
      attributes :id, :store_id, :commodity_id, :authorized_quantity, :base_quantity,
                 :dispatched_quantity, :remaining_quantity, :store_name, :commodity_name

      def store_name
        object.store&.name
      end

      def commodity_name
        commodity = object.commodity
        return unless commodity

        commodity.read_attribute(:name).presence || commodity.batch_no
      end
    end
  end
end
