Cats::Warehouse::Engine.routes.draw do
  scope :v1 do
    post "auth/login", to: "auth#login"

    namespace :admin do
      resources :users, only: [ :index, :create, :update, :destroy ]
      resources :roles, only: [ :index ]
      resources :user_assignments, only: [ :index, :create, :destroy ]
      patch "user_assignments/bulk", to: "user_assignments#bulk_update"
    end

    get "locations/regions", to: "locations#regions"
    get "locations/zones", to: "locations#zones"
    get "locations/woredas", to: "locations#woredas"
    get "locations/hubs", to: "locations#hubs"
    get "locations/warehouses", to: "locations#warehouses"
    get "locations/stores", to: "locations#stores"
    post "locations", to: "locations#create"

    resources :hubs, only: [ :index, :show, :create, :update, :destroy ]
    resources :warehouses, only: [ :index, :show, :create, :update, :destroy ]
    resources :stores, only: [ :index, :show, :create, :update, :destroy ]
    resources :stacks, only: [ :index, :show, :create, :update, :destroy ]
    resources :stock_balances, only: [ :index, :show ]

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
