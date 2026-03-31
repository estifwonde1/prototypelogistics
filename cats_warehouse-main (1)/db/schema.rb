# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.0].define(version: 2023_11_29_071520) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "cats_core_application_modules", force: :cascade do |t|
    t.string "prefix"
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cats_core_application_settings", force: :cascade do |t|
    t.string "key"
    t.string "value", null: false
    t.bigint "application_module_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["application_module_id"], name: "am_on_as_indx"
  end

  create_table "cats_core_beneficiaries", force: :cascade do |t|
    t.string "full_name", null: false
    t.integer "age", null: false
    t.string "gender", null: false
    t.string "phone"
    t.bigint "beneficiary_category_id", null: false
    t.bigint "fdp_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["beneficiary_category_id"], name: "bc_on_beneficiaries_indx"
    t.index ["fdp_id"], name: "fdp_on_beneficiaries_indx"
  end

  create_table "cats_core_beneficiary_categories", force: :cascade do |t|
    t.string "code"
    t.string "name", null: false
    t.bigint "plan_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["plan_id"], name: "plan_on_bc_indx"
  end

  create_table "cats_core_beneficiary_plan_items", force: :cascade do |t|
    t.bigint "plan_item_id", null: false
    t.bigint "beneficiary_category_id", null: false
    t.integer "beneficiaries", null: false
    t.integer "rounds"
    t.integer "rounds_served"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["beneficiary_category_id"], name: "bc_on_bpi_indx"
    t.index ["plan_item_id", "beneficiary_category_id"], name: "pii_on_bci_uniq_indx", unique: true
    t.index ["plan_item_id"], name: "pi_on_bpi_indx"
  end

  create_table "cats_core_beneficiary_round_plan_items", force: :cascade do |t|
    t.bigint "round_plan_item_id", null: false
    t.bigint "beneficiary_category_id", null: false
    t.integer "planned_beneficiaries", null: false
    t.integer "beneficiaries", null: false
    t.integer "beneficiary_plan_item_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["beneficiary_category_id"], name: "bc_on_brpi_indx"
    t.index ["round_plan_item_id", "beneficiary_category_id"], name: "rpii_on_bci_uniq_indx", unique: true
    t.index ["round_plan_item_id"], name: "rpi_on_brpi_indx"
  end

  create_table "cats_core_cash_donations", force: :cascade do |t|
    t.string "reference_no"
    t.string "description"
    t.date "donated_on", null: false
    t.bigint "donor_id", null: false
    t.float "amount", null: false
    t.bigint "currency_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["currency_id"], name: "currency_on_cad_indx"
    t.index ["donor_id"], name: "donor_on_cad_indx"
  end

  create_table "cats_core_commodities", force: :cascade do |t|
    t.string "batch_no"
    t.bigint "unit_of_measure_id", null: false
    t.bigint "project_id", null: false
    t.bigint "package_unit_id"
    t.float "quantity", null: false
    t.string "description"
    t.date "best_use_before", null: false
    t.float "volume_per_metric_ton"
    t.string "arrival_status", default: "At Source", null: false
    t.string "shipping_reference"
    t.string "commodity_grade"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "status", default: "Draft", null: false
    t.index ["package_unit_id"], name: "pu_on_commodity_indx"
    t.index ["project_id"], name: "project_on_commodity_indx"
    t.index ["unit_of_measure_id"], name: "uom_on_commodities_indx"
  end

  create_table "cats_core_commodity_categories", force: :cascade do |t|
    t.string "code"
    t.string "name", null: false
    t.string "description"
    t.string "ancestry"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["ancestry"], name: "index_cats_core_commodity_categories_on_ancestry"
  end

  create_table "cats_core_commodity_donations", force: :cascade do |t|
    t.string "reference_no"
    t.string "description"
    t.string "shipping_reference"
    t.date "donated_on", null: false
    t.bigint "donor_id", null: false
    t.bigint "commodity_category_id", null: false
    t.bigint "plan_id"
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["commodity_category_id"], name: "cc_on_cd_indx"
    t.index ["donor_id"], name: "donor_on_cd_indx"
    t.index ["plan_id"], name: "plan_on_cd_indx"
    t.index ["unit_id"], name: "unit_on_cd_indx"
  end

  create_table "cats_core_commodity_substitutions", force: :cascade do |t|
    t.bigint "program_id", null: false
    t.bigint "commodity_id", null: false
    t.bigint "replaced_by_id", null: false
    t.string "ratio", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["commodity_id"], name: "commodity_on_cs_indx"
    t.index ["program_id", "commodity_id", "replaced_by_id"], name: "pcr_on_cs_indx", unique: true
    t.index ["program_id"], name: "program_on_cs_indx"
    t.index ["replaced_by_id"], name: "rb_on_cs_indx"
  end

  create_table "cats_core_contract_items", force: :cascade do |t|
    t.bigint "transport_contract_id", null: false
    t.bigint "route_id", null: false
    t.float "price", null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["route_id"], name: "route_on_ci_indx"
    t.index ["transport_contract_id"], name: "tc_on_ci_indx"
    t.index ["unit_id"], name: "unit_on_ci_indx"
  end

  create_table "cats_core_currencies", force: :cascade do |t|
    t.string "code"
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cats_core_dispatch_authorizations", force: :cascade do |t|
    t.bigint "dispatch_id", null: false
    t.bigint "store_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.string "status", default: "Authorized", null: false
    t.bigint "authorized_by_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["authorized_by_id"], name: "ab_on_da_indx"
    t.index ["dispatch_id"], name: "dispatch_on_da_indx"
    t.index ["store_id"], name: "store_on_da_indx"
    t.index ["unit_id"], name: "unit_on_da_indx"
  end

  create_table "cats_core_dispatch_plan_items", force: :cascade do |t|
    t.string "reference_no", null: false
    t.bigint "dispatch_plan_id", null: false
    t.bigint "source_id", null: false
    t.bigint "destination_id", null: false
    t.bigint "commodity_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.string "commodity_status", default: "Good", null: false
    t.string "status", default: "Unauthorized", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["commodity_id"], name: "commodity_on_dpi_indx"
    t.index ["destination_id"], name: "dpi_on_destination_indx"
    t.index ["dispatch_plan_id"], name: "dpi_on_dp_indx"
    t.index ["source_id"], name: "dpi_on_source_indx"
    t.index ["unit_id"], name: "unit_on_dpi_indx"
  end

  create_table "cats_core_dispatch_plans", force: :cascade do |t|
    t.string "reference_no"
    t.string "description"
    t.string "status", default: "Draft", null: false
    t.string "dispatchable_type"
    t.bigint "dispatchable_id"
    t.boolean "upstream", default: false, null: false
    t.bigint "prepared_by_id", null: false
    t.bigint "approved_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["approved_by_id"], name: "ab_on_dp_indx"
    t.index ["dispatchable_type", "dispatchable_id"], name: "index_cats_core_dispatch_plans_on_dispatchable"
    t.index ["prepared_by_id"], name: "pb_on_dp_indx"
  end

  create_table "cats_core_dispatch_transactions", force: :cascade do |t|
    t.bigint "source_id", null: false
    t.bigint "dispatch_authorization_id", null: false
    t.date "transaction_date", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.string "status", default: "Draft", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "reference_no"
    t.index ["dispatch_authorization_id"], name: "da_on_dt_indx"
    t.index ["source_id", "dispatch_authorization_id"], name: "sda_on_dt_uniq_indx", unique: true
    t.index ["source_id"], name: "stack_on_dt_indx"
    t.index ["unit_id"], name: "unit_on_dt_indx"
  end

  create_table "cats_core_dispatches", force: :cascade do |t|
    t.string "reference_no"
    t.bigint "dispatch_plan_item_id", null: false
    t.bigint "transporter_id", null: false
    t.string "plate_no", null: false
    t.string "driver_name", null: false
    t.string "driver_phone", null: false
    t.float "quantity", default: 0.0, null: false
    t.bigint "unit_id", null: false
    t.string "commodity_status", default: "Good", null: false
    t.string "remark"
    t.bigint "prepared_by_id", null: false
    t.string "dispatch_status", null: false
    t.jsonb "auth_details"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["dispatch_plan_item_id"], name: "dpi_on_dispatches_indx"
    t.index ["prepared_by_id"], name: "pb_on_dispatches_indx"
    t.index ["transporter_id"], name: "transporter_on_dispatches_indx"
    t.index ["unit_id"], name: "unit_on_dispatches_indx"
  end

  create_table "cats_core_donors", force: :cascade do |t|
    t.string "code"
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cats_core_gift_certificates", force: :cascade do |t|
    t.string "reference_no"
    t.date "gift_date", null: false
    t.string "vessel"
    t.string "port"
    t.string "customs_declaration_no"
    t.integer "purchase_year"
    t.date "expiry_date"
    t.string "bill_of_lading_no"
    t.float "quantity", null: false
    t.bigint "commodity_category_id", null: false
    t.bigint "unit_id", null: false
    t.bigint "destination_warehouse_id", null: false
    t.float "estimated_price"
    t.float "estimated_tax"
    t.bigint "currency_id", null: false
    t.string "registration_no"
    t.string "requested_by", null: false
    t.string "request_reference"
    t.string "customs_office", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["commodity_category_id"], name: "gc_on_cc_indx"
    t.index ["currency_id"], name: "currency_on_gc_indx"
    t.index ["destination_warehouse_id"], name: "dw_on_gc_indx"
    t.index ["unit_id"], name: "unit_on_gc_indx"
  end

  create_table "cats_core_hub_authorizations", force: :cascade do |t|
    t.bigint "dispatch_plan_item_id"
    t.bigint "store_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.string "authorization_type", null: false
    t.bigint "authorized_by_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["authorized_by_id"], name: "ab_on_ha_indx"
    t.index ["dispatch_plan_item_id"], name: "dpi_on_ha_indx"
    t.index ["store_id"], name: "store_on_ha_indx"
    t.index ["unit_id"], name: "unit_on_ha_indx"
  end

  create_table "cats_core_inventory_adjustments", force: :cascade do |t|
    t.string "reference_no"
    t.float "quantity"
    t.string "reason_for_adjustment"
    t.date "adjustment_date", null: false
    t.string "status", default: "Draft", null: false
    t.bigint "unit_id", null: false
    t.bigint "stack_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["stack_id"], name: "stack_on_inventory_indx"
    t.index ["unit_id"], name: "unit_on_inventory_indx"
  end

  create_table "cats_core_loans", force: :cascade do |t|
    t.string "reference_no"
    t.string "description"
    t.string "lender", null: false
    t.date "agreement_date", null: false
    t.date "repayment_date"
    t.bigint "commodity_category_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["commodity_category_id"], name: "cc_on_loan_indx"
    t.index ["unit_id"], name: "unit_on_loan_indx"
  end

  create_table "cats_core_locations", force: :cascade do |t|
    t.string "code"
    t.string "name", null: false
    t.string "location_type", null: false
    t.string "description"
    t.string "ancestry"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["ancestry"], name: "index_cats_core_locations_on_ancestry"
  end

  create_table "cats_core_lost_commodities", force: :cascade do |t|
    t.bigint "receipt_authorization_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.string "remark"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["receipt_authorization_id"], name: "ra_on_lc_indx"
    t.index ["unit_id"], name: "unit_on_lc_indx"
  end

  create_table "cats_core_menu_items", force: :cascade do |t|
    t.string "label", null: false
    t.string "icon"
    t.string "route", null: false
    t.bigint "menu_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["menu_id"], name: "menu_on_mi_indx"
  end

  create_table "cats_core_menus", force: :cascade do |t|
    t.string "label", null: false
    t.string "icon"
    t.bigint "application_module_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["application_module_id"], name: "am_on_menus_indx"
  end

  create_table "cats_core_notification_rules", force: :cascade do |t|
    t.string "code"
    t.string "roles", null: false, array: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cats_core_notifications", force: :cascade do |t|
    t.string "recipient_type", null: false
    t.bigint "recipient_id", null: false
    t.string "type"
    t.jsonb "params"
    t.datetime "read_at", precision: nil
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["read_at"], name: "index_cats_core_notifications_on_read_at"
    t.index ["recipient_type", "recipient_id"], name: "index_cats_core_notifications_on_recipient"
  end

  create_table "cats_core_offer_items", force: :cascade do |t|
    t.bigint "transport_offer_id", null: false
    t.bigint "transport_bid_item_id", null: false
    t.float "price", null: false
    t.boolean "winner", default: false, null: false
    t.integer "rank"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["transport_bid_item_id"], name: "tbi_on_to_indx"
    t.index ["transport_offer_id"], name: "to_on_oi_indx"
  end

  create_table "cats_core_operators", force: :cascade do |t|
    t.string "code"
    t.string "name", null: false
    t.string "description"
    t.string "contact_name", null: false
    t.string "contact_phone", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cats_core_plan_item_details", force: :cascade do |t|
    t.bigint "beneficiary_plan_item_id", null: false
    t.bigint "ration_id", null: false
    t.float "quantity", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["beneficiary_plan_item_id", "ration_id"], name: "bpii_ri_on_pid_indx", unique: true
    t.index ["beneficiary_plan_item_id"], name: "bpi_on_pid_indx"
    t.index ["ration_id"], name: "ration_on_pid_indx"
  end

  create_table "cats_core_plan_items", force: :cascade do |t|
    t.bigint "plan_id", null: false
    t.bigint "region_id", null: false
    t.bigint "zone_id", null: false
    t.bigint "woreda_id", null: false
    t.bigint "fdp_id", null: false
    t.bigint "operator_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["fdp_id"], name: "fdp_on_plan_items_indx"
    t.index ["operator_id"], name: "operator_on_plan_items_indx"
    t.index ["plan_id", "fdp_id"], name: "index_cats_core_plan_items_on_plan_id_and_fdp_id", unique: true
    t.index ["plan_id"], name: "plan_on_plan_items_indx"
    t.index ["region_id"], name: "region_on_plan_items_indx"
    t.index ["woreda_id"], name: "woreda_on_plan_items_idnx"
    t.index ["zone_id"], name: "zone_on_plan_items_indx"
  end

  create_table "cats_core_plans", force: :cascade do |t|
    t.string "reference_no"
    t.integer "year", null: false
    t.string "season", null: false
    t.string "status", default: "Draft", null: false
    t.date "start_date"
    t.integer "total_days", default: 180, null: false
    t.integer "rounds", null: false
    t.bigint "program_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["program_id"], name: "program_on_plan_indx"
  end

  create_table "cats_core_programs", force: :cascade do |t|
    t.string "code"
    t.string "name", null: false
    t.string "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cats_core_projects", force: :cascade do |t|
    t.string "code"
    t.string "description"
    t.string "source_type"
    t.bigint "source_id"
    t.bigint "program_id", null: false
    t.integer "year", null: false
    t.string "implementing_agency", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["program_id"], name: "program_on_projects_indx"
    t.index ["source_type", "source_id"], name: "index_cats_core_projects_on_source"
  end

  create_table "cats_core_purchase_orders", force: :cascade do |t|
    t.string "reference_no"
    t.string "description"
    t.date "order_date", null: false
    t.string "requisition_no"
    t.string "supplier", null: false
    t.float "quantity", null: false
    t.string "purchase_type", null: false
    t.float "price", null: false
    t.bigint "currency_id", null: false
    t.bigint "cash_donation_id", null: false
    t.bigint "commodity_category_id", null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["cash_donation_id"], name: "cd_on_po_indx"
    t.index ["commodity_category_id"], name: "cc_on_po_indx"
    t.index ["currency_id"], name: "currency_on_po_indx"
    t.index ["unit_id"], name: "unit_on_po_indx"
  end

  create_table "cats_core_rations", force: :cascade do |t|
    t.string "reference_no"
    t.bigint "beneficiary_category_id", null: false
    t.bigint "commodity_category_id", null: false
    t.bigint "unit_of_measure_id", null: false
    t.float "quantity", null: false
    t.integer "no_of_days", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["beneficiary_category_id"], name: "bc_on_ration_indx"
    t.index ["commodity_category_id"], name: "cc_on_ration_indx"
    t.index ["unit_of_measure_id"], name: "uom_on_ration_indx"
  end

  create_table "cats_core_receipt_authorizations", force: :cascade do |t|
    t.bigint "dispatch_id", null: false
    t.bigint "store_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.float "received_quantity", default: 0.0, null: false
    t.string "status", default: "Authorized", null: false
    t.string "remark"
    t.jsonb "auth_details"
    t.boolean "driver_confirmed", default: false, null: false
    t.bigint "authorized_by_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["authorized_by_id"], name: "ab_on_receipt_authorizations_indx"
    t.index ["dispatch_id"], name: "dispatch_on_receipt_authorizations_indx"
    t.index ["store_id"], name: "store_on_ra_indx"
    t.index ["unit_id"], name: "r_unit_on_da_indx"
  end

  create_table "cats_core_receipt_transactions", force: :cascade do |t|
    t.bigint "receipt_authorization_id", null: false
    t.bigint "destination_id", null: false
    t.date "transaction_date", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.string "status", default: "Draft", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "receipt_number"
    t.index ["destination_id"], name: "stack_on_rt_indx"
    t.index ["receipt_authorization_id"], name: "receipt_authorization_on_rt_indx"
    t.index ["unit_id"], name: "r_unit_on_dt_indx"
  end

  create_table "cats_core_receipts", force: :cascade do |t|
    t.bigint "receipt_authorization_id", null: false
    t.string "commodity_status", null: false
    t.string "commodity_grade"
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.string "remark"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "reference_no"
    t.index ["receipt_authorization_id"], name: "ra_on_receipts_indx"
    t.index ["unit_id"], name: "unit_on_receipts_indx"
  end

  create_table "cats_core_rhn_requests", force: :cascade do |t|
    t.string "reference_no"
    t.bigint "commodity_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.date "request_date", null: false
    t.string "requested_by"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "status", default: "Draft", null: false
    t.index ["commodity_id"], name: "commodity_on_rhn_indx"
    t.index ["unit_id"], name: "unit_on_rhn_indx"
  end

  create_table "cats_core_role_menus", force: :cascade do |t|
    t.bigint "role_id", null: false
    t.bigint "menu_id", null: false
    t.string "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["menu_id"], name: "menu_on_rm_indx"
    t.index ["role_id"], name: "role_on_rm_indx"
  end

  create_table "cats_core_role_menus_menu_items", id: false, force: :cascade do |t|
    t.bigint "role_menu_id", null: false
    t.bigint "menu_item_id", null: false
    t.index ["menu_item_id"], name: "mi_on_ummi_indx"
    t.index ["role_menu_id"], name: "rm_on_ummi_indx"
  end

  create_table "cats_core_roles", force: :cascade do |t|
    t.string "name"
    t.string "resource_type"
    t.bigint "resource_id"
    t.bigint "application_module_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["application_module_id"], name: "am_on_roles_indx"
    t.index ["name", "resource_type", "resource_id"], name: "index_cats_core_roles_on_name_and_resource_type_and_resource_id"
    t.index ["resource_type", "resource_id"], name: "index_cats_core_roles_on_resource"
  end

  create_table "cats_core_round_beneficiaries", force: :cascade do |t|
    t.bigint "beneficiary_id", null: false
    t.bigint "round_plan_item_id", null: false
    t.bigint "commodity_category_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.boolean "received", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["beneficiary_id"], name: "beneficiary_on_rb_indx"
    t.index ["commodity_category_id"], name: "cc_on_rb_indx"
    t.index ["round_plan_item_id"], name: "rpi_on_rb_indx"
    t.index ["unit_id"], name: "unit_on_rb_indx"
  end

  create_table "cats_core_round_plan_item_details", force: :cascade do |t|
    t.bigint "beneficiary_round_plan_item_id", null: false
    t.bigint "round_ration_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["beneficiary_round_plan_item_id"], name: "brpi_on_rpid_indx"
    t.index ["round_ration_id"], name: "rr_on_rpid_indx"
    t.index ["unit_id"], name: "unit_on_rpid_indx"
  end

  create_table "cats_core_round_plan_items", force: :cascade do |t|
    t.bigint "round_plan_id", null: false
    t.bigint "region_id", null: false
    t.bigint "zone_id", null: false
    t.bigint "woreda_id", null: false
    t.bigint "fdp_id", null: false
    t.bigint "operator_id", null: false
    t.integer "plan_item_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["fdp_id"], name: "fdp_on_round_plan_items_indx"
    t.index ["operator_id"], name: "operator_on_rpi_indx"
    t.index ["region_id"], name: "region_on_round_plan_items_indx"
    t.index ["round_plan_id"], name: "mp_on_mpi_indx"
    t.index ["woreda_id"], name: "woreda_on_round_plan_items_idnx"
    t.index ["zone_id"], name: "zone_on_round_plan_items_indx"
  end

  create_table "cats_core_round_plans", force: :cascade do |t|
    t.string "reference_no"
    t.integer "rounds", default: [], array: true
    t.string "status", default: "Draft", null: false
    t.bigint "plan_id", null: false
    t.bigint "region_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["plan_id"], name: "plan_on_mp_indx"
    t.index ["region_id"], name: "region_on_mp_indx"
  end

  create_table "cats_core_round_rations", force: :cascade do |t|
    t.bigint "beneficiary_category_id", null: false
    t.bigint "commodity_category_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_of_measure_id", null: false
    t.bigint "round_plan_id", null: false
    t.integer "no_of_days", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["beneficiary_category_id"], name: "bc_on_rr_indx"
    t.index ["commodity_category_id"], name: "cc_on_rr_indx"
    t.index ["round_plan_id"], name: "rp_on_rr_indx"
    t.index ["unit_of_measure_id"], name: "uom_on_rr_indx"
  end

  create_table "cats_core_routes", force: :cascade do |t|
    t.string "name", null: false
    t.bigint "region_id", null: false
    t.bigint "source_id", null: false
    t.bigint "destination_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["destination_id"], name: "destination_on_routes_indx"
    t.index ["region_id"], name: "region_on_routes_indx"
    t.index ["source_id", "destination_id"], name: "index_cats_core_routes_on_source_id_and_destination_id", unique: true
    t.index ["source_id"], name: "source_on_routes_indx"
  end

  create_table "cats_core_stack_transactions", force: :cascade do |t|
    t.bigint "source_id", null: false
    t.bigint "destination_id", null: false
    t.date "transaction_date", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.string "status", default: "Draft", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["destination_id"], name: "destination_on_st_indx"
    t.index ["source_id"], name: "source_on_st_indx"
    t.index ["unit_id"], name: "unit_on_st_indx"
  end

  create_table "cats_core_stacking_rules", force: :cascade do |t|
    t.float "distance_from_wall", null: false
    t.float "space_between_stack", null: false
    t.float "distance_from_ceiling", null: false
    t.float "maximum_height", null: false
    t.float "maximum_length", null: false
    t.float "maximum_width", null: false
    t.float "distance_from_gangway", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cats_core_stacks", force: :cascade do |t|
    t.string "code"
    t.float "length", null: false
    t.float "width", null: false
    t.float "height", null: false
    t.float "start_x", null: false
    t.float "start_y", null: false
    t.bigint "commodity_id", null: false
    t.bigint "store_id", null: false
    t.string "commodity_status", default: "Good", null: false
    t.string "stack_status", default: "Reserved", null: false
    t.float "quantity", default: 0.0, null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["commodity_id"], name: "commodity_on_stack_indx"
    t.index ["store_id"], name: "store_on_stack_indx"
    t.index ["unit_id"], name: "unit_on_stack_indx"
  end

  create_table "cats_core_stores", force: :cascade do |t|
    t.string "code"
    t.string "name", null: false
    t.float "length", null: false
    t.float "width", null: false
    t.float "height", null: false
    t.float "usable_space", null: false
    t.float "available_space", null: false
    t.boolean "temporary", default: false, null: false
    t.boolean "has_gangway", default: false, null: false
    t.float "gangway_length"
    t.float "gangway_width"
    t.float "gangway_corner_dist"
    t.bigint "warehouse_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["warehouse_id"], name: "warehouse_on_stores_indx"
  end

  create_table "cats_core_suppliers", force: :cascade do |t|
    t.string "code"
    t.string "name", null: false
    t.string "description"
    t.string "address"
    t.string "contact_name", null: false
    t.string "contact_phone", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cats_core_swaps", force: :cascade do |t|
    t.string "reference_no"
    t.string "description"
    t.string "swapper", null: false
    t.date "agreement_date", null: false
    t.float "issued_quantity", null: false
    t.float "received_quantity", null: false
    t.bigint "issued_commodity_id", null: false
    t.bigint "received_commodity_id", null: false
    t.bigint "issued_unit_id", null: false
    t.bigint "received_unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["issued_commodity_id"], name: "ic_on_swap_indx"
    t.index ["issued_unit_id"], name: "iu_on_swap_indx"
    t.index ["received_commodity_id"], name: "rc_on_swap_indx"
    t.index ["received_unit_id"], name: "ru_on_swap_indx"
  end

  create_table "cats_core_tenderers", force: :cascade do |t|
    t.bigint "transport_bid_id", null: false
    t.bigint "transporter_id", null: false
    t.string "purchased_by", null: false
    t.string "phone_no", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["transport_bid_id"], name: "tb_on_tenderer_indx"
    t.index ["transporter_id"], name: "transporter_on_tenderer_indx"
  end

  create_table "cats_core_transport_bid_items", force: :cascade do |t|
    t.bigint "transport_bid_id", null: false
    t.bigint "transport_plan_item_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["transport_bid_id"], name: "tb_on_tbi_indx"
    t.index ["transport_plan_item_id"], name: "tbi_on_tpi_uniq_indx", unique: true
    t.index ["transport_plan_item_id"], name: "tpi_on_tbi_indx"
    t.index ["unit_id"], name: "unit_on_tbi_indx"
  end

  create_table "cats_core_transport_bids", force: :cascade do |t|
    t.string "reference_no"
    t.string "description"
    t.datetime "start_date", precision: nil, null: false
    t.datetime "end_date", precision: nil, null: false
    t.datetime "opening_date", precision: nil, null: false
    t.string "status", default: "New", null: false
    t.float "bid_bond_amount", default: 0.0, null: false
    t.bigint "transport_plan_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["transport_plan_id"], name: "tp_on_tb_indx"
  end

  create_table "cats_core_transport_contracts", force: :cascade do |t|
    t.string "contract_no"
    t.bigint "transporter_id", null: false
    t.bigint "transport_bid_id", null: false
    t.date "contract_date", null: false
    t.date "expires_on", null: false
    t.string "payment_term"
    t.boolean "signed", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["transport_bid_id"], name: "tb_on_tc_indx"
    t.index ["transporter_id"], name: "transporter_on_tc_indx"
  end

  create_table "cats_core_transport_offers", force: :cascade do |t|
    t.bigint "transport_bid_id", null: false
    t.bigint "transporter_id", null: false
    t.date "offer_date", null: false
    t.float "bid_bond_amount", default: 0.0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["transport_bid_id", "transporter_id"], name: "tb_and_t_on_to_indx", unique: true
    t.index ["transport_bid_id"], name: "to_on_tb_indx"
    t.index ["transporter_id"], name: "to_on_transporter_indx"
  end

  create_table "cats_core_transport_order_items", force: :cascade do |t|
    t.bigint "transport_order_id", null: false
    t.bigint "transporter_id", null: false
    t.bigint "transport_contract_id"
    t.bigint "transport_requisition_item_id", null: false
    t.integer "valid_for", default: 10, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["transport_contract_id"], name: "tc_on_toi_indx"
    t.index ["transport_order_id"], name: "to_on_toi_indx"
    t.index ["transport_requisition_item_id"], name: "tri_on_toi_indx"
    t.index ["transport_requisition_item_id"], name: "tri_on_toi_uniq_indx", unique: true
    t.index ["transporter_id"], name: "transporter_on_toi_indx"
  end

  create_table "cats_core_transport_orders", force: :cascade do |t|
    t.bigint "transport_requisition_id", null: false
    t.bigint "prepared_by_id", null: false
    t.bigint "approved_by_id"
    t.date "order_date", null: false
    t.string "status", default: "Draft", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["approved_by_id"], name: "ab_on_to_indx"
    t.index ["prepared_by_id"], name: "pb_on_to_indx"
    t.index ["transport_requisition_id"], name: "tr_on_to_indx"
  end

  create_table "cats_core_transport_plan_items", force: :cascade do |t|
    t.bigint "route_id", null: false
    t.bigint "transport_plan_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.boolean "planned", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["route_id"], name: "route_on_tpi_indx"
    t.index ["transport_plan_id"], name: "tp_on_tpi_indx"
    t.index ["unit_id"], name: "unit_on_tpi_indx"
  end

  create_table "cats_core_transport_plans", force: :cascade do |t|
    t.string "reference_no"
    t.string "plan_type", default: "Regional", null: false
    t.bigint "region_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["region_id"], name: "region_on_tp_indx"
  end

  create_table "cats_core_transport_requisition_details", force: :cascade do |t|
    t.bigint "transport_requisition_item_id", null: false
    t.float "quantity", null: false
    t.bigint "fdp_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["fdp_id"], name: "fdp_on_tri_indx"
    t.index ["transport_requisition_item_id"], name: "tri_on_trd_indx"
  end

  create_table "cats_core_transport_requisition_items", force: :cascade do |t|
    t.bigint "transport_requisition_id", null: false
    t.bigint "dispatch_plan_item_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["dispatch_plan_item_id"], name: "dpi_on_tri_indx"
    t.index ["transport_requisition_id"], name: "tr_on_tri_indx"
    t.index ["unit_id"], name: "unit_on_tri_indx"
  end

  create_table "cats_core_transport_requisitions", force: :cascade do |t|
    t.bigint "dispatch_plan_id", null: false
    t.string "reference_no", null: false
    t.bigint "requested_by_id", null: false
    t.bigint "approved_by_id"
    t.string "status", null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["approved_by_id"], name: "ab_on_tr_indx"
    t.index ["dispatch_plan_id"], name: "dp_on_tr_indx"
    t.index ["requested_by_id"], name: "rb_on_tr_indx"
    t.index ["unit_id"], name: "unit_on_tr_indx"
  end

  create_table "cats_core_transporters", force: :cascade do |t|
    t.string "code"
    t.string "name", null: false
    t.string "address", null: false
    t.string "contact_phone", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cats_core_unit_conversions", force: :cascade do |t|
    t.bigint "from_id", null: false
    t.bigint "to_id", null: false
    t.float "factor", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["from_id", "to_id"], name: "index_cats_core_unit_conversions_on_from_id_and_to_id", unique: true
    t.index ["from_id"], name: "from_on_uc_indx"
    t.index ["to_id"], name: "to_on_uc_indx"
  end

  create_table "cats_core_unit_of_measures", force: :cascade do |t|
    t.string "name"
    t.string "abbreviation"
    t.string "unit_type", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cats_core_users", force: :cascade do |t|
    t.string "first_name", null: false
    t.string "last_name", null: false
    t.string "email"
    t.boolean "active", default: true, null: false
    t.string "password_digest"
    t.jsonb "details", default: {}, null: false
    t.string "phone_number"
    t.bigint "application_module_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["application_module_id"], name: "am_on_users_indx"
  end

  create_table "cats_core_users_cats_core_roles", id: false, force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "role_id", null: false
    t.index ["role_id"], name: "role_on_ur_indx"
    t.index ["user_id", "role_id"], name: "index_cats_core_users_cats_core_roles_on_user_id_and_role_id", unique: true
    t.index ["user_id"], name: "user_on_ur_indx"
  end

  add_foreign_key "cats_core_application_settings", "cats_core_application_modules", column: "application_module_id"
  add_foreign_key "cats_core_beneficiaries", "cats_core_beneficiary_categories", column: "beneficiary_category_id"
  add_foreign_key "cats_core_beneficiaries", "cats_core_locations", column: "fdp_id"
  add_foreign_key "cats_core_beneficiary_categories", "cats_core_plans", column: "plan_id"
  add_foreign_key "cats_core_beneficiary_plan_items", "cats_core_beneficiary_categories", column: "beneficiary_category_id"
  add_foreign_key "cats_core_beneficiary_plan_items", "cats_core_plan_items", column: "plan_item_id"
  add_foreign_key "cats_core_beneficiary_round_plan_items", "cats_core_beneficiary_categories", column: "beneficiary_category_id"
  add_foreign_key "cats_core_beneficiary_round_plan_items", "cats_core_round_plan_items", column: "round_plan_item_id"
  add_foreign_key "cats_core_cash_donations", "cats_core_currencies", column: "currency_id"
  add_foreign_key "cats_core_cash_donations", "cats_core_donors", column: "donor_id"
  add_foreign_key "cats_core_commodities", "cats_core_projects", column: "project_id"
  add_foreign_key "cats_core_commodities", "cats_core_unit_of_measures", column: "package_unit_id"
  add_foreign_key "cats_core_commodities", "cats_core_unit_of_measures", column: "unit_of_measure_id"
  add_foreign_key "cats_core_commodity_donations", "cats_core_commodity_categories", column: "commodity_category_id"
  add_foreign_key "cats_core_commodity_donations", "cats_core_donors", column: "donor_id"
  add_foreign_key "cats_core_commodity_donations", "cats_core_plans", column: "plan_id"
  add_foreign_key "cats_core_commodity_donations", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_commodity_substitutions", "cats_core_commodity_categories", column: "commodity_id"
  add_foreign_key "cats_core_commodity_substitutions", "cats_core_commodity_categories", column: "replaced_by_id"
  add_foreign_key "cats_core_commodity_substitutions", "cats_core_programs", column: "program_id"
  add_foreign_key "cats_core_contract_items", "cats_core_routes", column: "route_id"
  add_foreign_key "cats_core_contract_items", "cats_core_transport_contracts", column: "transport_contract_id"
  add_foreign_key "cats_core_contract_items", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_dispatch_authorizations", "cats_core_dispatches", column: "dispatch_id"
  add_foreign_key "cats_core_dispatch_authorizations", "cats_core_stores", column: "store_id"
  add_foreign_key "cats_core_dispatch_authorizations", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_dispatch_authorizations", "cats_core_users", column: "authorized_by_id"
  add_foreign_key "cats_core_dispatch_plan_items", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_core_dispatch_plan_items", "cats_core_dispatch_plans", column: "dispatch_plan_id"
  add_foreign_key "cats_core_dispatch_plan_items", "cats_core_locations", column: "destination_id"
  add_foreign_key "cats_core_dispatch_plan_items", "cats_core_locations", column: "source_id"
  add_foreign_key "cats_core_dispatch_plan_items", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_dispatch_plans", "cats_core_users", column: "approved_by_id"
  add_foreign_key "cats_core_dispatch_plans", "cats_core_users", column: "prepared_by_id"
  add_foreign_key "cats_core_dispatch_transactions", "cats_core_dispatch_authorizations", column: "dispatch_authorization_id"
  add_foreign_key "cats_core_dispatch_transactions", "cats_core_stacks", column: "source_id"
  add_foreign_key "cats_core_dispatch_transactions", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_dispatches", "cats_core_dispatch_plan_items", column: "dispatch_plan_item_id"
  add_foreign_key "cats_core_dispatches", "cats_core_transporters", column: "transporter_id"
  add_foreign_key "cats_core_dispatches", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_dispatches", "cats_core_users", column: "prepared_by_id"
  add_foreign_key "cats_core_gift_certificates", "cats_core_commodity_categories", column: "commodity_category_id"
  add_foreign_key "cats_core_gift_certificates", "cats_core_currencies", column: "currency_id"
  add_foreign_key "cats_core_gift_certificates", "cats_core_locations", column: "destination_warehouse_id"
  add_foreign_key "cats_core_gift_certificates", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_hub_authorizations", "cats_core_dispatch_plan_items", column: "dispatch_plan_item_id"
  add_foreign_key "cats_core_hub_authorizations", "cats_core_stores", column: "store_id"
  add_foreign_key "cats_core_hub_authorizations", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_hub_authorizations", "cats_core_users", column: "authorized_by_id"
  add_foreign_key "cats_core_inventory_adjustments", "cats_core_stacks", column: "stack_id"
  add_foreign_key "cats_core_inventory_adjustments", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_loans", "cats_core_commodity_categories", column: "commodity_category_id"
  add_foreign_key "cats_core_loans", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_lost_commodities", "cats_core_receipt_authorizations", column: "receipt_authorization_id"
  add_foreign_key "cats_core_lost_commodities", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_menu_items", "cats_core_menus", column: "menu_id"
  add_foreign_key "cats_core_menus", "cats_core_application_modules", column: "application_module_id"
  add_foreign_key "cats_core_offer_items", "cats_core_transport_bid_items", column: "transport_bid_item_id"
  add_foreign_key "cats_core_offer_items", "cats_core_transport_offers", column: "transport_offer_id"
  add_foreign_key "cats_core_plan_item_details", "cats_core_beneficiary_plan_items", column: "beneficiary_plan_item_id"
  add_foreign_key "cats_core_plan_item_details", "cats_core_rations", column: "ration_id"
  add_foreign_key "cats_core_plan_items", "cats_core_locations", column: "fdp_id"
  add_foreign_key "cats_core_plan_items", "cats_core_locations", column: "region_id"
  add_foreign_key "cats_core_plan_items", "cats_core_locations", column: "woreda_id"
  add_foreign_key "cats_core_plan_items", "cats_core_locations", column: "zone_id"
  add_foreign_key "cats_core_plan_items", "cats_core_operators", column: "operator_id"
  add_foreign_key "cats_core_plan_items", "cats_core_plans", column: "plan_id"
  add_foreign_key "cats_core_plans", "cats_core_programs", column: "program_id"
  add_foreign_key "cats_core_projects", "cats_core_programs", column: "program_id"
  add_foreign_key "cats_core_purchase_orders", "cats_core_cash_donations", column: "cash_donation_id"
  add_foreign_key "cats_core_purchase_orders", "cats_core_commodity_categories", column: "commodity_category_id"
  add_foreign_key "cats_core_purchase_orders", "cats_core_currencies", column: "currency_id"
  add_foreign_key "cats_core_purchase_orders", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_rations", "cats_core_beneficiary_categories", column: "beneficiary_category_id"
  add_foreign_key "cats_core_rations", "cats_core_commodity_categories", column: "commodity_category_id"
  add_foreign_key "cats_core_rations", "cats_core_unit_of_measures", column: "unit_of_measure_id"
  add_foreign_key "cats_core_receipt_authorizations", "cats_core_dispatches", column: "dispatch_id"
  add_foreign_key "cats_core_receipt_authorizations", "cats_core_stores", column: "store_id"
  add_foreign_key "cats_core_receipt_authorizations", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_receipt_authorizations", "cats_core_users", column: "authorized_by_id"
  add_foreign_key "cats_core_receipt_transactions", "cats_core_receipt_authorizations", column: "receipt_authorization_id"
  add_foreign_key "cats_core_receipt_transactions", "cats_core_stacks", column: "destination_id"
  add_foreign_key "cats_core_receipt_transactions", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_receipts", "cats_core_receipt_authorizations", column: "receipt_authorization_id"
  add_foreign_key "cats_core_receipts", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_rhn_requests", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_core_rhn_requests", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_role_menus", "cats_core_menus", column: "menu_id"
  add_foreign_key "cats_core_role_menus", "cats_core_roles", column: "role_id"
  add_foreign_key "cats_core_role_menus_menu_items", "cats_core_menu_items", column: "menu_item_id"
  add_foreign_key "cats_core_role_menus_menu_items", "cats_core_role_menus", column: "role_menu_id"
  add_foreign_key "cats_core_roles", "cats_core_application_modules", column: "application_module_id"
  add_foreign_key "cats_core_round_beneficiaries", "cats_core_beneficiaries", column: "beneficiary_id"
  add_foreign_key "cats_core_round_beneficiaries", "cats_core_commodity_categories", column: "commodity_category_id"
  add_foreign_key "cats_core_round_beneficiaries", "cats_core_round_plan_items", column: "round_plan_item_id"
  add_foreign_key "cats_core_round_beneficiaries", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_round_plan_item_details", "cats_core_beneficiary_round_plan_items", column: "beneficiary_round_plan_item_id"
  add_foreign_key "cats_core_round_plan_item_details", "cats_core_round_rations", column: "round_ration_id"
  add_foreign_key "cats_core_round_plan_item_details", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_round_plan_items", "cats_core_locations", column: "fdp_id"
  add_foreign_key "cats_core_round_plan_items", "cats_core_locations", column: "region_id"
  add_foreign_key "cats_core_round_plan_items", "cats_core_locations", column: "woreda_id"
  add_foreign_key "cats_core_round_plan_items", "cats_core_locations", column: "zone_id"
  add_foreign_key "cats_core_round_plan_items", "cats_core_operators", column: "operator_id"
  add_foreign_key "cats_core_round_plan_items", "cats_core_round_plans", column: "round_plan_id", on_delete: :cascade
  add_foreign_key "cats_core_round_plans", "cats_core_locations", column: "region_id"
  add_foreign_key "cats_core_round_plans", "cats_core_plans", column: "plan_id"
  add_foreign_key "cats_core_round_rations", "cats_core_beneficiary_categories", column: "beneficiary_category_id"
  add_foreign_key "cats_core_round_rations", "cats_core_commodity_categories", column: "commodity_category_id"
  add_foreign_key "cats_core_round_rations", "cats_core_round_plans", column: "round_plan_id"
  add_foreign_key "cats_core_round_rations", "cats_core_unit_of_measures", column: "unit_of_measure_id"
  add_foreign_key "cats_core_routes", "cats_core_locations", column: "destination_id"
  add_foreign_key "cats_core_routes", "cats_core_locations", column: "region_id"
  add_foreign_key "cats_core_routes", "cats_core_locations", column: "source_id"
  add_foreign_key "cats_core_stack_transactions", "cats_core_stacks", column: "destination_id"
  add_foreign_key "cats_core_stack_transactions", "cats_core_stacks", column: "source_id"
  add_foreign_key "cats_core_stack_transactions", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_stacks", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_core_stacks", "cats_core_stores", column: "store_id"
  add_foreign_key "cats_core_stacks", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_stores", "cats_core_locations", column: "warehouse_id"
  add_foreign_key "cats_core_swaps", "cats_core_commodity_categories", column: "issued_commodity_id"
  add_foreign_key "cats_core_swaps", "cats_core_commodity_categories", column: "received_commodity_id"
  add_foreign_key "cats_core_swaps", "cats_core_unit_of_measures", column: "issued_unit_id"
  add_foreign_key "cats_core_swaps", "cats_core_unit_of_measures", column: "received_unit_id"
  add_foreign_key "cats_core_tenderers", "cats_core_transport_bids", column: "transport_bid_id"
  add_foreign_key "cats_core_tenderers", "cats_core_transporters", column: "transporter_id"
  add_foreign_key "cats_core_transport_bid_items", "cats_core_transport_bids", column: "transport_bid_id"
  add_foreign_key "cats_core_transport_bid_items", "cats_core_transport_plan_items", column: "transport_plan_item_id"
  add_foreign_key "cats_core_transport_bid_items", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_transport_bids", "cats_core_transport_plans", column: "transport_plan_id"
  add_foreign_key "cats_core_transport_contracts", "cats_core_transport_bids", column: "transport_bid_id"
  add_foreign_key "cats_core_transport_contracts", "cats_core_transporters", column: "transporter_id"
  add_foreign_key "cats_core_transport_offers", "cats_core_transport_bids", column: "transport_bid_id"
  add_foreign_key "cats_core_transport_offers", "cats_core_transporters", column: "transporter_id"
  add_foreign_key "cats_core_transport_order_items", "cats_core_transport_contracts", column: "transport_contract_id"
  add_foreign_key "cats_core_transport_order_items", "cats_core_transport_orders", column: "transport_order_id"
  add_foreign_key "cats_core_transport_order_items", "cats_core_transport_requisition_items", column: "transport_requisition_item_id"
  add_foreign_key "cats_core_transport_order_items", "cats_core_transporters", column: "transporter_id"
  add_foreign_key "cats_core_transport_orders", "cats_core_transport_requisitions", column: "transport_requisition_id"
  add_foreign_key "cats_core_transport_orders", "cats_core_users", column: "approved_by_id"
  add_foreign_key "cats_core_transport_orders", "cats_core_users", column: "prepared_by_id"
  add_foreign_key "cats_core_transport_plan_items", "cats_core_routes", column: "route_id"
  add_foreign_key "cats_core_transport_plan_items", "cats_core_transport_plans", column: "transport_plan_id"
  add_foreign_key "cats_core_transport_plan_items", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_transport_plans", "cats_core_locations", column: "region_id"
  add_foreign_key "cats_core_transport_requisition_details", "cats_core_locations", column: "fdp_id"
  add_foreign_key "cats_core_transport_requisition_details", "cats_core_transport_requisition_items", column: "transport_requisition_item_id"
  add_foreign_key "cats_core_transport_requisition_items", "cats_core_dispatch_plan_items", column: "dispatch_plan_item_id"
  add_foreign_key "cats_core_transport_requisition_items", "cats_core_transport_requisitions", column: "transport_requisition_id"
  add_foreign_key "cats_core_transport_requisition_items", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_transport_requisitions", "cats_core_dispatch_plans", column: "dispatch_plan_id"
  add_foreign_key "cats_core_transport_requisitions", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_core_transport_requisitions", "cats_core_users", column: "approved_by_id"
  add_foreign_key "cats_core_transport_requisitions", "cats_core_users", column: "requested_by_id"
  add_foreign_key "cats_core_unit_conversions", "cats_core_unit_of_measures", column: "from_id"
  add_foreign_key "cats_core_unit_conversions", "cats_core_unit_of_measures", column: "to_id"
  add_foreign_key "cats_core_users", "cats_core_application_modules", column: "application_module_id"
  add_foreign_key "cats_core_users_cats_core_roles", "cats_core_roles", column: "role_id"
  add_foreign_key "cats_core_users_cats_core_roles", "cats_core_users", column: "user_id"
end
