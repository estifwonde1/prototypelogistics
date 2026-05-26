# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::PackagingReconciliationJob, type: :service do
  it "returns an array (empty when no packaging rows)" do
    result = described_class.new.perform(since: 1.day.ago)
    expect(result).to be_an(Array)
  end
end
