module CatsCore
  class DispatchPlanItemsController < ApplicationController
    def destroy
      dispatch_plan_item = Cats::Core::DispatchPlanItem.find(params[:id])
      
      if dispatch_plan_item.destroy
        render json: { message: 'Dispatch plan item deleted successfully' }, status: :ok
      else
        render json: { error: 'Failed to delete dispatch plan item', details: dispatch_plan_item.errors.full_messages }, status: :unprocessable_entity
      end
    rescue ActiveRecord::RecordNotFound
      render json: { error: 'Dispatch plan item not found' }, status: :not_found
    rescue StandardError => e
      render json: { error: 'An error occurred while deleting the dispatch plan item', details: e.message }, status: :internal_server_error
    end
  end
end
