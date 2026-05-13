ra = Cats::Warehouse::ReceiptAuthorization.find_by(reference_no: "RA-AA6DE598")
if ra
  puts "RA status: #{ra.status}"
  grns = Cats::Warehouse::Grn.where(receipt_authorization_id: ra.id)
  puts "GRNs: #{grns.map { |g| "#{g.reference_no} => #{g.status}" }.join(", ")}"

  # Delete stale draft GRNs (from failed test attempts) — keep only confirmed ones
  draft_grns = grns.select { |g| g.status.to_s.downcase == "draft" }
  draft_grns.each do |g|
    puts "Deleting stale draft GRN: #{g.reference_no}"
    g.grn_items.destroy_all
    g.destroy!
  end

  # Now check again
  remaining_grns = Cats::Warehouse::Grn.where(receipt_authorization_id: ra.id)
  all_confirmed = remaining_grns.all? { |g| g.status.to_s.downcase == "confirmed" }
  puts "All GRNs confirmed after cleanup: #{all_confirmed}"

  if ra.active? && all_confirmed
    ra.update!(status: "closed")
    puts "RA closed successfully"
  end
else
  puts "RA not found"
end
