module Cats
  module Warehouse
    module InAppNotifications
      # Phase 2 recipient matrix (same pattern as phase 1; all rows include params["path"]):
      # - receipt_authorization.created / .cancelled → Warehouse Managers (RA warehouse) + Storekeepers (RA store)
      # - receipt_authorization.driver_confirmed → WM (warehouse) + Storekeepers (store)
      # - receipt_authorization.grn_confirmed → Hub Managers (order hub) + WM (RA warehouse)
      # - inspection.confirmed → WM (inspection warehouse); Hub Managers + RO stakeholders if receipt_order;
      #   Storekeepers if linked receipt_authorization
      # - dispatch_order.confirmed → Hub Managers (order hub) + WM (order warehouse)
      # - grn.confirmed / gin.confirmed → Hub Managers (warehouse's hub) + WM (warehouse)
      # - waybill.confirmed → same hub+WM resolution via dispatch_order.warehouse
      #
      # Resolves domain notification jobs into one `cats_core_notifications` row per recipient,
      # with server-computed `params["path"]` for the SPA.
      class Creator
        include ContractConstants

        class << self
          def call(event, payload)
            new(event: event.to_s, payload: normalize_payload(payload)).call
          end

          def enabled?
            ENV["ENABLE_IN_APP_NOTIFICATIONS"] != "false"
          end

          private

          def normalize_payload(payload)
            h = payload.respond_to?(:deep_symbolize_keys) ? payload.deep_symbolize_keys : payload.to_h.deep_symbolize_keys
            h
          end
        end

        def initialize(event:, payload:)
          @event = event
          @payload = payload
        end

        def call
          return unless self.class.enabled?

          rows = resolve_rows
          return if rows.blank?

          now = Time.current
          InAppNotification.insert_all(
            rows.map do |r|
              {
                recipient_type: "Cats::Core::User",
                recipient_id: r[:user].id,
                type: @event,
                params: stringify_params(r[:params]),
                read_at: nil,
                created_at: now,
                updated_at: now
              }
            end
          )
        end

        private

        def stringify_params(h)
          (h || {}).stringify_keys
        end

        def resolve_rows
          case @event
          when "receipt_order.confirmed"
            rows_receipt_order_confirmed
          when "receipt_order.assigned"
            rows_receipt_order_assigned
          when "receipt_order.completed"
            rows_receipt_order_completed
          when "receipt_authorization.created", "receipt_authorization.cancelled"
            rows_receipt_authorization_facility(@event)
          when "receipt_authorization.driver_confirmed"
            rows_receipt_authorization_driver_confirmed
          when "receipt_authorization.grn_confirmed"
            rows_receipt_authorization_grn_confirmed
          when "inspection.confirmed"
            rows_inspection_confirmed
          when "dispatch_order.confirmed"
            rows_dispatch_order_confirmed
          when "grn.confirmed"
            rows_grn_confirmed
          when "gin.confirmed"
            rows_gin_confirmed
          when "waybill.confirmed"
            rows_waybill_confirmed
          else
            []
          end
        end

        # --- Phase 1: receipt orders -------------------------------------------------

        def rows_receipt_order_confirmed
          order = ReceiptOrder.find_by(id: payload_value(:receipt_order_id))
          return [] unless order

          hub_ids = [].tap do |a|
            a << order.hub_id if order.hub_id.present?
            order.receipt_order_lines.each { |l| a << l.destination_hub_id if l.destination_hub_id.present? }
            order.receipt_order_assignments.each { |as| a << as.hub_id if as.hub_id.present? }
          end.uniq.compact

          warehouse_ids = [].tap do |a|
            a << order.warehouse_id if order.warehouse_id.present?
            order.receipt_order_lines.each { |l| a << l.destination_warehouse_id if l.destination_warehouse_id.present? }
            order.receipt_order_assignments.each { |as| a << as.warehouse_id if as.warehouse_id.present? }
          end.uniq.compact

          users = {}
          hub_ids.each do |hid|
            facility_users(role_name: "Hub Manager", hub_id: hid).each { |u| users[u.id] = u }
          end
          warehouse_ids.each do |wid|
            facility_users(role_name: "Warehouse Manager", warehouse_id: wid).each { |u| users[u.id] = u }
          end

          order.receipt_order_assignments.each do |as|
            next unless as.store_id.present? && as.assigned_to_id.present?

            u = Cats::Core::User.find_by(id: as.assigned_to_id)
            users[u.id] = u if u&.active?
          end

          base_params = receipt_order_base_params(order)
          users.values.map { |u| { user: u, params: base_params.merge("path" => Paths.receipt_order(u, order.id)) } }
        end

        def rows_receipt_order_assigned
          order = ReceiptOrder.find_by(id: payload_value(:receipt_order_id))
          return [] unless order

          ids = Array(@payload[:assigned_to_ids] || @payload["assigned_to_ids"]).flatten.map(&:presence).compact.map(&:to_i).uniq
          base_params = receipt_order_base_params(order)

          ids.filter_map do |uid|
            u = Cats::Core::User.find_by(id: uid)
            next unless u&.active?

            { user: u, params: base_params.merge("path" => Paths.receipt_order(u, order.id)) }
          end
        end

        def rows_receipt_order_completed
          order = ReceiptOrder.find_by(id: payload_value(:receipt_order_id))
          return [] unless order

          users = {}
          [ order.created_by, order.confirmed_by ].compact.each { |u| users[u.id] = u if u&.active? }

          hub_id = order.hub_id
          warehouse_id = order.warehouse_id
          facility_users(role_name: "Hub Manager", hub_id: hub_id).each { |u| users[u.id] = u } if hub_id.present?
          if warehouse_id.present?
            facility_users(role_name: "Warehouse Manager", warehouse_id: warehouse_id).each { |u| users[u.id] = u }
          end

          base_params = receipt_order_base_params(order)
          users.values.map { |u| { user: u, params: base_params.merge("path" => Paths.receipt_order(u, order.id)) } }
        end

        # --- Phase 2: receipt authorizations ----------------------------------------

        def rows_receipt_authorization_facility(event_name)
          ra = ReceiptAuthorization.find_by(id: payload_value(:receipt_authorization_id))
          return [] unless ra&.store

          wid = ra.warehouse_id
          sid = ra.store_id
          users = {}
          facility_users(role_name: "Warehouse Manager", warehouse_id: wid).each { |u| users[u.id] = u } if wid.present?
          facility_users(role_name: "Storekeeper", store_id: sid).each { |u| users[u.id] = u } if sid.present?

          base = {
            "receipt_authorization_id" => ra.id,
            "receipt_order_id" => ra.receipt_order_id,
            "store_id" => sid,
            "warehouse_id" => wid
          }.compact

          users.values.map { |u| { user: u, params: base.merge("path" => Paths.receipt_authorization(u, ra)) } }
        end

        def rows_receipt_authorization_driver_confirmed
          ra = ReceiptAuthorization.find_by(id: payload_value(:receipt_authorization_id))
          return [] unless ra&.warehouse

          users = {}
          facility_users(role_name: "Warehouse Manager", warehouse_id: ra.warehouse_id).each { |u| users[u.id] = u }
          facility_users(role_name: "Storekeeper", store_id: ra.store_id).each { |u| users[u.id] = u } if ra.store_id.present?

          base = {
            "receipt_authorization_id" => ra.id,
            "receipt_order_id" => ra.receipt_order_id,
            "grn_id" => payload_value(:grn_id),
            "warehouse_id" => ra.warehouse_id
          }.compact

          users.values.map { |u| { user: u, params: base.merge("path" => Paths.receipt_authorization(u, ra)) } }
        end

        def rows_receipt_authorization_grn_confirmed
          ra = ReceiptAuthorization.find_by(id: payload_value(:receipt_authorization_id))
          return [] unless ra

          order = ra.receipt_order
          return [] unless order

          users = {}
          if order.hub_id.present?
            facility_users(role_name: "Hub Manager", hub_id: order.hub_id).each { |u| users[u.id] = u }
          end
          if ra.warehouse_id.present?
            facility_users(role_name: "Warehouse Manager", warehouse_id: ra.warehouse_id).each { |u| users[u.id] = u }
          end

          base = {
            "receipt_authorization_id" => ra.id,
            "receipt_order_id" => payload_value(:receipt_order_id) || ra.receipt_order_id,
            "grn_id" => payload_value(:grn_id)
          }.compact

          users.values.map { |u| { user: u, params: base.merge("path" => Paths.receipt_order(u, order.id)) } }
        end

        # --- Phase 2: inspections -----------------------------------------------------

        def rows_inspection_confirmed
          inspection = Inspection.find_by(id: payload_value(:inspection_id))
          return [] unless inspection

          users = {}
          wh_id = inspection.warehouse_id
          if wh_id.present?
            facility_users(role_name: "Warehouse Manager", warehouse_id: wh_id).each { |u| users[u.id] = u }
          end

          if inspection.receipt_order
            ro = inspection.receipt_order
            if ro.hub_id.present?
              facility_users(role_name: "Hub Manager", hub_id: ro.hub_id).each { |u| users[u.id] = u }
            end
            [ ro.created_by, ro.confirmed_by ].compact.each { |u| users[u.id] = u if u&.active? }
          end

          if inspection.receipt_authorization
            ra = inspection.receipt_authorization
            facility_users(role_name: "Storekeeper", store_id: ra.store_id).each { |u| users[u.id] = u } if ra.store_id.present?
          end

          base = {
            "inspection_id" => inspection.id,
            "warehouse_id" => wh_id,
            "receipt_order_id" => inspection.receipt_order_id,
            "receipt_authorization_id" => inspection.receipt_authorization_id
          }.compact

          users.values.map { |u| { user: u, params: base.merge("path" => Paths.inspection(u, inspection.id)) } }
        end

        # --- Phase 2: dispatch / inventory docs --------------------------------------

        def rows_dispatch_order_confirmed
          order = DispatchOrder.find_by(id: payload_value(:dispatch_order_id))
          return [] unless order

          users = {}
          facility_users(role_name: "Hub Manager", hub_id: order.hub_id).each { |u| users[u.id] = u } if order.hub_id.present?
          facility_users(role_name: "Warehouse Manager", warehouse_id: order.warehouse_id).each { |u| users[u.id] = u } if order.warehouse_id.present?

          base = { "dispatch_order_id" => order.id, "hub_id" => order.hub_id, "warehouse_id" => order.warehouse_id }.compact
          users.values.map { |u| { user: u, params: base.merge("path" => Paths.dispatch_order(u, order.id)) } }
        end

        def rows_grn_confirmed
          grn = Grn.find_by(id: payload_value(:grn_id))
          return [] unless grn&.warehouse_id

          users = rows_for_warehouse_doc(grn.warehouse_id)
          base = { "grn_id" => grn.id, "warehouse_id" => grn.warehouse_id, "receipt_order_id" => grn.receipt_order_id }.compact
          users.values.map { |u| { user: u, params: base.merge("path" => Paths.grn(u, grn.id)) } }
        end

        def rows_gin_confirmed
          gin = Gin.find_by(id: payload_value(:gin_id))
          return [] unless gin&.warehouse_id

          users = rows_for_warehouse_doc(gin.warehouse_id)
          base = { "gin_id" => gin.id, "warehouse_id" => gin.warehouse_id, "dispatch_order_id" => gin.dispatch_order_id }.compact
          users.values.map { |u| { user: u, params: base.merge("path" => Paths.gin(u, gin.id)) } }
        end

        def rows_waybill_confirmed
          wb = Waybill.find_by(id: payload_value(:waybill_id))
          return [] unless wb

          dispatch = wb.dispatch_order
          return [] unless dispatch&.warehouse_id

          users = rows_for_warehouse_doc(dispatch.warehouse_id)
          base = { "waybill_id" => wb.id, "dispatch_order_id" => wb.dispatch_order_id }.compact
          users.values.map { |u| { user: u, params: base.merge("path" => Paths.waybill(u, wb.id)) } }
        end

        def rows_for_warehouse_doc(warehouse_id)
          users = {}
          return users if warehouse_id.blank?

          wh = Warehouse.find_by(id: warehouse_id)
          if wh&.hub_id.present?
            facility_users(role_name: "Hub Manager", hub_id: wh.hub_id).each { |u| users[u.id] = u }
          end
          facility_users(role_name: "Warehouse Manager", warehouse_id: warehouse_id).each { |u| users[u.id] = u }
          users
        end

        def facility_users(role_name:, hub_id: nil, warehouse_id: nil, store_id: nil)
          rel = UserAssignment.where(role_name: role_name)
          rel = rel.where(hub_id: hub_id) if hub_id.present?
          rel = rel.where(warehouse_id: warehouse_id) if warehouse_id.present?
          rel = rel.where(store_id: store_id) if store_id.present?
          rel.includes(:user).map(&:user).compact.select(&:active?).uniq
        end

        def receipt_order_base_params(order)
          {
            "receipt_order_id" => order.id,
            "receipt_order_reference" => order.reference_no,
            "hub_id" => order.hub_id,
            "warehouse_id" => order.warehouse_id
          }.compact
        end

        def payload_value(key)
          v = @payload[key]
          v = @payload[key.to_s] if v.nil?
          v
        end

        # URL helpers for SPA paths (leading slash, no /cats_warehouse prefix).
        module Paths
          module_function

          def officer?(user)
            ContractConstants::OFFICER_ROLE_NAMES.any? { |role| user&.has_role?(role) }
          end

          def receipt_order(user, order_id)
            return "/officer/receipt-orders/#{order_id}" if officer?(user)
            return "/storekeeper/assignments?receipt_order_id=#{order_id}" if user&.has_role?("Storekeeper")

            "/receipt-orders/#{order_id}"
          end

          def receipt_authorization(user, ra)
            if user&.has_role?("Hub Manager")
              "/hub/receipt-authorizations/#{ra.id}"
            elsif user&.has_role?("Storekeeper")
              "/storekeeper/receipt-authorizations/#{ra.id}"
            else
              "/receipt-orders/#{ra.receipt_order_id}"
            end
          end

          def inspection(_user, inspection_id)
            "/inspections/#{inspection_id}"
          end

          def dispatch_order(user, order_id)
            officer?(user) ? "/officer/dispatch-orders/#{order_id}" : "/dispatch-orders/#{order_id}"
          end

          def grn(_user, grn_id)
            "/grns/#{grn_id}"
          end

          def gin(_user, gin_id)
            "/gins/#{gin_id}"
          end

          def waybill(_user, waybill_id)
            "/waybills/#{waybill_id}"
          end
        end
      end
    end
  end
end
