require "rails_helper"

RSpec.describe Cats::Warehouse::VolumeCalculator do
  let(:commodity) { build_stubbed(:cats_core_commodity, volume_per_metric_ton: 1.5) }

  describe ".call" do
    it "returns base_quantity * volume_per_metric_ton" do
      result = described_class.call(commodity: commodity, base_quantity: 10)
      expect(result).to eq(15.0)
    end

    it "uses default 1.25 m³/MT when volume_per_metric_ton is nil" do
      commodity = build_stubbed(:cats_core_commodity, volume_per_metric_ton: nil)
      expect(described_class.call(commodity: commodity, base_quantity: 5)).to eq(6.25)
    end

    it "uses default 1.25 m³/MT when volume_per_metric_ton is 0" do
      commodity = build_stubbed(:cats_core_commodity, volume_per_metric_ton: 0)
      expect(described_class.call(commodity: commodity, base_quantity: 10)).to eq(12.5)
    end

    it "uses default density when commodity is nil" do
      expect(described_class.call(commodity: nil, base_quantity: 10)).to eq(12.5)
    end

    it "returns nil when base_quantity is zero" do
      expect(described_class.call(commodity: commodity, base_quantity: 0)).to be_nil
    end

    it "handles fractional quantities" do
      result = described_class.call(commodity: commodity, base_quantity: 2.5)
      expect(result).to be_within(0.000001).of(3.75)
    end

    it "rounds to 6 decimal places" do
      commodity = build_stubbed(:cats_core_commodity, volume_per_metric_ton: 1.0 / 3.0)
      result = described_class.call(commodity: commodity, base_quantity: 1)
      expect(result.to_s.split(".").last.length).to be <= 6
    end
  end
end
