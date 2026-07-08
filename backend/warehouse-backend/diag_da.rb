require_relative "config/environment"
Cats::Warehouse::DispatchOrderAuthorization.reset_column_information

puts "=== Existing DAs ==="
Cats::Warehouse::DispatchOrderAuthorization.all.each do |da|
  puts "DA #{da.id}: dispatch_order_id=#{da.dispatch_order_id} status=#{da.status}"
  puts "  authorized_quantity=#{da.authorized_quantity}"
  puts "  authorized_quantity_input=#{da.authorized_quantity_input.inspect}"
  puts "  authorized_quantity_input_unit_id=#{da.authorized_quantity_input_unit_id.inspect}"
end

puts "\n=== Dispatch Order quantity check ==="
Cats::Warehouse::DispatchOrder.where.not(status: "Draft").each do |o|
  lines_qty = o.dispatch_order_lines.sum { |l| l.quantity.to_f }
  confirmed_da_qty = Cats::Warehouse::DispatchOrderAuthorization
    .where(dispatch_order_id: o.id, status: "confirmed")
    .sum(:authorized_quantity).to_f
  puts "DO #{o.id} #{o.reference_no}: lines_total=#{lines_qty} confirmed_da_total=#{confirmed_da_qty} remaining=#{[lines_qty - confirmed_da_qty, 0].max}"
end
