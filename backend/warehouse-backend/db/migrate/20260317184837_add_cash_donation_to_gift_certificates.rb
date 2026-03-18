class AddCashDonationToGiftCertificates < ActiveRecord::Migration[7.0]
  def change
    add_reference :cats_core_gift_certificates, :cash_donation,
                  null: true,
                  foreign_key: { to_table: :cats_core_cash_donations }  # correct table name
  end
end