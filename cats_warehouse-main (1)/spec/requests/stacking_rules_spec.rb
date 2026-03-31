RSpec.describe 'StackingRule', type: :request do
  include_examples('request_shared_spec', 'stacking_rules', :stacking_rule, 8, false)

  let(:valid_attributes) do
    {
      distance_from_wall: 1,
      space_between_stack: 1,
      distance_from_ceiling: 1,
      maximum_height: 2.5,
      maximum_width: 6,
      maximum_length: 6,
      distance_from_gangway: 4
    }
  end

  let(:invalid_attributes) do
    {
      distance_from_wall: nil,
      space_between_stack: 1,
      distance_from_ceiling: 1,
      maximum_height: 2.5,
      maximum_width: 6,
      maximum_length: 6,
      distance_from_gangway: 4
    }
  end

  let(:new_attributes) do
    {
      distance_from_wall: 2,
      space_between_stack: 2
    }
  end

  describe 'GET /index' do
    it 'gets stacking rule from database' do
      create(:stacking_rule)
      get(
        stacking_rules_url,
        headers: { Authorization: "Bearer #{token}" },
        as: :json
      )

      result = JSON(response.body)
      expect(result['data'].count).to eq 1
    end
  end
end
