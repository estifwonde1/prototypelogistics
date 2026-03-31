application_module = Cats::Core::ApplicationModule.create(
  prefix: 'CATS-WH',
  name: 'Cats Warehouse'
)

Cats::Core::Transporter.where(code: 'SUP-TRANS', name: 'SUP-TRANS', address: 'sup-address',
                              contact_phone: '0912345678').first_or_create
supplier_region = Cats::Core::Location.where(code: 'SUP-Region', name: 'SUP-Region', location_type: 'Region').first_or_create
supplier_zone = Cats::Core::Location.where(code: 'SUP-Zone', name: 'SUP-Zone', location_type: 'Zone',
                                           ancestry: supplier_region).first_or_create
supplier_woreda = Cats::Core::Location.where(code: 'SUP-Woreda', name: 'SUP-Woreda', location_type: 'Woreda',
                                             ancestry: supplier_zone).first_or_create
supplier_hub = Cats::Core::Location.where(code: 'SUP-Hub', name: 'SUP-Hub', location_type: 'Hub',
                                          ancestry: supplier_woreda).first_or_create
supplier_warehouse = Cats::Core::Location.where(
  code: 'SUP-Warehouse', name: 'SUP-Warehouse', location_type: 'Warehouse', ancestry: supplier_hub
).first_or_create
store = Cats::Core::Store.where(code: 'SUP-STORE', name: 'SUP-STORE', length: 200, width: 200, height: 200,
                                warehouse: supplier_warehouse).first_or_create
Cats::Core::User.create(first_name: 'SUP-Storekeeper', last_name: 'SUP-Storekeeper',
                        email: 'supstorekeeper@cats.com', password: '123456',
                        application_module: application_module, details: { stores: [store.id] })
