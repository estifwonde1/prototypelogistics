RSpec.describe 'HubAuthorizations', type: :request do
  include_examples('request_shared_spec', 'hub_authorizations', :hub_authorization, 11, false)

  let(:valid_attributes) do
    {
      quantity: 100,
      authorization_type: Cats::Core::HubAuthorization::SOURCE,
      authorized_by_id: create(:user).id,
      dispatch_plan_item_id: create(:dispatch_plan_item).id,
      store_id: create(:store).id
    }
  end

  let(:invalid_attributes) do
    {
      quantity: nil,
      authorization_type: Cats::Core::HubAuthorization::SOURCE,
      authorized_by_id: create(:user).id,
      dispatch_plan_item_id: create(:dispatch_plan_item).id,
      store_id: create(:store).id
    }
  end

  let(:new_attributes) do
    {
      quantity: 50
    }
  end

  describe 'GET /dispatch_plan_item/:id/hub_authorizations' do
    it 'gets all hub authorizations for dispatch plan item' do
      item1 = create(:dispatch_plan_item, quantity: 1000)
      item2 = create(:dispatch_plan_item, quantity: 1000)
      2.times do
        create(
          :hub_authorization,
          dispatch_plan_item: item1,
          authorization_type: Cats::Core::HubAuthorization::SOURCE,
          quantity: 500
        )
      end
      create(
        :hub_authorization,
        dispatch_plan_item: item1,
        authorization_type: Cats::Core::HubAuthorization::DESTINATION,
        quantity: 600
      )
      2.times do
        create(
          :hub_authorization,
          dispatch_plan_item: item2,
          authorization_type: Cats::Core::HubAuthorization::SOURCE,
          quantity: 500
        )
      end

      expect(Cats::Core::HubAuthorization.where(dispatch_plan_item_id: [item1.id, item2.id]).count).to eq 5
      get(
        hub_authorization_plans_url(item1),
        headers: { Authorization: "Bearer #{token}" },
        as: :json
      )

      result = JSON(response.body)
      expect(result['data'].count).to eq 3
    end
  end

  describe 'POST /hub_authorizations/filter' do
    it 'filters hub authorizations by various attributes' do
      user = create(:user)
      item1 = create(:dispatch_plan_item)
      item2 = create(:dispatch_plan_item)

      2.times do
        create(
          :hub_authorization,
          authorization_type: Cats::Core::HubAuthorization::SOURCE,
          dispatch_plan_item_id: item1.id,
          authorized_by_id: user.id,
          quantity: 50,
          unit_id: item1.unit_id
        )
      end
      create(
        :hub_authorization,
        authorization_type: Cats::Core::HubAuthorization::DESTINATION,
        dispatch_plan_item_id: item2.id,
        authorized_by_id: user.id,
        unit_id: item2.unit_id
      )
      3.times { create(:hub_authorization) }

      params = {
        q: {
          dispatch_plan_item_id_eq: item1.id,
          authorization_type_eq: Cats::Core::HubAuthorization::SOURCE
        }
      }
      post(
        hub_authorizations_filter_url,
        params: params,
        headers: { Authorization: "Bearer #{token}" },
        as: :json
      )

      result = JSON(response.body)
      expect(result['success']).to be_truthy
      expect(result['data'].count).to eq 2
    end
  end
end
