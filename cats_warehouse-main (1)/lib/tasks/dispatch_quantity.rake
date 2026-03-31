# Fix "Quantity exceeds dispatch quantity. Maximum allowed is 0.0 MT" by ensuring
# Started dispatches have positive quantity and optionally resetting receipt authorizations.
# Run: docker compose exec app bundle exec rails dispatch_quantity:fix
namespace :dispatch_quantity do
  desc 'Set Started dispatches to positive quantity (20 MT) and optionally clear receipt authorizations'
  task fix: :environment do
    mt = Cats::Core::UnitOfMeasure.find_by(abbreviation: 'MT')
    unless mt
      puts 'Unit MT not found. Run seeds first.'
      next
    end

    started = Cats::Core::Dispatch.where(dispatch_status: 'Started')
    if started.empty?
      puts 'No Started dispatches found.'
      next
    end

    updated = 0
    started.each do |d|
      # If dispatch quantity is 0 or nil, set to 20 MT so receipt authorization can proceed
      if d.quantity.to_f <= 0
        d.update!(quantity: 20.0, unit_id: mt.id)
        updated += 1
        puts "Dispatch #{d.reference_no} (id=#{d.id}): quantity set to 20 MT"
      end

      # Optional: remove receipt authorizations so "remaining" = full dispatch quantity
      ra_sum = Cats::Core::ReceiptAuthorization.where(dispatch_id: d.id).sum(:quantity)
      if ra_sum.to_f >= d.quantity.to_f && d.quantity.to_f > 0
        Cats::Core::ReceiptAuthorization.where(dispatch_id: d.id).destroy_all
        puts "Dispatch #{d.reference_no}: receipt authorizations cleared so you can re-authorize."
      end
    end

    puts "Updated #{updated} dispatch quantity. You can now authorize receipt (max = dispatch quantity)."
  end
end
