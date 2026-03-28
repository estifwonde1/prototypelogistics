module Cats
  module Warehouse
    class GinSerializer < ApplicationSerializer
      attributes :id, :reference_no, :warehouse_id, :issued_on, :destination_type, :destination_id,
                 :status, :issued_by_id, :approved_by_id, :created_at, :updated_at
      has_many :gin_items, serializer: GinItemSerializer

      def status
        object[:status].to_s.titleize
      end
    end
  end
end
