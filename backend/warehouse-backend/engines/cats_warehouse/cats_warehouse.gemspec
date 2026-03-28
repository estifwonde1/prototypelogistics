require_relative "lib/cats_warehouse/version"

Gem::Specification.new do |spec|
  spec.name        = "cats_warehouse"
  spec.version     = Cats::Warehouse::VERSION
  spec.authors     = [ "CATS Team" ]
  spec.email       = [ "dev@cats.local" ]
  spec.homepage    = "https://github.com/cats/warehouse"
  spec.summary     = "CATS Warehouse engine."
  spec.description = "Warehouse domain engine for CATS."

  # Prevent pushing this gem to RubyGems.org. To allow pushes either set the "allowed_push_host"
  # to allow pushing to a single host or delete this section to allow pushing to any host.
  spec.metadata["allowed_push_host"] = "https://rubygems.org"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = "https://github.com/cats/warehouse"
  spec.metadata["changelog_uri"] = "https://github.com/cats/warehouse/CHANGELOG.md"

  spec.files = Dir.chdir(File.expand_path(__dir__)) do
    Dir["{app,config,db,lib}/**/*", "MIT-LICENSE", "Rakefile", "README.md"]
  end

  spec.add_dependency "rails", ">= 7.0.10"
end
