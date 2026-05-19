# frozen_string_literal: true

module Cats
  module Warehouse
    # Removes demo/seed stacks (e.g. ADD-WH-01-ST1-S1) while keeping user-created stacks.
    class SeedStackCleanup
      STACK_DEPENDENT_TABLES = [
        ["cats_warehouse_gin_items", "stack_id = %{id}"],
        ["cats_warehouse_grn_items", "stack_id = %{id}"],
        ["cats_warehouse_stock_balances", "stack_id = %{id}"],
        ["cats_warehouse_inventory_adjustments", "stack_id = %{id}"],
        ["cats_warehouse_stack_reservations", "stack_id = %{id}"],
        ["cats_warehouse_stack_transactions", "destination_id = %{id} OR source_id = %{id}"],
        ["cats_warehouse_stock_reservations", "stack_id = %{id}"],
        ["cats_warehouse_transfer_requests", "source_stack_id = %{id} OR destination_stack_id = %{id}"]
      ].freeze

      class << self
        def legacy_seed_stack?(stack)
          code = stack.code.to_s.strip
          return true if code.match?(/\ASEED-/i)

          store = stack.store
          return false if store.blank?

          store_code = store.code.to_s
          return true if store_code.match?(/\AADD-WH-\d+-ST\d+\z/i) &&
                         code.match?(/\A#{Regexp.escape(store_code)}-S\d+\z/i)

          false
        end

        def destroy_legacy_seed_stacks!(scope: Stack.all)
          removed = 0
          scope.includes(:store).find_each do |stack|
            next unless legacy_seed_stack?(stack)

            destroy_stack_with_dependents!(stack)
            removed += 1
            Rails.logger.info("[SeedStackCleanup] Removed legacy stack #{stack.code} (id=#{stack.id})")
          end
          removed
        end

        private

        def destroy_stack_with_dependents!(stack)
          sid = stack.id
          conn = ActiveRecord::Base.connection
          STACK_DEPENDENT_TABLES.each do |table, condition_template|
            next unless conn.data_source_exists?(table)

            condition = format(condition_template, id: sid)
            conn.execute("DELETE FROM #{table} WHERE #{condition}")
          rescue ActiveRecord::StatementInvalid => e
            raise unless e.message.include?("does not exist")

            Rails.logger.warn("[SeedStackCleanup] Skipped #{table}: #{e.message}")
          end
          stack.destroy!
        end
      end
    end
  end
end
