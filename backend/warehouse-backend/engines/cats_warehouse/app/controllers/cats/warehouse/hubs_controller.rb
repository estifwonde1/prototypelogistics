module Cats
  module Warehouse
    class HubsController < BaseController
      def index
        hubs = Hub.order(:id)
        render_success({ hubs: hubs })
      end

      def show
        hub = Hub.find_by(id: params[:id])
        return render_error("Hub not found", status: :not_found) unless hub

        render_success({ hub: hub })
      end

      def create
        hub = Hub.new(hub_params)

        if hub.save
          render_success({ id: hub.id }, status: :created)
        else
          render_error("Failed to create hub", details: hub.errors.full_messages)
        end
      end

      def update
        hub = Hub.find_by(id: params[:id])
        return render_error("Hub not found", status: :not_found) unless hub

        if hub.update(hub_params)
          render_success({ id: hub.id })
        else
          render_error("Failed to update hub", details: hub.errors.full_messages)
        end
      end

      def destroy
        hub = Hub.find_by(id: params[:id])
        return render_error("Hub not found", status: :not_found) unless hub

        if hub.destroy
          render_success({ id: hub.id })
        else
          render_error("Failed to delete hub", details: hub.errors.full_messages)
        end
      end

      private

      def hub_params
        params.require(:payload).permit(
          :location_id,
          :geo_id,
          :code,
          :name,
          :hub_type,
          :status,
          :description
        )
      end
    end
  end
end
