# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationService
      def initialize(dispatch_order:, actor:, warehouse:, authorized_quantity:, transporter:,
                     driver_name:, driver_id_number:, truck_plate_number:,
                     driver_phone: nil, authorized_quantity_input_unit: nil, store_splits: [])
        @order = dispatch_order
        @actor = actor
        @warehouse = warehouse
        @authorized_quantity = authorized_quantity.to_f
        @transporter = transporter
        @driver_name = driver_name
        @driver_id_number = driver_id_number
        @truck_plate_number = truck_plate_number
        @driver_phone = driver_phone
        @input_unit = authorized_quantity_input_unit
        @store_splits = store_splits
      end

      def call
        unless dispatch_order_ready_for_authorization?
          raise ArgumentError, "Dispatch order must be confirmed before authorization"
        end

        apply_transport_record_defaults!

        input_unit_id = @input_unit&.id || default_unit_id
        base_unit_id = default_base_unit_id
        authorized_base = UomConversionResolver.convert!(
          @authorized_quantity,
          from_unit_id: input_unit_id,
          to_unit_id: base_unit_id,
          commodity_id: primary_commodity_id
        )

        # Validate quantity ledger per commodity across all store splits
        validate_quantity_ledger_per_commodity!(authorized_base)

        DispatchOrderAuthorization.transaction do
          auth = DispatchOrderAuthorization.create!(
            dispatch_order: @order,
            warehouse: @warehouse,
            reference_no: "DOA-#{SecureRandom.hex(4).upcase}",
            status: DispatchOrderAuthorization::DRAFT,
            authorized_quantity: @authorized_quantity,
            authorized_base_quantity: authorized_base,
            authorized_quantity_input_unit_id: input_unit_id,
            remaining_quantity: @authorized_quantity,
            transporter: @transporter,
            transporter_name: @transporter.name,
            driver_name: @driver_name,
            driver_id_number: @driver_id_number,
            truck_plate_number: @truck_plate_number,
            driver_phone: @driver_phone,
            created_by: @actor
          )

          create_store_splits!(auth)

          WorkflowEventRecorder.record!(
            entity: auth,
            event_type: "dispatch_order_authorization.created",
            actor: @actor,
            from_status: nil,
            to_status: auth.status,
            payload: { dispatch_order_id: @order.id, warehouse_id: @warehouse.id }
          )

          NotificationFanout.deliver(
            "dispatch_order_authorization.created",
            dispatch_order_authorization_id: auth.id,
            warehouse_id: @warehouse.id
          )

          auth
        end
      end

      def self.confirm!(authorization:, actor:)
        new_confirm(authorization: authorization, actor: actor).call
      end

      def self.new_confirm(authorization:, actor:)
        Confirm.new(authorization: authorization, actor: actor)
      end

      class Confirm
        def initialize(authorization:, actor:)
          @authorization = authorization
          @actor = actor
        end

        def call
          raise ArgumentError, "Authorization must be draft" unless @authorization.draft?
          raise ArgumentError, "Driver name is required" if @authorization.driver_name.blank?
          raise ArgumentError, "Driver ID is required" if @authorization.driver_id_number.blank?
          raise ArgumentError, "Truck plate is required" if @authorization.truck_plate_number.blank?

          validate_store_splits!

          DispatchOrderAuthorization.transaction do
            @authorization.lock!

            @authorization.update!(
              status: DispatchOrderAuthorization::CONFIRMED,
              confirmed_by: @actor,
              confirmed_at: Time.current,
              remaining_quantity: @authorization.remaining_quantity || @authorization.authorized_quantity
            )

            optional_reserve_stock!

            waybill = nil
            if @authorization.dispatch_order_authorization_stores.exists?
              waybill = DispatchOrderAuthorizationWaybillGenerator.new(
                authorization: @authorization,
                actor: @actor
              ).call
            end

            WorkflowEventRecorder.record!(
              entity: @authorization,
              event_type: "dispatch_order_authorization.confirmed",
              actor: @actor,
              from_status: DispatchOrderAuthorization::DRAFT,
              to_status: @authorization.status,
              payload: { waybill_id: waybill&.id }
            )

            if waybill.present?
              NotificationFanout.deliver(
                "waybill.created",
                dispatch_order_authorization_id: @authorization.id,
                waybill_id: waybill.id
              )
            end

            DispatchOrderStatusAggregator.call(@authorization.dispatch_order)

            @authorization
          end
        end

        private

        def validate_store_splits!
          stores = @authorization.dispatch_order_authorization_stores
          return if stores.empty?

          sum = stores.sum(:authorized_quantity).to_f
          unless (sum - @authorization.authorized_quantity.to_f).abs <= 0.001
            raise ArgumentError, "Store splits must sum to authorized quantity"
          end
        end

        def optional_reserve_stock!
          return unless ENV["DISPATCH_RESERVE_ON_AUTH_CONFIRM"] == "true"

          # Soft reservation hook — extend StockReservationService when needed
        end
      end

      private

      def dispatch_order_ready_for_authorization?
        [
          ContractConstants::DOCUMENT_STATUSES[:confirmed],
          ContractConstants::DOCUMENT_STATUSES[:partially_authorized],
          ContractConstants::DOCUMENT_STATUSES[:fully_authorized]
        ].include?(@order.status)
      end

      # Validate that the sum of authorized quantities per commodity does not exceed
      # the source-allocated quantity for this warehouse. For multi-commodity store splits,
      # each commodity is checked independently.
      def validate_quantity_ledger_per_commodity!(authorized_base)
        return if @store_splits.blank?

        commodity_ids = @store_splits.map { |s| s[:commodity_id] }.compact.uniq
        commodity_ids = [primary_commodity_id] if commodity_ids.empty?

        commodity_ids.each do |cid|
          # Sum base quantity for this commodity from store splits
          split_base = @store_splits
            .select { |s| s[:commodity_id].to_i == cid.to_i }
            .sum { |s| (s[:base_quantity] || s[:authorized_quantity]).to_f }

          # Fall back to proportional share of authorized_base when no per-commodity splits
          qty = split_base.positive? ? split_base : authorized_base

          DispatchOrderAuthorizationQuantityLedger.validate!(
            dispatch_order: @order,
            warehouse: @warehouse,
            commodity_id: cid,
            additional_base_quantity: qty
          )
        end
      end

      def apply_transport_record_defaults!
        tr = TransportRecord.find_by(dispatch_order_id: @order.id, warehouse_id: @warehouse.id)
        return if tr.blank?

        @driver_name = @driver_name.presence || tr.driver_name
        @truck_plate_number = @truck_plate_number.presence || tr.vehicle_plate
        @driver_id_number = @driver_id_number.presence || tr.license_number
        @driver_phone = @driver_phone.presence || tr.phone
      end

      def create_store_splits!(auth)
        Array(@store_splits).each do |split|
          auth.dispatch_order_authorization_stores.create!(
            store_id: split[:store_id],
            commodity_id: split[:commodity_id],
            authorized_quantity: split[:authorized_quantity],
            base_quantity: split[:base_quantity] || split[:authorized_quantity],
            remaining_quantity: split[:authorized_quantity],
            dispatched_quantity: 0
          )
        end
      end

      def primary_commodity_id
        @store_splits.first&.dig(:commodity_id) ||
          @order.dispatch_order_lines.first&.commodity_id ||
          raise(ArgumentError, "commodity_id required in store_splits")
      end

      def default_unit_id
        @order.dispatch_order_lines.first&.unit_id
      end

      def default_base_unit_id
        commodity = Cats::Core::Commodity.find_by(id: primary_commodity_id)
        commodity&.unit_of_measure_id || default_unit_id
      end
    end
  end
end
