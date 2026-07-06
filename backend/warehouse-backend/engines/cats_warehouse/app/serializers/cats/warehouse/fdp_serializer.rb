module Cats
  module Warehouse
    class FdpSerializer < ApplicationSerializer
      attributes :id, :name, :location_id, :location_name, :location_type, :number_of_families,
                 :number_of_beneficiaries, :created_at, :updated_at

      def location_name
        object.location_name.presence || object.location&.name
      end

      def location_type
        object.location&.location_type
      end
    end
  end
end
