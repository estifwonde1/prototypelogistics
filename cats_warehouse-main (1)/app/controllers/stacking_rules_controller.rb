class StackingRulesController < ApplicationController
  include Common

  private

  def model_params
    params.require('payload').permit(:distance_from_wall, :space_between_stack, :distance_from_ceiling,
                                     :maximum_height, :maximum_width, :maximum_length, :distance_from_gangway)
  end
end
