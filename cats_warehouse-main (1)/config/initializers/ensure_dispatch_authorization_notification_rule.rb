# Ensure authorization notification rules exist so that creating Dispatch/Receipt Authorizations
# does not raise "Notification rule not found for ... authorization notification."
# The cats_core gem's AuthorizationService expects these rules when sending notifications after create.
Rails.application.config.after_initialize do
  [
    ['dispatch_authorization', %w[store_keeper hub_manager hub_and_dispatch_officer hub_and_dispatch_approver dispatcher]],
    ['receipt_authorization', %w[store_keeper hub_manager hub_and_dispatch_officer hub_and_dispatch_approver]]
  ].each do |code, default_roles|
    begin
      rule = Cats::Core::NotificationRule.find_or_initialize_by(code: code)
      if rule.new_record?
        rule.roles = default_roles
        rule.save!
        Rails.logger.info "[ensure_authorization_notification_rules] Created notification rule: #{code}"
      end
    rescue StandardError => e
      Rails.logger.warn "[ensure_authorization_notification_rules] Could not ensure rule #{code}: #{e.message}"
    end
  end
end
