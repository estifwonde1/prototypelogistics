require "securerandom"

Rails.application.config.after_initialize do
  Cats::Core::DispatchPlanItem.class_eval do
    before_validation :ensure_seed_and_ui_compat_defaults

    private

    def ensure_seed_and_ui_compat_defaults
      self.unit_id ||= commodity&.unit_of_measure_id
      self.reference_no ||= "DPI-AUTO-#{Time.now.to_i}-#{SecureRandom.hex(3)}"
    end
  end
end
