# frozen_string_literal: true

class RepositionOutOfBoundsStacks < ActiveRecord::Migration[7.0]
  def up
    return unless defined?(Cats::Warehouse::StackFloorRepositioner)

    count = Cats::Warehouse::StackFloorRepositioner.fix_all!
    say "Repositioned #{count} stack(s) onto their store floor"
  end

  def down
    # Layout correction — not reversed.
  end
end
