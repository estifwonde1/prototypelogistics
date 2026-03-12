Cats::Warehouse::Engine.routes.draw do
  scope :v1 do
    resources :grns, only: [ :create ] do
      post :confirm, on: :member
    end
    resources :gins, only: [ :create ] do
      post :confirm, on: :member
    end
    resources :inspections, only: [ :create ] do
      post :confirm, on: :member
    end
    resources :waybills, only: [ :create ] do
      post :confirm, on: :member
    end
  end
end
