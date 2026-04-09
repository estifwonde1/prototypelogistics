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

ActiveRecord::Schema[7.0].define(version: 2026_04_01_180000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "idx_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "idx_active_storage_variant_records_uniqueness", unique: true
  end

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
    t.string "name"
    t.bigint "commodity_category_id"
    t.index ["commodity_category_id"], name: "index_cats_core_commodities_on_commodity_category_id"
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
    t.float "quantity"
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
    t.integer "beneficiaries"
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
    t.bigint "cash_donation_id"
    t.index ["cash_donation_id"], name: "index_cats_core_gift_certificates_on_cash_donation_id"
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
    t.float "price"
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
    t.string "status", default: "Active", null: false
    t.integer "region_id"
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
    t.integer "unit_id"
    t.integer "route_id"
    t.float "quantity", null: false
    t.string "status", null: false
    t.float "price"
    t.index ["transport_contract_id"], name: "tc_on_toi_indx"
    t.index ["transport_order_id"], name: "to_on_toi_indx"
    t.index ["transport_requisition_item_id"], name: "tri_on_toi_indx"
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
    t.string "order_status", default: "Active", null: false
    t.string "order_no", null: false
    t.date "requested_dispatch_date"
    t.date "order_expiry_date"
    t.string "performance_bond_receipt"
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

  create_table "cats_warehouse_dispatch_order_assignments", force: :cascade do |t|
    t.bigint "dispatch_order_id", null: false
    t.bigint "dispatch_order_line_id"
    t.bigint "hub_id"
    t.bigint "warehouse_id"
    t.bigint "store_id"
    t.bigint "assigned_by_id", null: false
    t.bigint "assigned_to_id"
    t.decimal "quantity", precision: 15, scale: 3
    t.string "status", default: "Assigned", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["assigned_by_id"], name: "idx_cw_do_assign_by"
    t.index ["assigned_to_id"], name: "idx_cw_do_assign_to"
    t.index ["dispatch_order_id"], name: "idx_cw_do_assign_order"
    t.index ["dispatch_order_line_id"], name: "idx_cw_do_assign_line"
    t.index ["hub_id"], name: "idx_cw_do_assign_hub"
    t.index ["status"], name: "index_cats_warehouse_dispatch_order_assignments_on_status"
    t.index ["store_id"], name: "idx_cw_do_assign_store"
    t.index ["warehouse_id"], name: "idx_cw_do_assign_wh"
  end

  create_table "cats_warehouse_dispatch_order_lines", force: :cascade do |t|
    t.bigint "dispatch_order_id", null: false
    t.bigint "commodity_id", null: false
    t.decimal "quantity", precision: 15, scale: 2, null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["commodity_id"], name: "index_cats_warehouse_dispatch_order_lines_on_commodity_id"
    t.index ["dispatch_order_id"], name: "index_dispatch_order_lines_on_order_id"
    t.index ["unit_id"], name: "index_cats_warehouse_dispatch_order_lines_on_unit_id"
  end

  create_table "cats_warehouse_dispatch_orders", force: :cascade do |t|
    t.string "reference_no"
    t.string "status", default: "Draft", null: false
    t.bigint "hub_id"
    t.bigint "warehouse_id"
    t.string "destination_type"
    t.bigint "destination_id"
    t.string "source_document_no"
    t.date "dispatched_date"
    t.bigint "created_by_id"
    t.bigint "confirmed_by_id"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name"
    t.datetime "confirmed_at"
    t.index ["confirmed_by_id"], name: "index_cats_warehouse_dispatch_orders_on_confirmed_by_id"
    t.index ["created_by_id"], name: "index_cats_warehouse_dispatch_orders_on_created_by_id"
    t.index ["hub_id"], name: "index_cats_warehouse_dispatch_orders_on_hub_id"
    t.index ["reference_no"], name: "index_cats_warehouse_dispatch_orders_on_reference_no", unique: true
    t.index ["status"], name: "index_cats_warehouse_dispatch_orders_on_status"
    t.index ["warehouse_id"], name: "index_cats_warehouse_dispatch_orders_on_warehouse_id"
  end

  create_table "cats_warehouse_geos", force: :cascade do |t|
    t.float "latitude"
    t.float "longitude"
    t.float "altitude_m"
    t.string "address"
    t.string "source"
    t.datetime "captured_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "cats_warehouse_gin_items", force: :cascade do |t|
    t.bigint "gin_id", null: false
    t.bigint "commodity_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.bigint "store_id"
    t.bigint "stack_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "inventory_lot_id"
    t.bigint "entered_unit_id"
    t.bigint "base_unit_id"
    t.decimal "base_quantity", precision: 15, scale: 3
    t.index ["base_unit_id"], name: "index_cats_warehouse_gin_items_on_base_unit_id"
    t.index ["commodity_id"], name: "index_cats_warehouse_gin_items_on_commodity_id"
    t.index ["entered_unit_id"], name: "index_cats_warehouse_gin_items_on_entered_unit_id"
    t.index ["gin_id"], name: "index_cats_warehouse_gin_items_on_gin_id"
    t.index ["inventory_lot_id"], name: "index_cats_warehouse_gin_items_on_inventory_lot_id"
    t.index ["stack_id"], name: "index_cats_warehouse_gin_items_on_stack_id"
    t.index ["store_id"], name: "index_cats_warehouse_gin_items_on_store_id"
    t.index ["unit_id"], name: "index_cats_warehouse_gin_items_on_unit_id"
  end

  create_table "cats_warehouse_gins", force: :cascade do |t|
    t.string "reference_no"
    t.bigint "warehouse_id", null: false
    t.date "issued_on", null: false
    t.string "destination_type"
    t.bigint "destination_id"
    t.string "status", default: "Draft", null: false
    t.bigint "issued_by_id", null: false
    t.bigint "approved_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "dispatch_order_id"
    t.string "workflow_status"
    t.bigint "generated_from_waybill_id"
    t.index ["approved_by_id"], name: "index_cats_warehouse_gins_on_approved_by_id"
    t.index ["destination_type", "destination_id"], name: "index_cats_warehouse_gins_on_destination"
    t.index ["dispatch_order_id"], name: "index_cats_warehouse_gins_on_dispatch_order_id"
    t.index ["generated_from_waybill_id"], name: "index_cats_warehouse_gins_on_generated_from_waybill_id"
    t.index ["issued_by_id"], name: "index_cats_warehouse_gins_on_issued_by_id"
    t.index ["warehouse_id"], name: "index_cats_warehouse_gins_on_warehouse_id"
  end

  create_table "cats_warehouse_grn_items", force: :cascade do |t|
    t.bigint "grn_id", null: false
    t.bigint "commodity_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.string "quality_status"
    t.bigint "store_id"
    t.bigint "stack_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "inventory_lot_id"
    t.bigint "entered_unit_id"
    t.bigint "base_unit_id"
    t.decimal "base_quantity", precision: 15, scale: 3
    t.index ["base_unit_id"], name: "index_cats_warehouse_grn_items_on_base_unit_id"
    t.index ["commodity_id"], name: "index_cats_warehouse_grn_items_on_commodity_id"
    t.index ["entered_unit_id"], name: "index_cats_warehouse_grn_items_on_entered_unit_id"
    t.index ["grn_id"], name: "index_cats_warehouse_grn_items_on_grn_id"
    t.index ["inventory_lot_id"], name: "index_cats_warehouse_grn_items_on_inventory_lot_id"
    t.index ["stack_id"], name: "index_cats_warehouse_grn_items_on_stack_id"
    t.index ["store_id"], name: "index_cats_warehouse_grn_items_on_store_id"
    t.index ["unit_id"], name: "index_cats_warehouse_grn_items_on_unit_id"
  end

  create_table "cats_warehouse_grns", force: :cascade do |t|
    t.string "reference_no"
    t.bigint "warehouse_id", null: false
    t.date "received_on", null: false
    t.string "source_type"
    t.bigint "source_id"
    t.string "status", default: "Draft", null: false
    t.bigint "received_by_id", null: false
    t.bigint "approved_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "receipt_order_id"
    t.string "workflow_status"
    t.bigint "generated_from_inspection_id"
    t.index ["approved_by_id"], name: "index_cats_warehouse_grns_on_approved_by_id"
    t.index ["generated_from_inspection_id"], name: "index_cats_warehouse_grns_on_generated_from_inspection_id"
    t.index ["receipt_order_id"], name: "index_cats_warehouse_grns_on_receipt_order_id"
    t.index ["received_by_id"], name: "index_cats_warehouse_grns_on_received_by_id"
    t.index ["source_type", "source_id"], name: "index_cats_warehouse_grns_on_source"
    t.index ["warehouse_id"], name: "index_cats_warehouse_grns_on_warehouse_id"
  end

  create_table "cats_warehouse_hub_access", force: :cascade do |t|
    t.bigint "hub_id", null: false
    t.boolean "has_loading_dock"
    t.integer "number_of_loading_docks"
    t.string "loading_dock_type"
    t.string "access_road_type"
    t.string "nearest_town"
    t.float "distance_from_town_km"
    t.boolean "has_weighbridge"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["hub_id"], name: "index_cats_warehouse_hub_access_on_hub_id"
  end

  create_table "cats_warehouse_hub_capacity", force: :cascade do |t|
    t.bigint "hub_id", null: false
    t.float "total_area_sqm"
    t.float "total_capacity_mt"
    t.integer "construction_year"
    t.string "ownership_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["hub_id"], name: "index_cats_warehouse_hub_capacity_on_hub_id"
  end

  create_table "cats_warehouse_hub_contacts", force: :cascade do |t|
    t.bigint "hub_id", null: false
    t.string "manager_name"
    t.string "contact_phone"
    t.string "contact_email"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["hub_id"], name: "index_cats_warehouse_hub_contacts_on_hub_id"
  end

  create_table "cats_warehouse_hub_infra", force: :cascade do |t|
    t.bigint "hub_id", null: false
    t.string "floor_type"
    t.string "roof_type"
    t.boolean "has_ventilation"
    t.boolean "has_drainage_system"
    t.boolean "has_fumigation_facility"
    t.boolean "has_pest_control"
    t.boolean "has_fire_extinguisher"
    t.boolean "has_security_guard"
    t.string "security_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["hub_id"], name: "index_cats_warehouse_hub_infra_on_hub_id"
  end

  create_table "cats_warehouse_hubs", force: :cascade do |t|
    t.bigint "location_id", null: false
    t.bigint "geo_id"
    t.string "code"
    t.string "name", null: false
    t.string "hub_type"
    t.string "status"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["geo_id"], name: "index_cats_warehouse_hubs_on_geo_id"
    t.index ["location_id"], name: "index_cats_warehouse_hubs_on_location_id"
  end

  create_table "cats_warehouse_inspection_items", force: :cascade do |t|
    t.bigint "inspection_id", null: false
    t.bigint "commodity_id", null: false
    t.float "quantity_received", null: false
    t.float "quantity_damaged", default: 0.0, null: false
    t.float "quantity_lost", default: 0.0, null: false
    t.string "quality_status"
    t.string "packaging_condition"
    t.text "remarks"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "inventory_lot_id"
    t.bigint "entered_unit_id"
    t.bigint "base_unit_id"
    t.decimal "base_quantity", precision: 15, scale: 3
    t.index ["base_unit_id"], name: "index_cats_warehouse_inspection_items_on_base_unit_id"
    t.index ["commodity_id"], name: "index_cats_warehouse_inspection_items_on_commodity_id"
    t.index ["entered_unit_id"], name: "index_cats_warehouse_inspection_items_on_entered_unit_id"
    t.index ["inspection_id"], name: "index_cats_warehouse_inspection_items_on_inspection_id"
    t.index ["inventory_lot_id"], name: "index_cats_warehouse_inspection_items_on_inventory_lot_id"
  end

  create_table "cats_warehouse_inspections", force: :cascade do |t|
    t.string "reference_no"
    t.bigint "warehouse_id", null: false
    t.date "inspected_on", null: false
    t.bigint "inspector_id", null: false
    t.string "source_type"
    t.bigint "source_id"
    t.string "status", default: "Draft", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "receipt_order_id"
    t.bigint "dispatch_order_id"
    t.string "result_status"
    t.bigint "auto_generated_grn_id"
    t.bigint "auto_generated_gin_id"
    t.index ["auto_generated_gin_id"], name: "index_cats_warehouse_inspections_on_auto_generated_gin_id"
    t.index ["auto_generated_grn_id"], name: "index_cats_warehouse_inspections_on_auto_generated_grn_id"
    t.index ["dispatch_order_id"], name: "index_cats_warehouse_inspections_on_dispatch_order_id"
    t.index ["inspector_id"], name: "index_cats_warehouse_inspections_on_inspector_id"
    t.index ["receipt_order_id"], name: "index_cats_warehouse_inspections_on_receipt_order_id"
    t.index ["source_type", "source_id"], name: "index_cats_warehouse_inspections_on_source"
    t.index ["warehouse_id"], name: "index_cats_warehouse_inspections_on_warehouse_id"
  end

  create_table "cats_warehouse_inventory_adjustments", force: :cascade do |t|
    t.string "reference_no"
    t.float "quantity"
    t.string "reason_for_adjustment"
    t.date "adjustment_date", null: false
    t.string "status", default: "Draft", null: false
    t.bigint "unit_id", null: false
    t.bigint "stack_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["stack_id"], name: "index_cats_warehouse_inventory_adjustments_on_stack_id"
    t.index ["unit_id"], name: "index_cats_warehouse_inventory_adjustments_on_unit_id"
  end

  create_table "cats_warehouse_inventory_lots", force: :cascade do |t|
    t.bigint "commodity_id", null: false
    t.string "batch_no", null: false
    t.date "expiry_date"
    t.string "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "warehouse_id"
    t.string "source_type"
    t.bigint "source_id"
    t.string "lot_code"
    t.date "manufactured_on"
    t.date "received_on"
    t.string "status", default: "Active"
    t.index ["commodity_id"], name: "index_cats_warehouse_inventory_lots_on_commodity_id"
    t.index ["source_type", "source_id"], name: "index_cats_warehouse_inventory_lots_on_source"
    t.index ["warehouse_id", "commodity_id", "batch_no", "expiry_date"], name: "idx_lot_warehouse_commodity_batch_expiry", unique: true
    t.index ["warehouse_id"], name: "index_cats_warehouse_inventory_lots_on_warehouse_id"
  end

  create_table "cats_warehouse_receipt_order_assignments", force: :cascade do |t|
    t.bigint "receipt_order_id", null: false
    t.bigint "receipt_order_line_id"
    t.bigint "hub_id"
    t.bigint "warehouse_id"
    t.bigint "store_id"
    t.bigint "assigned_by_id", null: false
    t.bigint "assigned_to_id"
    t.decimal "quantity", precision: 15, scale: 3
    t.string "status", default: "Assigned", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["assigned_by_id"], name: "idx_cw_ro_assign_by"
    t.index ["assigned_to_id"], name: "idx_cw_ro_assign_to"
    t.index ["hub_id"], name: "idx_cw_ro_assign_hub"
    t.index ["receipt_order_id"], name: "idx_cw_ro_assign_order"
    t.index ["receipt_order_line_id"], name: "idx_cw_ro_assign_line"
    t.index ["status"], name: "index_cats_warehouse_receipt_order_assignments_on_status"
    t.index ["store_id"], name: "idx_cw_ro_assign_store"
    t.index ["warehouse_id"], name: "idx_cw_ro_assign_wh"
  end

  create_table "cats_warehouse_receipt_order_lines", force: :cascade do |t|
    t.bigint "receipt_order_id", null: false
    t.bigint "commodity_id", null: false
    t.decimal "quantity", precision: 15, scale: 2, null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.decimal "unit_price", precision: 15, scale: 4
    t.text "notes"
    t.index ["commodity_id"], name: "index_cats_warehouse_receipt_order_lines_on_commodity_id"
    t.index ["receipt_order_id"], name: "index_receipt_order_lines_on_order_id"
    t.index ["unit_id"], name: "index_cats_warehouse_receipt_order_lines_on_unit_id"
  end

  create_table "cats_warehouse_receipt_orders", force: :cascade do |t|
    t.string "reference_no"
    t.string "status", default: "Draft", null: false
    t.bigint "hub_id"
    t.bigint "warehouse_id"
    t.string "source_type"
    t.bigint "source_id"
    t.string "source_document_no"
    t.date "received_date"
    t.bigint "created_by_id"
    t.bigint "confirmed_by_id"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "name"
    t.datetime "confirmed_at"
    t.index ["confirmed_by_id"], name: "index_cats_warehouse_receipt_orders_on_confirmed_by_id"
    t.index ["created_by_id"], name: "index_cats_warehouse_receipt_orders_on_created_by_id"
    t.index ["hub_id"], name: "index_cats_warehouse_receipt_orders_on_hub_id"
    t.index ["reference_no"], name: "index_cats_warehouse_receipt_orders_on_reference_no", unique: true
    t.index ["status"], name: "index_cats_warehouse_receipt_orders_on_status"
    t.index ["warehouse_id"], name: "index_cats_warehouse_receipt_orders_on_warehouse_id"
  end

  create_table "cats_warehouse_space_reservations", force: :cascade do |t|
    t.bigint "receipt_order_id", null: false
    t.bigint "receipt_order_line_id", null: false
    t.bigint "receipt_order_assignment_id"
    t.bigint "warehouse_id", null: false
    t.bigint "store_id"
    t.decimal "reserved_quantity", precision: 15, scale: 3
    t.decimal "reserved_volume", precision: 15, scale: 3
    t.string "status", default: "Reserved", null: false
    t.bigint "reserved_by_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["receipt_order_assignment_id"], name: "idx_cw_space_res_assign"
    t.index ["receipt_order_id"], name: "idx_cw_space_res_order"
    t.index ["receipt_order_line_id", "warehouse_id", "store_id"], name: "idx_cw_space_reservations_line_location", unique: true
    t.index ["receipt_order_line_id"], name: "idx_cw_space_res_line"
    t.index ["reserved_by_id"], name: "idx_cw_space_res_by"
    t.index ["status"], name: "index_cats_warehouse_space_reservations_on_status"
    t.index ["store_id"], name: "idx_cw_space_res_store"
    t.index ["warehouse_id"], name: "idx_cw_space_res_wh"
  end

  create_table "cats_warehouse_stack_transactions", force: :cascade do |t|
    t.bigint "source_id"
    t.bigint "destination_id"
    t.date "transaction_date", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.string "status", default: "Draft", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "reference_type"
    t.bigint "reference_id"
    t.bigint "inventory_lot_id"
    t.bigint "entered_unit_id"
    t.bigint "base_unit_id"
    t.decimal "base_quantity", precision: 15, scale: 3
    t.index ["base_unit_id"], name: "index_cats_warehouse_stack_transactions_on_base_unit_id"
    t.index ["destination_id"], name: "destination_on_cwst_indx"
    t.index ["entered_unit_id"], name: "index_cats_warehouse_stack_transactions_on_entered_unit_id"
    t.index ["inventory_lot_id"], name: "index_cats_warehouse_stack_transactions_on_inventory_lot_id"
    t.index ["source_id"], name: "source_on_cwst_indx"
    t.index ["unit_id"], name: "unit_on_cwst_indx"
  end

  create_table "cats_warehouse_stacking_rules", force: :cascade do |t|
    t.bigint "warehouse_id", null: false
    t.float "distance_from_wall", null: false
    t.float "space_between_stack", null: false
    t.float "distance_from_ceiling", null: false
    t.float "maximum_height", null: false
    t.float "maximum_length", null: false
    t.float "maximum_width", null: false
    t.float "distance_from_gangway", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["warehouse_id"], name: "index_cats_warehouse_stacking_rules_on_warehouse_id"
  end

  create_table "cats_warehouse_stacks", force: :cascade do |t|
    t.string "code"
    t.float "length", null: false
    t.float "width", null: false
    t.float "height", null: false
    t.float "start_x"
    t.float "start_y"
    t.bigint "commodity_id", null: false
    t.bigint "store_id", null: false
    t.string "commodity_status", default: "Good", null: false
    t.string "stack_status", default: "Reserved", null: false
    t.float "quantity", default: 0.0, null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "base_unit_id"
    t.decimal "base_quantity", precision: 15, scale: 3
    t.index ["base_unit_id"], name: "index_cats_warehouse_stacks_on_base_unit_id"
    t.index ["commodity_id"], name: "index_cats_warehouse_stacks_on_commodity_id"
    t.index ["store_id"], name: "index_cats_warehouse_stacks_on_store_id"
    t.index ["unit_id"], name: "index_cats_warehouse_stacks_on_unit_id"
    t.check_constraint "quantity >= 0::double precision", name: "cw_stacks_quantity_non_negative"
  end

  create_table "cats_warehouse_stock_balances", force: :cascade do |t|
    t.bigint "warehouse_id", null: false
    t.bigint "store_id"
    t.bigint "stack_id"
    t.bigint "commodity_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "inventory_lot_id"
    t.bigint "entered_unit_id"
    t.bigint "base_unit_id"
    t.decimal "base_quantity", precision: 15, scale: 3
    t.decimal "reserved_quantity", precision: 15, scale: 3, default: "0.0", null: false
    t.decimal "available_quantity", precision: 15, scale: 3
    t.index "warehouse_id, COALESCE(store_id, ('-1'::integer)::bigint), COALESCE(stack_id, ('-1'::integer)::bigint), commodity_id, unit_id", name: "idx_cats_warehouse_stock_balances_unique_dimension", unique: true
    t.index ["base_unit_id"], name: "index_cats_warehouse_stock_balances_on_base_unit_id"
    t.index ["commodity_id"], name: "index_cats_warehouse_stock_balances_on_commodity_id"
    t.index ["entered_unit_id"], name: "index_cats_warehouse_stock_balances_on_entered_unit_id"
    t.index ["inventory_lot_id"], name: "index_cats_warehouse_stock_balances_on_inventory_lot_id"
    t.index ["stack_id"], name: "index_cats_warehouse_stock_balances_on_stack_id"
    t.index ["store_id"], name: "index_cats_warehouse_stock_balances_on_store_id"
    t.index ["unit_id"], name: "index_cats_warehouse_stock_balances_on_unit_id"
    t.index ["warehouse_id"], name: "index_cats_warehouse_stock_balances_on_warehouse_id"
    t.check_constraint "quantity >= 0::double precision", name: "cw_stock_balances_quantity_non_negative"
  end

  create_table "cats_warehouse_stock_reservations", force: :cascade do |t|
    t.bigint "dispatch_order_id", null: false
    t.bigint "dispatch_order_line_id", null: false
    t.bigint "warehouse_id", null: false
    t.bigint "store_id"
    t.bigint "stack_id"
    t.bigint "commodity_id", null: false
    t.bigint "unit_id", null: false
    t.bigint "inventory_lot_id"
    t.decimal "reserved_quantity", precision: 15, scale: 3, null: false
    t.decimal "issued_quantity", precision: 15, scale: 3, default: "0.0", null: false
    t.string "status", default: "Reserved", null: false
    t.bigint "reserved_by_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["commodity_id"], name: "idx_cw_stock_res_comm"
    t.index ["dispatch_order_id"], name: "idx_cw_stock_res_order"
    t.index ["dispatch_order_line_id", "warehouse_id", "store_id", "stack_id", "inventory_lot_id"], name: "idx_cw_stock_reservations_line_location", unique: true
    t.index ["dispatch_order_line_id"], name: "idx_cw_stock_res_line"
    t.index ["inventory_lot_id"], name: "idx_cw_stock_res_lot"
    t.index ["reserved_by_id"], name: "idx_cw_stock_res_by"
    t.index ["stack_id"], name: "idx_cw_stock_res_stack"
    t.index ["status"], name: "index_cats_warehouse_stock_reservations_on_status"
    t.index ["store_id"], name: "idx_cw_stock_res_store"
    t.index ["unit_id"], name: "idx_cw_stock_res_unit"
    t.index ["warehouse_id"], name: "idx_cw_stock_res_wh"
  end

  create_table "cats_warehouse_stores", force: :cascade do |t|
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
    t.index ["warehouse_id"], name: "index_cats_warehouse_stores_on_warehouse_id"
  end

  create_table "cats_warehouse_uom_conversions", force: :cascade do |t|
    t.bigint "commodity_id"
    t.bigint "from_unit_id", null: false
    t.bigint "to_unit_id", null: false
    t.decimal "multiplier", precision: 15, scale: 6, null: false
    t.boolean "is_inter_unit", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "conversion_type"
    t.boolean "active", default: true, null: false
    t.index ["commodity_id"], name: "index_cats_warehouse_uom_conversions_on_commodity_id"
    t.index ["from_unit_id"], name: "index_cats_warehouse_uom_conversions_on_from_unit_id"
    t.index ["to_unit_id"], name: "index_cats_warehouse_uom_conversions_on_to_unit_id"
  end

  create_table "cats_warehouse_user_assignments", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "hub_id"
    t.bigint "warehouse_id"
    t.bigint "store_id"
    t.string "role_name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["hub_id"], name: "index_cats_warehouse_user_assignments_on_hub_id"
    t.index ["store_id"], name: "index_cats_warehouse_user_assignments_on_store_id"
    t.index ["user_id", "hub_id"], name: "idx_cwua_user_hub", unique: true, where: "(hub_id IS NOT NULL)"
    t.index ["user_id", "store_id"], name: "idx_cwua_user_store", unique: true, where: "(store_id IS NOT NULL)"
    t.index ["user_id", "warehouse_id"], name: "idx_cwua_user_warehouse", unique: true, where: "(warehouse_id IS NOT NULL)"
    t.index ["user_id"], name: "index_cats_warehouse_user_assignments_on_user_id"
    t.index ["warehouse_id"], name: "index_cats_warehouse_user_assignments_on_warehouse_id"
  end

  create_table "cats_warehouse_warehouse_access", force: :cascade do |t|
    t.bigint "warehouse_id", null: false
    t.boolean "has_loading_dock"
    t.integer "number_of_loading_docks"
    t.string "access_road_type"
    t.string "nearest_town"
    t.float "distance_from_town_km"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "loading_dock_type"
    t.index ["warehouse_id"], name: "index_cats_warehouse_warehouse_access_on_warehouse_id"
  end

  create_table "cats_warehouse_warehouse_capacity", force: :cascade do |t|
    t.bigint "warehouse_id", null: false
    t.float "total_area_sqm"
    t.float "total_storage_capacity_mt"
    t.float "usable_storage_capacity_mt"
    t.integer "no_of_stores"
    t.integer "construction_year"
    t.string "ownership_type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.float "length_m"
    t.float "width_m"
    t.float "height_m"
    t.index ["warehouse_id"], name: "index_cats_warehouse_warehouse_capacity_on_warehouse_id"
  end

  create_table "cats_warehouse_warehouse_contacts", force: :cascade do |t|
    t.bigint "warehouse_id", null: false
    t.string "manager_name"
    t.string "contact_phone"
    t.string "contact_email"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["warehouse_id"], name: "index_cats_warehouse_warehouse_contacts_on_warehouse_id"
  end

  create_table "cats_warehouse_warehouse_infra", force: :cascade do |t|
    t.bigint "warehouse_id", null: false
    t.string "floor_type"
    t.string "roof_type"
    t.boolean "has_fumigation_facility"
    t.boolean "has_fire_extinguisher"
    t.boolean "has_security_guard"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["warehouse_id"], name: "index_cats_warehouse_warehouse_infra_on_warehouse_id"
  end

  create_table "cats_warehouse_warehouses", force: :cascade do |t|
    t.bigint "location_id", null: false
    t.bigint "hub_id"
    t.bigint "geo_id"
    t.string "code"
    t.string "name", null: false
    t.string "warehouse_type"
    t.string "status"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "managed_under"
    t.string "ownership_type", default: "self_owned", null: false
    t.index ["geo_id"], name: "index_cats_warehouse_warehouses_on_geo_id"
    t.index ["hub_id"], name: "index_cats_warehouse_warehouses_on_hub_id"
    t.index ["location_id"], name: "index_cats_warehouse_warehouses_on_location_id"
    t.index ["managed_under"], name: "index_cats_warehouse_warehouses_on_managed_under"
    t.index ["ownership_type"], name: "index_cats_warehouse_warehouses_on_ownership_type"
  end

  create_table "cats_warehouse_waybill_items", force: :cascade do |t|
    t.bigint "waybill_id", null: false
    t.bigint "commodity_id", null: false
    t.float "quantity", null: false
    t.bigint "unit_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "inventory_lot_id"
    t.bigint "entered_unit_id"
    t.bigint "base_unit_id"
    t.decimal "base_quantity", precision: 15, scale: 3
    t.index ["base_unit_id"], name: "index_cats_warehouse_waybill_items_on_base_unit_id"
    t.index ["commodity_id"], name: "index_cats_warehouse_waybill_items_on_commodity_id"
    t.index ["entered_unit_id"], name: "index_cats_warehouse_waybill_items_on_entered_unit_id"
    t.index ["inventory_lot_id"], name: "index_cats_warehouse_waybill_items_on_inventory_lot_id"
    t.index ["unit_id"], name: "index_cats_warehouse_waybill_items_on_unit_id"
    t.index ["waybill_id"], name: "index_cats_warehouse_waybill_items_on_waybill_id"
  end

  create_table "cats_warehouse_waybill_transport", force: :cascade do |t|
    t.bigint "waybill_id", null: false
    t.bigint "transporter_id", null: false
    t.string "vehicle_plate_no"
    t.string "driver_name"
    t.string "driver_phone"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["transporter_id"], name: "index_cats_warehouse_waybill_transport_on_transporter_id"
    t.index ["waybill_id"], name: "index_cats_warehouse_waybill_transport_on_waybill_id"
  end

  create_table "cats_warehouse_waybills", force: :cascade do |t|
    t.string "reference_no"
    t.bigint "dispatch_id"
    t.bigint "source_location_id", null: false
    t.bigint "destination_location_id", null: false
    t.date "issued_on", null: false
    t.string "status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "dispatch_order_id"
    t.bigint "prepared_by_id"
    t.string "workflow_status"
    t.bigint "auto_generated_gin_id"
    t.index ["auto_generated_gin_id"], name: "index_cats_warehouse_waybills_on_auto_generated_gin_id"
    t.index ["destination_location_id"], name: "index_cats_warehouse_waybills_on_destination_location_id"
    t.index ["dispatch_id"], name: "index_cats_warehouse_waybills_on_dispatch_id"
    t.index ["dispatch_order_id"], name: "index_cats_warehouse_waybills_on_dispatch_order_id"
    t.index ["prepared_by_id"], name: "index_cats_warehouse_waybills_on_prepared_by_id"
    t.index ["source_location_id"], name: "index_cats_warehouse_waybills_on_source_location_id"
  end

  create_table "cats_warehouse_workflow_events", force: :cascade do |t|
    t.string "entity_type", null: false
    t.bigint "entity_id", null: false
    t.string "event_type", null: false
    t.string "from_status"
    t.string "to_status"
    t.bigint "actor_id"
    t.jsonb "payload"
    t.datetime "occurred_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["actor_id"], name: "idx_cw_workflow_actor"
    t.index ["entity_type", "entity_id", "occurred_at"], name: "idx_cw_workflow_events_entity_time"
    t.index ["event_type"], name: "index_cats_warehouse_workflow_events_on_event_type"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
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
  add_foreign_key "cats_core_commodities", "cats_core_commodity_categories", column: "commodity_category_id"
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
  add_foreign_key "cats_core_gift_certificates", "cats_core_cash_donations", column: "cash_donation_id"
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
  add_foreign_key "cats_core_transport_contracts", "cats_core_locations", column: "region_id"
  add_foreign_key "cats_core_transport_contracts", "cats_core_transport_bids", column: "transport_bid_id"
  add_foreign_key "cats_core_transport_contracts", "cats_core_transporters", column: "transporter_id"
  add_foreign_key "cats_core_transport_offers", "cats_core_transport_bids", column: "transport_bid_id"
  add_foreign_key "cats_core_transport_offers", "cats_core_transporters", column: "transporter_id"
  add_foreign_key "cats_core_transport_order_items", "cats_core_routes", column: "route_id"
  add_foreign_key "cats_core_transport_order_items", "cats_core_transport_contracts", column: "transport_contract_id"
  add_foreign_key "cats_core_transport_order_items", "cats_core_transport_orders", column: "transport_order_id"
  add_foreign_key "cats_core_transport_order_items", "cats_core_transport_requisition_items", column: "transport_requisition_item_id"
  add_foreign_key "cats_core_transport_order_items", "cats_core_transporters", column: "transporter_id"
  add_foreign_key "cats_core_transport_order_items", "cats_core_unit_of_measures", column: "unit_id"
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
  add_foreign_key "cats_warehouse_dispatch_order_assignments", "cats_core_users", column: "assigned_by_id"
  add_foreign_key "cats_warehouse_dispatch_order_assignments", "cats_core_users", column: "assigned_to_id"
  add_foreign_key "cats_warehouse_dispatch_order_assignments", "cats_warehouse_dispatch_order_lines", column: "dispatch_order_line_id"
  add_foreign_key "cats_warehouse_dispatch_order_assignments", "cats_warehouse_dispatch_orders", column: "dispatch_order_id"
  add_foreign_key "cats_warehouse_dispatch_order_assignments", "cats_warehouse_hubs", column: "hub_id"
  add_foreign_key "cats_warehouse_dispatch_order_assignments", "cats_warehouse_stores", column: "store_id"
  add_foreign_key "cats_warehouse_dispatch_order_assignments", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_dispatch_order_lines", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_warehouse_dispatch_order_lines", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_warehouse_dispatch_order_lines", "cats_warehouse_dispatch_orders", column: "dispatch_order_id"
  add_foreign_key "cats_warehouse_dispatch_orders", "cats_core_users", column: "confirmed_by_id"
  add_foreign_key "cats_warehouse_dispatch_orders", "cats_core_users", column: "created_by_id"
  add_foreign_key "cats_warehouse_dispatch_orders", "cats_warehouse_hubs", column: "hub_id"
  add_foreign_key "cats_warehouse_dispatch_orders", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_gin_items", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_warehouse_gin_items", "cats_core_unit_of_measures", column: "base_unit_id"
  add_foreign_key "cats_warehouse_gin_items", "cats_core_unit_of_measures", column: "entered_unit_id"
  add_foreign_key "cats_warehouse_gin_items", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_warehouse_gin_items", "cats_warehouse_gins", column: "gin_id"
  add_foreign_key "cats_warehouse_gin_items", "cats_warehouse_inventory_lots", column: "inventory_lot_id"
  add_foreign_key "cats_warehouse_gin_items", "cats_warehouse_stacks", column: "stack_id"
  add_foreign_key "cats_warehouse_gin_items", "cats_warehouse_stores", column: "store_id"
  add_foreign_key "cats_warehouse_gins", "cats_core_users", column: "approved_by_id"
  add_foreign_key "cats_warehouse_gins", "cats_core_users", column: "issued_by_id"
  add_foreign_key "cats_warehouse_gins", "cats_warehouse_dispatch_orders", column: "dispatch_order_id"
  add_foreign_key "cats_warehouse_gins", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_gins", "cats_warehouse_waybills", column: "generated_from_waybill_id"
  add_foreign_key "cats_warehouse_grn_items", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_warehouse_grn_items", "cats_core_unit_of_measures", column: "base_unit_id"
  add_foreign_key "cats_warehouse_grn_items", "cats_core_unit_of_measures", column: "entered_unit_id"
  add_foreign_key "cats_warehouse_grn_items", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_warehouse_grn_items", "cats_warehouse_grns", column: "grn_id"
  add_foreign_key "cats_warehouse_grn_items", "cats_warehouse_inventory_lots", column: "inventory_lot_id"
  add_foreign_key "cats_warehouse_grn_items", "cats_warehouse_stacks", column: "stack_id"
  add_foreign_key "cats_warehouse_grn_items", "cats_warehouse_stores", column: "store_id"
  add_foreign_key "cats_warehouse_grns", "cats_core_users", column: "approved_by_id"
  add_foreign_key "cats_warehouse_grns", "cats_core_users", column: "received_by_id"
  add_foreign_key "cats_warehouse_grns", "cats_warehouse_inspections", column: "generated_from_inspection_id"
  add_foreign_key "cats_warehouse_grns", "cats_warehouse_receipt_orders", column: "receipt_order_id"
  add_foreign_key "cats_warehouse_grns", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_hub_access", "cats_warehouse_hubs", column: "hub_id"
  add_foreign_key "cats_warehouse_hub_capacity", "cats_warehouse_hubs", column: "hub_id"
  add_foreign_key "cats_warehouse_hub_contacts", "cats_warehouse_hubs", column: "hub_id"
  add_foreign_key "cats_warehouse_hub_infra", "cats_warehouse_hubs", column: "hub_id"
  add_foreign_key "cats_warehouse_hubs", "cats_core_locations", column: "location_id"
  add_foreign_key "cats_warehouse_hubs", "cats_warehouse_geos", column: "geo_id"
  add_foreign_key "cats_warehouse_inspection_items", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_warehouse_inspection_items", "cats_core_unit_of_measures", column: "base_unit_id"
  add_foreign_key "cats_warehouse_inspection_items", "cats_core_unit_of_measures", column: "entered_unit_id"
  add_foreign_key "cats_warehouse_inspection_items", "cats_warehouse_inspections", column: "inspection_id"
  add_foreign_key "cats_warehouse_inspection_items", "cats_warehouse_inventory_lots", column: "inventory_lot_id"
  add_foreign_key "cats_warehouse_inspections", "cats_core_users", column: "inspector_id"
  add_foreign_key "cats_warehouse_inspections", "cats_warehouse_dispatch_orders", column: "dispatch_order_id"
  add_foreign_key "cats_warehouse_inspections", "cats_warehouse_gins", column: "auto_generated_gin_id"
  add_foreign_key "cats_warehouse_inspections", "cats_warehouse_grns", column: "auto_generated_grn_id"
  add_foreign_key "cats_warehouse_inspections", "cats_warehouse_receipt_orders", column: "receipt_order_id"
  add_foreign_key "cats_warehouse_inspections", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_inventory_adjustments", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_warehouse_inventory_adjustments", "cats_warehouse_stacks", column: "stack_id"
  add_foreign_key "cats_warehouse_inventory_lots", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_warehouse_inventory_lots", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_receipt_order_assignments", "cats_core_users", column: "assigned_by_id"
  add_foreign_key "cats_warehouse_receipt_order_assignments", "cats_core_users", column: "assigned_to_id"
  add_foreign_key "cats_warehouse_receipt_order_assignments", "cats_warehouse_hubs", column: "hub_id"
  add_foreign_key "cats_warehouse_receipt_order_assignments", "cats_warehouse_receipt_order_lines", column: "receipt_order_line_id"
  add_foreign_key "cats_warehouse_receipt_order_assignments", "cats_warehouse_receipt_orders", column: "receipt_order_id"
  add_foreign_key "cats_warehouse_receipt_order_assignments", "cats_warehouse_stores", column: "store_id"
  add_foreign_key "cats_warehouse_receipt_order_assignments", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_receipt_order_lines", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_warehouse_receipt_order_lines", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_warehouse_receipt_order_lines", "cats_warehouse_receipt_orders", column: "receipt_order_id"
  add_foreign_key "cats_warehouse_receipt_orders", "cats_core_users", column: "confirmed_by_id"
  add_foreign_key "cats_warehouse_receipt_orders", "cats_core_users", column: "created_by_id"
  add_foreign_key "cats_warehouse_receipt_orders", "cats_warehouse_hubs", column: "hub_id"
  add_foreign_key "cats_warehouse_receipt_orders", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_space_reservations", "cats_core_users", column: "reserved_by_id"
  add_foreign_key "cats_warehouse_space_reservations", "cats_warehouse_receipt_order_assignments", column: "receipt_order_assignment_id"
  add_foreign_key "cats_warehouse_space_reservations", "cats_warehouse_receipt_order_lines", column: "receipt_order_line_id"
  add_foreign_key "cats_warehouse_space_reservations", "cats_warehouse_receipt_orders", column: "receipt_order_id"
  add_foreign_key "cats_warehouse_space_reservations", "cats_warehouse_stores", column: "store_id"
  add_foreign_key "cats_warehouse_space_reservations", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_stack_transactions", "cats_core_unit_of_measures", column: "base_unit_id"
  add_foreign_key "cats_warehouse_stack_transactions", "cats_core_unit_of_measures", column: "entered_unit_id"
  add_foreign_key "cats_warehouse_stack_transactions", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_warehouse_stack_transactions", "cats_warehouse_inventory_lots", column: "inventory_lot_id"
  add_foreign_key "cats_warehouse_stack_transactions", "cats_warehouse_stacks", column: "destination_id"
  add_foreign_key "cats_warehouse_stack_transactions", "cats_warehouse_stacks", column: "source_id"
  add_foreign_key "cats_warehouse_stacking_rules", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_stacks", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_warehouse_stacks", "cats_core_unit_of_measures", column: "base_unit_id"
  add_foreign_key "cats_warehouse_stacks", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_warehouse_stacks", "cats_warehouse_stores", column: "store_id"
  add_foreign_key "cats_warehouse_stock_balances", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_warehouse_stock_balances", "cats_core_unit_of_measures", column: "base_unit_id"
  add_foreign_key "cats_warehouse_stock_balances", "cats_core_unit_of_measures", column: "entered_unit_id"
  add_foreign_key "cats_warehouse_stock_balances", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_warehouse_stock_balances", "cats_warehouse_inventory_lots", column: "inventory_lot_id"
  add_foreign_key "cats_warehouse_stock_balances", "cats_warehouse_stacks", column: "stack_id"
  add_foreign_key "cats_warehouse_stock_balances", "cats_warehouse_stores", column: "store_id"
  add_foreign_key "cats_warehouse_stock_balances", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_stock_reservations", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_warehouse_stock_reservations", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_warehouse_stock_reservations", "cats_core_users", column: "reserved_by_id"
  add_foreign_key "cats_warehouse_stock_reservations", "cats_warehouse_dispatch_order_lines", column: "dispatch_order_line_id"
  add_foreign_key "cats_warehouse_stock_reservations", "cats_warehouse_dispatch_orders", column: "dispatch_order_id"
  add_foreign_key "cats_warehouse_stock_reservations", "cats_warehouse_inventory_lots", column: "inventory_lot_id"
  add_foreign_key "cats_warehouse_stock_reservations", "cats_warehouse_stacks", column: "stack_id"
  add_foreign_key "cats_warehouse_stock_reservations", "cats_warehouse_stores", column: "store_id"
  add_foreign_key "cats_warehouse_stock_reservations", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_stores", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_uom_conversions", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_warehouse_uom_conversions", "cats_core_unit_of_measures", column: "from_unit_id"
  add_foreign_key "cats_warehouse_uom_conversions", "cats_core_unit_of_measures", column: "to_unit_id"
  add_foreign_key "cats_warehouse_user_assignments", "cats_core_users", column: "user_id"
  add_foreign_key "cats_warehouse_user_assignments", "cats_warehouse_hubs", column: "hub_id"
  add_foreign_key "cats_warehouse_user_assignments", "cats_warehouse_stores", column: "store_id"
  add_foreign_key "cats_warehouse_user_assignments", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_warehouse_access", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_warehouse_capacity", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_warehouse_contacts", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_warehouse_infra", "cats_warehouse_warehouses", column: "warehouse_id"
  add_foreign_key "cats_warehouse_warehouses", "cats_core_locations", column: "location_id"
  add_foreign_key "cats_warehouse_warehouses", "cats_warehouse_geos", column: "geo_id"
  add_foreign_key "cats_warehouse_warehouses", "cats_warehouse_hubs", column: "hub_id"
  add_foreign_key "cats_warehouse_waybill_items", "cats_core_commodities", column: "commodity_id"
  add_foreign_key "cats_warehouse_waybill_items", "cats_core_unit_of_measures", column: "base_unit_id"
  add_foreign_key "cats_warehouse_waybill_items", "cats_core_unit_of_measures", column: "entered_unit_id"
  add_foreign_key "cats_warehouse_waybill_items", "cats_core_unit_of_measures", column: "unit_id"
  add_foreign_key "cats_warehouse_waybill_items", "cats_warehouse_inventory_lots", column: "inventory_lot_id"
  add_foreign_key "cats_warehouse_waybill_items", "cats_warehouse_waybills", column: "waybill_id"
  add_foreign_key "cats_warehouse_waybill_transport", "cats_core_transporters", column: "transporter_id"
  add_foreign_key "cats_warehouse_waybill_transport", "cats_warehouse_waybills", column: "waybill_id"
  add_foreign_key "cats_warehouse_waybills", "cats_core_dispatches", column: "dispatch_id"
  add_foreign_key "cats_warehouse_waybills", "cats_core_locations", column: "destination_location_id"
  add_foreign_key "cats_warehouse_waybills", "cats_core_locations", column: "source_location_id"
  add_foreign_key "cats_warehouse_waybills", "cats_core_users", column: "prepared_by_id"
  add_foreign_key "cats_warehouse_waybills", "cats_warehouse_dispatch_orders", column: "dispatch_order_id"
  add_foreign_key "cats_warehouse_waybills", "cats_warehouse_gins", column: "auto_generated_gin_id"
  add_foreign_key "cats_warehouse_workflow_events", "cats_core_users", column: "actor_id"
end
