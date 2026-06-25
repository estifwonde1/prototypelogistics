module Cats
  module Warehouse
    class DispatchOrderAuthorizationsController < BaseController
      # GET /dispatch_order_authorizations
      def index
        authorize DispatchOrderAuthorization
        daos = policy_scope(DispatchOrderAuthorization)
                 .includes(
                   :dispatch_order, :warehouse, :commodity, :transporter,
                   :created_by, :confirmed_by, :driver_confirmed_by,
                   :gins,
                   authorization_stores: [:store, :commodity]
                 )
                 .order(created_at: :desc)

        daos = daos.where(dispatch_order_id: params[:dispatch_order_id]) if params[:dispatch_order_id].present?
        daos = daos.where(warehouse_id: params[:warehouse_id])           if params[:warehouse_id].present?
        daos = daos.where(status: params[:status])                       if params[:status].present?

        # Scope to hub manager's accessible warehouses when hub_id provided
        if params[:hub_id].present?
          hub_id = params[:hub_id].to_i
          access = AccessContext.new(user: current_user)
          unless access.can_access_hub?(hub_id)
            return render_error("Access denied to hub #{hub_id}", status: :forbidden)
          end

          wh_ids = Warehouse.where(hub_id: hub_id).pluck(:id)
          daos = daos.where(warehouse_id: wh_ids)
        end

        render_resource(daos, each_serializer: DispatchOrderAuthorizationSerializer)
      end

      # GET /dispatch_order_authorizations/:id
      def show
        dao = find_dao
        authorize dao
        render_resource(dao, serializer: DispatchOrderAuthorizationSerializer)
      end

      # POST /dispatch_order_authorizations
      def create
        authorize DispatchOrderAuthorization
        payload = dao_params

        dispatch_order = policy_scope(DispatchOrder).find(payload[:dispatch_order_id])
        warehouse      = resolve_warehouse_for_create!(payload)
        transporter    = resolve_transporter!(payload)
        input_unit     = resolve_input_unit(payload)
        commodity      = payload[:commodity_id].present? ? Cats::Core::Commodity.find(payload[:commodity_id]) : nil

        # Canonical quantity: convert if user entered in a different unit
        authorized_qty = resolve_authorized_quantity(
          payload:    payload,
          input_unit: input_unit,
          dispatch_order: dispatch_order
        )

        dao = DispatchOrderAuthorization.transaction do
          # Preserve the "as-typed" quantity so downstream display matches what the
          # hub / WM actually entered (mirrors ReceiptAuthorization pattern).
          raw_input_qty = payload[:authorized_quantity].to_f

          rec = DispatchOrderAuthorization.create!(
            dispatch_order:                 dispatch_order,
            warehouse:                      warehouse,
            commodity:                      commodity,
            transporter:                    transporter,
            transporter_name:               payload[:transporter_name].to_s.strip.presence,
            authorized_quantity:            authorized_qty,
            authorized_quantity_input:      raw_input_qty,
            authorized_quantity_input_unit: input_unit,
            driver_name:                    payload[:driver_name],
            driver_id_number:               payload[:driver_id_number],
            driver_phone:                   payload[:driver_phone],
            truck_plate_number:             payload[:truck_plate_number],
            status:                         DispatchOrderAuthorization::DRAFT,
            reference_no:                   generate_reference_no,
            created_by:                     current_user
          )

          # Create per-store allocation rows when provided
          build_authorization_stores!(rec, payload[:authorization_stores])
          rec
        end

        dao = reload_dao(dao.id)
        render_resource(dao, serializer: DispatchOrderAuthorizationSerializer, status: :created)
      end

      # PATCH /dispatch_order_authorizations/:id
      def update
        dao = find_dao
        authorize dao

        payload    = dao_update_params
        transporter = resolve_transporter!(payload) if payload[:transporter_id].present? || payload[:transporter_name].present?
        input_unit = resolve_input_unit(payload)

        DispatchOrderAuthorization.transaction do
          dao.transporter = transporter if transporter

          attrs = payload.except(:transporter_id, :transporter_name, :authorization_stores).to_h
          attrs["authorized_quantity_input_unit"] = input_unit if input_unit

          dao.assign_attributes(attrs)
          dao.save!

          if payload.key?(:authorization_stores)
            dao.authorization_stores.destroy_all
            build_authorization_stores!(dao, payload[:authorization_stores])
          end
        end

        dao = reload_dao(dao.id)
        render_resource(dao, serializer: DispatchOrderAuthorizationSerializer)
      end

      # POST /dispatch_order_authorizations/:id/confirm
      def confirm
        dao = find_dao
        authorize dao, :confirm?

        raise ArgumentError, "Only draft Dispatch Authorizations can be confirmed" unless dao.draft?

        dao.update!(
          status:       DispatchOrderAuthorization::CONFIRMED,
          confirmed_by: current_user,
          confirmed_at: Time.current
        )

        dao = reload_dao(dao.id)
        render_resource(dao, serializer: DispatchOrderAuthorizationSerializer)
      end

      # POST /dispatch_order_authorizations/:id/cancel
      def cancel
        dao = find_dao
        authorize dao, :cancel?

        raise ArgumentError, "Only draft Dispatch Authorizations can be cancelled" unless dao.draft?

        dao.update!(
          status:       DispatchOrderAuthorization::CANCELLED,
          cancelled_by: current_user,
          cancelled_at: Time.current
        )

        dao = reload_dao(dao.id)
        render_resource(dao, serializer: DispatchOrderAuthorizationSerializer)
      end

      def assign_storekeeper
        dao = find_dao
        authorize dao, :assign_storekeeper?

        payload = assign_storekeeper_params
        dao = DispatchOrderAuthorizationStorekeeperAssigner.call(
          dispatch_order_authorization: dao,
          actor:                        current_user,
          storekeeper_user_id:          payload[:storekeeper_user_id],
          store_id:                     payload[:store_id]
        )

        render_resource(dao, serializer: DispatchOrderAuthorizationSerializer)
      end

      def assignable_storekeepers
        authorize DispatchOrderAuthorization, :assignable_storekeepers?
        warehouse_id = params[:warehouse_id].presence&.to_i
        raise ArgumentError, "warehouse_id is required" if warehouse_id.blank?

        access = AccessContext.new(user: current_user)
        unless access.accessible_warehouse_ids.map(&:to_i).include?(warehouse_id)
          raise Pundit::NotAuthorizedError, "Access denied to warehouse #{warehouse_id}"
        end

        store_ids = Store.where(warehouse_id: warehouse_id).pluck(:id)
        assignments = UserAssignment
                        .includes(:user, :store)
                        .where(role_name: "Storekeeper")
                        .where("warehouse_id = ? OR store_id IN (?)", warehouse_id, store_ids.presence || [0])

        users = assignments.map(&:user).compact.uniq(&:id)
        payload = users.map do |user|
          ua = assignments.find { |a| a.user_id == user.id }
          {
            id: user.id,
            name: [user.first_name, user.last_name].compact.join(" ").presence || user.email,
            email: user.email,
            store_id: ua&.store_id,
            store_name: ua&.store&.name
          }
        end

        render_success(storekeepers: payload)
      end

      private

      def assign_storekeeper_params
        payload = params.require(:payload)
        payload.permit(:storekeeper_user_id, :store_id)
      end

      def find_dao
        policy_scope(DispatchOrderAuthorization)
          .includes(
            :dispatch_order, :warehouse, :commodity, :transporter,
            :created_by, :confirmed_by, :driver_confirmed_by,
            :gins,
            authorization_stores: [:store, :commodity]
          )
          .find(params[:id])
      end

      def reload_dao(id)
        DispatchOrderAuthorization.includes(
          :dispatch_order, :warehouse, :commodity, :transporter,
          :created_by, :confirmed_by, :driver_confirmed_by,
          :gins,
          authorization_stores: [:store, :commodity]
        ).find(id)
      end

      def resolve_warehouse_for_create!(payload)
        warehouse_id = payload[:warehouse_id]
        raise ArgumentError, "warehouse_id is required" if warehouse_id.blank?

        warehouse = Warehouse.find(warehouse_id)

        # Verify the user can access this warehouse via AccessContext
        # (same check used by policy_scope — prevents cross-hub/warehouse creation)
        unless admin_user? || access_context.can_access_warehouse?(warehouse.id)
          raise Pundit::NotAuthorizedError, "You do not have access to warehouse #{warehouse.name}"
        end

        warehouse
      end

      def resolve_transporter!(payload)
        return Cats::Core::Transporter.find(payload[:transporter_id]) if payload[:transporter_id].present?

        name = payload[:transporter_name].to_s.strip
        return nil if name.blank?

        normalized = name.downcase
        existing = Cats::Core::Transporter.where("LOWER(TRIM(name)) = ?", normalized).first
        return existing if existing

        Cats::Core::Transporter.create!(
          name:          name,
          code:          unique_transporter_code,
          address:       "Not provided",
          contact_phone: "Not provided"
        )
      rescue ActiveRecord::RecordInvalid => e
        raise ArgumentError, e.record.errors.full_messages.to_sentence
      end

      def unique_transporter_code
        loop do
          candidate = "DA-T-#{SecureRandom.hex(4).upcase}"
          break candidate unless Cats::Core::Transporter.exists?(code: candidate)
        end
      end

      def resolve_input_unit(payload)
        uid = payload[:authorized_quantity_input_unit_id].presence
        uid.present? ? Cats::Core::UnitOfMeasure.find_by(id: uid) : nil
      end

      # Convert entered quantity to the dispatch order line unit, then ensure it does not
      # exceed the remaining quantity still open on the dispatch order.
      def resolve_authorized_quantity(payload:, input_unit:, dispatch_order:)
        raw = payload[:authorized_quantity].to_f
        raise ArgumentError, "Authorized quantity must be positive" unless raw > 0

        first_line = dispatch_order.dispatch_order_lines.first
        canonical_qty = canonical_authorized_quantity(raw, input_unit: input_unit, line: first_line)
        remaining = dispatch_order_remaining_quantity(dispatch_order)

        if remaining.positive? && canonical_qty > remaining + 1e-6
          unit_label = first_line&.unit&.abbreviation.presence || first_line&.unit&.name.presence || ""
          suffix = unit_label.present? ? " (#{remaining.round(4)} #{unit_label})" : " (#{remaining.round(4)})"
          raise ArgumentError, "Authorized quantity exceeds the remaining amount to dispatch#{suffix}"
        end

        canonical_qty
      end

      def canonical_authorized_quantity(raw, input_unit:, line:)
        return raw.round(6) unless input_unit.present? && line&.unit_id.present?
        return raw.round(6) if input_unit.id.to_i == line.unit_id.to_i

        UomConversionResolver.convert(
          raw,
          from_unit_id: input_unit.id,
          to_unit_id:   line.unit_id,
          commodity_id: line.commodity_id
        ).to_f.round(6)
      end

      def dispatch_order_remaining_quantity(dispatch_order)
        ordered = dispatch_order.dispatch_order_lines.sum { |l| l.quantity.to_f }
        authorized = DispatchOrderAuthorization
                       .where(dispatch_order_id: dispatch_order.id, status: DispatchOrderAuthorization::CONFIRMED)
                       .sum(:authorized_quantity)
                       .to_f
        [ordered - authorized, 0].max
      end

      def build_authorization_stores!(dao, stores_params)
        return if stores_params.blank?

        Array(stores_params).each do |sp|
          next if sp[:store_id].blank? || sp[:commodity_id].blank?

          store     = Store.find(sp[:store_id])
          commodity = Cats::Core::Commodity.find(sp[:commodity_id])

          authorized_qty = sp[:authorized_quantity].to_f
          next unless authorized_qty > 0

          dao.authorization_stores.create!(
            store:              store,
            commodity:          commodity,
            authorized_quantity: authorized_qty,
            base_quantity:       sp[:base_quantity].presence&.to_f,
            remaining_quantity:  sp[:remaining_quantity].presence&.to_f || authorized_qty
          )
        end
      end

      def generate_reference_no
        loop do
          ref = "DA-#{SecureRandom.hex(4).upcase}"
          break ref unless DispatchOrderAuthorization.exists?(reference_no: ref)
        end
      end

      def dao_params
        p = params.require(:payload)
        p.permit(
          :dispatch_order_id,
          :warehouse_id,
          :commodity_id,
          :transporter_id,
          :transporter_name,
          :authorized_quantity,
          :authorized_quantity_input,
          :authorized_quantity_input_unit_id,
          :driver_name,
          :driver_id_number,
          :driver_phone,
          :truck_plate_number,
          authorization_stores: [
            :store_id,
            :commodity_id,
            :authorized_quantity,
            :base_quantity,
            :remaining_quantity
          ]
        )
      end

      def dao_update_params
        p = params.require(:payload)
        p.permit(
          :warehouse_id,
          :commodity_id,
          :transporter_id,
          :transporter_name,
          :authorized_quantity,
          :authorized_quantity_input,
          :authorized_quantity_input_unit_id,
          :driver_name,
          :driver_id_number,
          :driver_phone,
          :truck_plate_number,
          authorization_stores: [
            :store_id,
            :commodity_id,
            :authorized_quantity,
            :base_quantity,
            :remaining_quantity
          ]
        )
      end
    end
  end
end
