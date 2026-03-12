module Cats
  module Warehouse
    class ApplicationRecord < ActiveRecord::Base
      self.abstract_class = true
    end
  end
end
