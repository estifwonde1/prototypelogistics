require_relative "config/environment"

# Test the serializer remaining_quantity calculation
o = Cats::Warehouse::DispatchOrder.find_by(id: 3)
if o
  lines_qty = o.dispatch_order_lines.sum { |l| l.quantity.to_f }
  confirmed = Cats::Warehouse::DispatchOrderAuthorization
    .where(dispatch_order_id: o.id, status: "confirmed")
    .sum(:authorized_quantity).to_f
  puts "DO 3: ordered=#{lines_qty}, confirmed_authorized=#{confirmed}, remaining=#{[lines_qty - confirmed, 0].max}"
  
  # Check what status strings are used
  puts "\nDA statuses: #{Cats::Warehouse::DispatchOrderAuthorization.where(dispatch_order_id: 3).pluck(:status).inspect}"
  puts "CONFIRMED constant: #{Cats::Warehouse::DispatchOrderAuthorization::CONFIRMED.inspect}"
end

# Also check - does the serializer context have access to the constant?
puts "\nChecking constant access in serializer namespace:"
puts Cats::Warehouse::DispatchOrderSerializer.instance_method(:total_authorized_quantity).source_location.inspect rescue "N/A"
