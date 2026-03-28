module Cats
  module Warehouse
    class GrnSerializer < ApplicationSerializer
      attributes :id, :reference_no, :warehouse_id, :received_on, :source_type, :source_id,
                 :status, :received_by_id, :approved_by_id, :created_at, :updated_at
      has_many :grn_items, serializer: GrnItemSerializer

      def status
        object[:status].to_s.titleize
      end
    end
  end
end
