class StackingRuleSerializer < ActiveModel::Serializer
  attributes :id, :distance_from_wall, :space_between_stack, :distance_from_ceiling, :maximum_height, :maximum_width,
             :maximum_length, :distance_from_gangway
end
