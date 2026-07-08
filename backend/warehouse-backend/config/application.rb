require_relative "boot"

require "rails/all"

# --- EMERGENCY SHIM FOR CATS_CORE COMPATIBILITY ---
# This fixes the NoMethodError: undefined method 'attributes_for_inspect='
# It must be defined BEFORE Bundler.require loads the cats_core gem.
require "active_record"
unless ActiveRecord::Base.respond_to?(:attributes_for_inspect=)
  ActiveRecord::Base.class_eval do
    def self.attributes_for_inspect=(*)
      # This is a stub to prevent the boot crash in Rails 7+
    end
  end
end
# --- END SHIM ---

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module WarehouseBackend
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 7.0

    # Rails 7 doesn't have config.autoload_lib.
    # Custom logic to autoload the lib directory.
    lib_path = Rails.root.join("lib")
    config.autoload_paths << lib_path
    config.eager_load_paths << lib_path

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    
    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true
  end
end