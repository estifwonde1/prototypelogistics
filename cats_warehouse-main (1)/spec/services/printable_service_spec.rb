RSpec.describe PrintableService do
  let(:service) { described_class.new }

  describe '#hub_authorization' do
    it 'generates data for hub authorization report' do
      item = create(:dispatch_plan_item)
      data = service.hub_authorization(item.id)

      expect(data.count).to eq 8
      expect(data[:commodities][0].count).to eq 6
    end
  end

  describe '#issue_receipt' do
    it 'generates data for issue receipt' do
      woreda = create(:woreda)
      round_plan = create(:round_plan)
      3.times { create(:round_plan_item, round_plan: round_plan) }
      round_plan.approve
      dispatch_plan = create(:dispatch_plan, dispatchable: round_plan)
      item = create(:dispatch_plan_item, :with_authorization, destination: woreda, dispatch_plan: dispatch_plan)
      dispatch_plan.approve
      dispatch = create(:dispatch, dispatch_plan_item: item)
      authorization = create(:dispatch_authorization, dispatch: dispatch)
      user = create(:user)
      data = service.issue_receipt(authorization.id, user)

      expect(data.count).to eq 14
      expect(data[:commodities][0].count).to eq 5
    end
  end

  describe '#receiving_receipt' do
    it 'generates data for issue receipt' do
      authorization = create(:receipt_authorization)
      user = create(:user)
      data = service.receiving_receipt(authorization.id, user)

      expect(data.count).to eq 11
      expect(data[:commodities][0].count).to eq 6
    end
  end
end
