module Cats
  module Warehouse
    class FdpsController < BaseController
      def index
        authorize Fdp
        fdps = policy_scope(Fdp).includes(:location).order(:name)

        if params[:search].present?
          term = "%#{params[:search].to_s.strip}%"
          fdps = fdps.where(
            "cats_warehouse_fdps.name ILIKE :term OR cats_warehouse_fdps.location_name ILIKE :term",
            term: term
          )
        elsif params[:location].present?
          fdps = fdps.where("location_name ILIKE ?", "%#{params[:location]}%")
        end

        render_resource(fdps, each_serializer: FdpSerializer)
      end

      def show
        fdp = Fdp.includes(:location).find(params[:id])
        authorize fdp
        render_resource(fdp, serializer: FdpSerializer)
      end

      def create
        authorize Fdp
        fdp = Fdp.new(fdp_params)
        if fdp.save
          render_resource(fdp, serializer: FdpSerializer, status: :created)
        else
          render_error(fdp.errors.full_messages.to_sentence, status: :unprocessable_entity)
        end
      end

      def update
        fdp = Fdp.find(params[:id])
        authorize fdp
        if fdp.update(fdp_params)
          render_resource(fdp, serializer: FdpSerializer)
        else
          render_error(fdp.errors.full_messages.to_sentence, status: :unprocessable_entity)
        end
      end

      def destroy
        fdp = Fdp.find(params[:id])
        authorize fdp
        fdp.destroy!
        render_success(id: fdp.id)
      end

      private

      def fdp_params
        payload = params[:payload] || params[:fdp] || params
        payload.permit(
          :name,
          :location_id,
          :location_name,
          :number_of_families,
          :number_of_beneficiaries
        )
      end
    end
  end
end
