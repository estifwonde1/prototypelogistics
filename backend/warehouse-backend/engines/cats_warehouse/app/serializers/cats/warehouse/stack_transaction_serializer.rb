module Cats
  module Warehouse
    class StackTransactionSerializer < ApplicationSerializer
      attributes :id, :source_id, :destination_id, :transaction_date, :quantity, :unit_id, :status, :created_at, :updated_at

      attribute :source_stack_code do |obj|
        obj.source&.code
      end

      attribute :destination_stack_code do |obj|
        obj.destination&.code
      end

      attribute :source_store_id do |obj|
        obj.source&.store_id
      end

      attribute :destination_store_id do |obj|
        obj.destination&.store_id
      end
    end
  end
end
