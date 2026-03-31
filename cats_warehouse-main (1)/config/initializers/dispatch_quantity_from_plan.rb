# Ensure dispatches used for receipt authorization always have a positive quantity
# so "Quantity exceeds dispatch quantity. Maximum allowed is 0.0 MT" never occurs.
# When dispatch.quantity is 0, set it from the associated dispatch_plan_item so hub can authorize immediately.
Rails.application.config.after_initialize do
  Cats::Core::Dispatch.class_eval do
    after_find :ensure_dispatch_quantity_from_plan

    private

    def ensure_dispatch_quantity_from_plan
      return if quantity.to_f.positive?
      return unless dispatch_plan_item_id.present?

      dpi = Cats::Core::DispatchPlanItem.find_by(id: dispatch_plan_item_id)
      return unless dpi&.quantity.to_f.positive?

      update_columns(
        quantity: dpi.quantity.to_f,
        unit_id: dpi.unit_id
      )
    end
  end
end
