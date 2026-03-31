module Cats
  module Core
    class Store < ApplicationRecord
      self.table_name = "cats_core_stores"
    end
  end
end
