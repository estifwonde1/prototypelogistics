# frozen_string_literal: true

module Cats
  module Warehouse
    class InsufficientStockError < StandardError
      attr_reader :details

      def initialize(message = "Insufficient stock for one or more source allocations", details: nil)
        super(message)
        @details = details
      end
    end
  end
end
