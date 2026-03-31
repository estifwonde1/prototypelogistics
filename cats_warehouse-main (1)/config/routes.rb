Rails.application.routes.draw do
  mount Cats::Core::Engine => "/cats_core", as: 'cats_core'

  resources :menus, only: [:index]
  resources :locations, only: %i[show index create update] do
    member do
      get 'children'
    end
  end

  resources :hubs

  resources :warehouses

  resources :stacking_rules

  resources :receipt_transactions, except: %i[new edit destroy]

  get(
    '/dispatch_plan_items/:id/hub_authorizations',
    controller: :hub_authorizations,
    action: :index,
    as: :hub_authorization_plans
  )
  
  post '/hub_authorizations/filter', controller: :hub_authorizations, action: :filter
  resources :hub_authorizations, except: %i[index destroy]

  post '/printables/hub_authorization', controller: :printables, action: :hub_authorization
  post '/printables/issue_receipt', controller: :printables, action: :issue_receipt
  post '/printables/receiving_receipt', controller: :printables, action: :receiving_receipt
  get '/transporters/winner_transporters', controller: :transporters, action: :winner_transporters,
       as: 'winner_transporters'
  
  # Add DELETE route for dispatch_plan_items (proxies to cats_core engine)
  delete '/cats_core/dispatch_plan_items/:id', to: 'cats_core/dispatch_plan_items#destroy', as: 'delete_dispatch_plan_item'
end
