Cats::Warehouse::Engine.routes.draw do
  scope :v1 do
    resources :hubs, only: [ :index, :show, :create, :update, :destroy ]
    resources :warehouses, only: [ :index, :show, :create, :update, :destroy ]
    resources :stores, only: [ :index, :show, :create, :update, :destroy ]
    resources :stacks, only: [ :index, :show, :create, :update, :destroy ]

    resources :grns, only: [ :index, :show, :create ] do
      post :confirm, on: :member
    end
    resources :gins, only: [ :index, :show, :create ] do
      post :confirm, on: :member
    end
    resources :inspections, only: [ :index, :show, :create ] do
      post :confirm, on: :member
    end
    resources :waybills, only: [ :index, :show, :create ] do
      post :confirm, on: :member
    end
  end
end
