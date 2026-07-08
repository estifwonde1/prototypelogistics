# frozen_string_literal: true

class RemoveLegacySeedStacks < ActiveRecord::Migration[7.0]
  def up
    return unless defined?(Cats::Warehouse::SeedStackCleanup)

    count = Cats::Warehouse::SeedStackCleanup.destroy_legacy_seed_stacks!
    say "Removed #{count} legacy seed stack(s)"
  end

  def down
    # Data migration — removed stacks are not restored.
  end
end
