class HubAuthorizationsController < ApplicationController
  include Common

  def index
    data = Cats::Core::HubAuthorization.where(dispatch_plan_item_id: params[:id])
    render json: { success: true, data: serialize(data) }
  end

  def filter
    query = Cats::Core::HubAuthorization.ransack(params[:q])
    render json: { success: true, data: serialize(query.result) }
  end

  private

  def model_params
    params.require(:payload).permit(
      :dispatch_plan_item_id, :store_id, :quantity, :authorization_type, :authorized_by_id
    )
  end
end
