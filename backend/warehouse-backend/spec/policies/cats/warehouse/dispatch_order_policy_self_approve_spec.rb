# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::DispatchOrderPolicy, type: :policy do
  let(:officer) { create(:cats_core_user, role_name: "Federal Officer") }
  let(:other_officer) { create(:cats_core_user, role_name: "Federal Officer") }
  let(:order) do
    Cats::Warehouse::DispatchOrder.create!(
      dispatch_reference: "PLAN-#{SecureRandom.hex(3)}",
      created_by: officer,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:draft]
    )
  end

  it "allows self_approve for creator on v2 draft order" do
    expect(described_class.new(officer, order).self_approve?).to be(true)
  end

  it "denies self_approve for non-creator" do
    expect(described_class.new(other_officer, order).self_approve?).to be(false)
  end
end
