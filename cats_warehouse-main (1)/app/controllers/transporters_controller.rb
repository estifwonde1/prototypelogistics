class TransportersController < ApplicationController
  def winner_transporters
    transporter_ids = Cats::Core::TransportOrderItem.where(route_id: params[:route_id],
                                                           status: Cats::Core::TransportOrderItem::ACTIVE)
                                                    .map(&:transporter_id).uniq
    transporters = Cats::Core::Transporter.where(id: transporter_ids)
    render json: { success: true, data: serialize(transporters) }
  end
end
