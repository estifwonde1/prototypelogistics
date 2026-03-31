# Override cats_core Commodity#name so it never calls commodity_name on a source that
# doesn't respond (e.g. CommodityCategory before patch, or Donor). Avoids NoMethodError
# in DispatchPlanItemsController#index / #filter when serializing.
def apply_commodity_name_patch
  return unless defined?(Cats::Core::Commodity)
  Cats::Core::Commodity.class_eval do
    def name
      source = project&.source
      return description if description.present?
      return source.public_send(:commodity_name) if source.respond_to?(:commodity_name)
      return source.name if source.respond_to?(:name)

      batch_no.to_s
    end
  end
end

Rails.application.config.after_initialize { apply_commodity_name_patch }

Rails.application.config.to_prepare do
  # Ensure engine Commodity is loaded so our override is applied (same lazy-load concern as CommodityCategory).
  Cats::Core::Commodity if defined?(Cats::Core)
  apply_commodity_name_patch
end
