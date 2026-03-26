module Cats
  module Warehouse
    module WarehouseModule
      PREFIX = "CATS-WH".freeze

      def self.record
        Cats::Core::ApplicationModule.find_by!(prefix: PREFIX)
      end
    end
  end
end
