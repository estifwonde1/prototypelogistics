# Close RAs where all GRNs are confirmed but RA is still active
Cats::Warehouse::ReceiptAuthorization.where(status: "active").find_each do |ra|
  grns = Cats::Warehouse::Grn.where(receipt_authorization_id: ra.id)
  next if grns.empty?
  all_confirmed = grns.all? { |g| g.status.to_s.downcase == "confirmed" }
  if all_confirmed
    ra.update_columns(status: "closed")
    puts "Closed RA #{ra.reference_no} (id: #{ra.id})"
    
    # Check if all RAs for the order are now closed
    order = ra.receipt_order
    active_ras = order.receipt_authorizations.not_cancelled
    if active_ras.all?(&:closed?)
      order.update_columns(status: "completed")
      puts "Completed Receipt Order #{order.reference_no} (id: #{order.id})"
    end
  else
    puts "RA #{ra.reference_no} has unconfirmed GRNs - skipping"
  end
end
puts "Done."
