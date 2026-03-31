# Ensure CommodityCategory responds to commodity_name (used by cats_core Commodity#name and
# DispatchPlanItem serializer). Engine models are often lazy-loaded, so we trigger autoload
# in to_prepare before patching.
def apply_commodity_category_commodity_name_patch
  return unless defined?(Cats::Core::CommodityCategory)
  Cats::Core::CommodityCategory.class_eval do
    def commodity_name
      respond_to?(:name) ? name : to_s
    end
  end
end

Rails.application.config.after_initialize { apply_commodity_category_commodity_name_patch }

Rails.application.config.to_prepare do
  # Trigger autoload of engine model so the constant exists when we patch (avoids
  # patch being skipped when CommodityCategory is not yet loaded at boot, e.g. in Docker).
  Cats::Core::CommodityCategory if defined?(Cats::Core)
  apply_commodity_category_commodity_name_patch
end
