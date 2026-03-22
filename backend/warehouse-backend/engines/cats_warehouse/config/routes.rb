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

    resources :geos, only: [ :create, :update ]

    resources :hubs, only: [ :index, :show, :create, :update, :destroy ] do
      resource :capacity, only: [ :show ], controller: "hub_capacities"
      resource :access, only: [ :show, :create, :update ], controller: "hub_accesses"
      resource :contacts, only: [ :show ], controller: "hub_contacts"
    end
    resources :warehouses, only: [ :index, :show, :create, :update, :destroy ] do
      resource :capacity, only: [ :show, :create, :update ], controller: "warehouse_capacities"
      resource :access, only: [ :show, :create, :update ], controller: "warehouse_accesses"
      resource :infra, only: [ :show, :create, :update ], controller: "warehouse_infras"
      resource :contacts, only: [ :show, :create, :update ], controller: "warehouse_contacts"
    end
    resources :stores, only: [ :index, :show, :create, :update, :destroy ]
    resources :stacks, only: [ :index, :show, :create, :update, :destroy ]
    resources :stock_balances, only: [ :index, :show ]
    resources :receipts, only: [ :index, :show ]
    resources :dispatches, only: [ :index, :show ]

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

    get "reports/bin_card", to: "reports#bin_card"
  end
end
