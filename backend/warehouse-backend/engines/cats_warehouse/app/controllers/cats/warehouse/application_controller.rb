module Cats
  module Warehouse
    class ApplicationController < ActionController::API
      include Pundit::Authorization
    end
  end
end
