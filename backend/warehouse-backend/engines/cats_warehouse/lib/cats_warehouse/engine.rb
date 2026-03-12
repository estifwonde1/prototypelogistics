module Cats
  module Warehouse
    class Engine < ::Rails::Engine
      isolate_namespace Cats::Warehouse
    end
  end
end
