# Ensure notification rules exist (e.g. after fresh DB or when cats_core expects authorization rules).
# Run: bundle exec rails notification_rules:ensure_dispatch_authorization
#       bundle exec rails notification_rules:ensure_receipt_authorization
# Or with Docker: docker compose exec app bundle exec rails notification_rules:ensure_receipt_authorization
namespace :notification_rules do
  desc 'Create dispatch_authorization notification rule if missing (fixes Dispatch Authorization create error)'
  task ensure_dispatch_authorization: :environment do
    rule = Cats::Core::NotificationRule.find_or_initialize_by(code: 'dispatch_authorization')
    rule.roles = %w[store_keeper hub_manager hub_and_dispatch_officer hub_and_dispatch_approver dispatcher]
    if rule.new_record? || rule.changed?
      rule.save!
      puts "Created/updated notification rule: dispatch_authorization (roles: #{rule.roles.join(', ')})"
    else
      puts "Notification rule 'dispatch_authorization' already exists."
    end
  end

  desc 'Create receipt_authorization notification rule if missing (fixes Receipt Authorization create error)'
  task ensure_receipt_authorization: :environment do
    rule = Cats::Core::NotificationRule.find_or_initialize_by(code: 'receipt_authorization')
    rule.roles = %w[store_keeper hub_manager hub_and_dispatch_officer hub_and_dispatch_approver]
    if rule.new_record? || rule.changed?
      rule.save!
      puts "Created/updated notification rule: receipt_authorization (roles: #{rule.roles.join(', ')})"
    else
      puts "Notification rule 'receipt_authorization' already exists."
    end
  end
end
