module Cats
  module Warehouse
    class GeosController < BaseController
      def create
        authorize Geo
        geo = Geo.create!(geo_params)
        render_resource(geo, status: :created, serializer: GeoSerializer)
      end

      def update
        geo = Geo.find(params[:id])
        authorize geo
        geo.update!(geo_params)
        render_resource(geo, serializer: GeoSerializer)
      end

      private

      def geo_params
        params.require(:payload).permit(:latitude, :longitude, :altitude_m, :address)
      end
    end
  end
end
