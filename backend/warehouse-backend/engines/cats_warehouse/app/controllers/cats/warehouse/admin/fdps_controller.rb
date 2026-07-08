module Cats
  module Warehouse
    module Admin
      class FdpsController < BaseController
        def index
          fdps = Fdp.includes(:location).order(:name)
          fdps = fdps.where("location_name ILIKE ?", "%#{params[:location]}%") if params[:location].present?
          render_resource(fdps, each_serializer: FdpSerializer)
        end

        def show
          fdp = Fdp.includes(:location).find(params[:id])
          render_resource(fdp, serializer: FdpSerializer)
        end

        def create
          fdp = Fdp.new(fdp_params)
          if fdp.save
            render_resource(fdp, serializer: FdpSerializer, status: :created)
          else
            render_error(fdp.errors.full_messages.to_sentence, status: :unprocessable_entity)
          end
        end

        def update
          fdp = Fdp.find(params[:id])
          if fdp.update(fdp_params)
            render_resource(fdp, serializer: FdpSerializer)
          else
            render_error(fdp.errors.full_messages.to_sentence, status: :unprocessable_entity)
          end
        end

        def destroy
          fdp = Fdp.find(params[:id])
          fdp.destroy!
          render_success(id: fdp.id)
        end

        private

        def fdp_params
          params.require(:payload).permit(
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
end
