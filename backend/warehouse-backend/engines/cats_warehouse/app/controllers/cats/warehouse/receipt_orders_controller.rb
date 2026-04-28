module Cats
  module Warehouse
    class ReceiptOrdersController < BaseController
      def index
        authorize ReceiptOrder
        orders = policy_scope(ReceiptOrder).includes(*order_detail_includes).order(created_at: :desc)
        render_resource(orders, each_serializer: ReceiptOrderSerializer)
      end

      def show
        order = policy_scope(ReceiptOrder).includes(:hub, :warehouse).find(params[:id])
        authorize order

        assignments = order.receipt_order_assignments
          .includes(:assigned_to, :assigned_by, :store, :warehouse, :hub)

        if hub_manager?
          assignments = assignments.where(
            "cats_warehouse_receipt_order_assignments.store_id IS NULL"
          )
        elsif warehouse_manager?
          assignments = assignments.where(
            "cats_warehouse_receipt_order_assignments.hub_id IS NULL"
          )
        end

        serialized = ReceiptOrderSerializer.new(order).as_json
        serialized[:receipt_order_assignments] = ActiveModelSerializers::SerializableResource.new(
          assignments,
          each_serializer: ReceiptOrderAssignmentSerializer
        ).as_json

        render_success(serialized)
      end

      def create
        payload = receipt_order_params
        authorize ReceiptOrder

        # Get location tagging from the current user's assignment
        location_attrs = LocationTagger.call(user: current_user)

        # Map frontend params to backend params
        warehouse_id = payload[:destination_warehouse_id].presence || payload[:warehouse_id].presence
        received_date = payload[:expected_delivery_date] || payload[:received_date] || Date.today
        items = payload[:lines] || payload[:receipt_order_lines] || []
        source_name = payload[:source_name] || payload[:name]

        explicit_hub = find_optional_hub(payload[:hub_id])
        warehouse = find_optional_warehouse(warehouse_id)
        if warehouse.blank? && explicit_hub.blank?
          raise ArgumentError, "Select a destination hub or warehouse"
        end

        order = ReceiptOrderCreator.new(
          explicit_hub: explicit_hub,
          warehouse: warehouse,
          received_date: received_date,
          created_by: current_user,
          items: items,
          source: PolymorphicReferenceResolver.resolve_source(payload[:source_type], payload[:source_id]),
          reference_no: payload[:reference_no],
          description: payload[:description] || payload[:notes],
          name: source_name,
          location_id: location_attrs[:location_id],
          hierarchical_level: location_attrs[:hierarchical_level]
        ).call

        # Reload with proper associations
        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order, status: :created)
      end

      def update
        order = policy_scope(ReceiptOrder).includes(receipt_order_lines: [ :commodity, :unit ]).find(params[:id])
        authorize order

        raise ArgumentError, "Only draft receipt orders can be updated" unless order.status_draft?

        ReceiptOrder.transaction do
          payload = receipt_order_params

          warehouse_attr =
            if payload.key?(:warehouse_id) || payload.key?(:destination_warehouse_id)
              wid = payload[:destination_warehouse_id].presence || payload[:warehouse_id].presence
              wid.present? ? find_optional_warehouse(wid) : nil
            else
              order.warehouse
            end

          received_attr =
            if payload.key?(:received_date) || payload.key?(:expected_delivery_date)
              payload[:expected_delivery_date].presence || payload[:received_date] || order.received_date
            else
              order.received_date
            end

          source_attr =
            if payload.key?(:source_type) || payload.key?(:source_id)
              st = payload[:source_type].to_s.presence
              sid = payload[:source_id]
              if st.present? && sid.present?
                PolymorphicReferenceResolver.resolve_source(st, sid)
              elsif payload.key?(:source_id) && sid.blank?
                nil
              else
                order.source
              end
            else
              order.source
            end

          description_attr =
            if payload.key?(:description) || payload.key?(:notes)
              payload[:notes].presence || payload[:description].presence || order.description
            else
              order.description
            end

          name_attr =
            if payload.key?(:name) || payload.key?(:source_name)
              payload[:source_name].presence || payload[:name].presence || order.name
            else
              order.name
            end

          warehouse_changed = payload.key?(:warehouse_id) || payload.key?(:destination_warehouse_id)
          resolved_hub =
            if payload.key?(:hub_id) || warehouse_changed
              ReceiptOrderHubResolver.call(
                explicit_hub: payload.key?(:hub_id) ? find_optional_hub(payload[:hub_id]) : nil,
                warehouse: warehouse_attr
              )
            else
              order.hub
            end

          order.assign_attributes(
            hub: resolved_hub,
            warehouse: warehouse_attr,
            received_date: received_attr,
            source: source_attr,
            reference_no: payload.key?(:reference_no) ? payload[:reference_no].presence : order.reference_no,
            description: description_attr,
            name: name_attr
          )
          order.save!

          if payload.key?(:receipt_order_lines) || payload.key?(:lines)
            replace_receipt_order_lines!(order, payload[:receipt_order_lines].presence || payload[:lines] || [])
          end
        end

        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order)
      end

      def destroy
        order = policy_scope(ReceiptOrder).includes(receipt_order_lines: [:commodity]).find(params[:id])
        authorize order

        raise ArgumentError, "Only draft receipt orders can be deleted" unless order.status_draft?

        destroyed_id = order.id
        order.destroy!
        render_success({ id: destroyed_id })
      end

      def confirm
        order = policy_scope(ReceiptOrder).includes(receipt_order_lines: [:commodity]).find(params[:id])
        authorize order

        # Validate batch quantities before confirming
        order.receipt_order_lines.each do |line|
          next if line.commodity_id.blank? || line.quantity.to_f <= 0

          commodity = Cats::Core::Commodity.find_by(id: line.commodity_id)
          next unless commodity

          if line.quantity.to_f > commodity.quantity.to_f
            raise ArgumentError, "Insufficient batch quantity for #{commodity.name || commodity.batch_no}. Available: #{commodity.quantity}, Requested: #{line.quantity}"
          end
        end

        ReceiptOrderConfirmer.new(order: order, confirmed_by: current_user).call

        # Deduct batch quantities on confirm
        order.reload
        deduct_batch_quantities(order)

        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order)
      end

      def assignable_managers
        order = policy_scope(ReceiptOrder).includes(:hub, warehouse: :hub).find(params[:id])
        authorize order, :assignable_managers?

        effective_hub_id = order.warehouse&.hub_id.presence || order.hub_id
        manager_only = params[:manager_only] == 'true'

        if effective_hub_id.present?
          managers = manager_only ? receipt_order_managers_for_hub_managers_only(effective_hub_id) : receipt_order_managers_for_hub(effective_hub_id)
          stores = manager_only ? [] : available_stores_for_hub(effective_hub_id)
          hub = Hub.find_by(id: effective_hub_id)
          return render_success(
            assignable_managers: managers,
            stores: stores,
            hub_id: effective_hub_id,
            hub_name: hub&.name,
            warehouse_id: order.warehouse_id,
            warehouse_name: order.warehouse&.name,
            managers_scope: "hub"
          )
        end

        if order.warehouse_id.present?
          managers = manager_only ? receipt_order_managers_for_standalone_warehouse_managers_only(order.warehouse_id) : receipt_order_managers_for_standalone_warehouse(order.warehouse_id)
          stores = manager_only ? [] : available_stores_for_warehouse(order.warehouse_id)
          return render_success(
            assignable_managers: managers,
            stores: stores,
            hub_id: nil,
            hub_name: nil,
            warehouse_id: order.warehouse_id,
            warehouse_name: order.warehouse&.name,
            managers_scope: "warehouse"
          )
        end

        render_success(
          assignable_managers: [],
          stores: [],
          hub_id: nil,
          hub_name: nil,
          warehouse_id: nil,
          warehouse_name: nil,
          managers_scope: nil
        )
      end

      def assign
        order = policy_scope(ReceiptOrder).includes(warehouse: :hub).find(params[:id])
        authorize order, :assign?

        ReceiptOrderAssignmentService.new(
          order: order,
          actor: current_user,
          assignments: assignment_params[:assignments]
        ).call

        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order)
      end

      def reserve_space
        order = policy_scope(ReceiptOrder).find(params[:id])
        authorize order, :reserve_space?

        SpaceReservationService.new(
          order: order,
          actor: current_user,
          reservations: space_reservation_params[:reservations]
        ).call

        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order)
      end

      def workflow
        order = policy_scope(ReceiptOrder).find(params[:id])
        authorize order, :workflow?

        render_success(
          workflow_events: ActiveModelSerializers::SerializableResource.new(
            order.workflow_events.includes(:actor).order(occurred_at: :asc, id: :asc),
            each_serializer: WorkflowEventSerializer
          ).as_json
        )
      end

      private

      def order_detail_includes
        [
          :hub,
          :warehouse,
          {
            receipt_order_lines: [ :commodity, :unit ],
            receipt_order_assignments: [ :assigned_to, :assigned_by, :hub, :warehouse, :store ],
            space_reservations: [ :warehouse, :store, :reserved_by ]
          }
        ]
      end

      def render_order_payload(order, status: :ok)
        payload = ActiveModelSerializers::SerializableResource.new(
          order,
          serializer: ReceiptOrderSerializer
        ).as_json
        payload = payload.merge(can_confirm: ReceiptOrderPolicy.new(current_user, order).confirm?)
        render_success(payload, status: status)
      end

      def receipt_order_params
        payload = params.require(:payload)
        payload.permit(
          :hub_id,
          :warehouse_id,
          :destination_warehouse_id,  # NEW: Accept frontend param name
          :received_date,
          :expected_delivery_date,    # NEW: Accept frontend param name
          :reference_no,
          :name,
          :source_name,               # NEW: Accept frontend param name
          :description,
          :notes,                     # NEW: Accept frontend param name
          :source_type,
          :source_id,
          receipt_order_lines: [
            :commodity_id,
            :quantity,
            :unit_id,
            :line_reference_no,
            :notes,
            :packaging_unit_id,
            :packaging_size
          ],
          lines: [
            :commodity_id,
            :quantity,
            :unit_id,
            :line_reference_no,
            :notes,
            :packaging_unit_id,
            :packaging_size
          ]
        )
      end

      def assignment_params
        params.require(:payload).permit(assignments: [
          :receipt_order_line_id,
          :hub_id,
          :warehouse_id,
          :store_id,
          :assigned_to_id,
          :quantity,
          :status
        ])
      end

      def space_reservation_params
        params.require(:payload).permit(reservations: [
          :receipt_order_line_id,
          :receipt_order_assignment_id,
          :warehouse_id,
          :store_id,
          :reserved_quantity,
          :reserved_volume,
          :status
        ])
      end

      # Hub-scoped receipt orders: includes Hub Managers, Warehouse Managers, and Storekeepers for the hub.
      def receipt_order_managers_for_hub(hub_id)
        warehouse_ids = Warehouse.where(hub_id: hub_id).pluck(:id)

        hub_manager_ids = UserAssignment.where(role_name: "Hub Manager", hub_id: hub_id).distinct.pluck(:user_id)
        warehouse_manager_ids = UserAssignment
          .where(role_name: "Warehouse Manager")
          .where(warehouse_id: warehouse_ids)
          .distinct
          .pluck(:user_id)
        storekeeper_ids = UserAssignment
          .where(role_name: "Storekeeper")
          .where(store_id: Store.where(warehouse_id: warehouse_ids).select(:id))
          .distinct
          .pluck(:user_id)

        all_user_ids = hub_manager_ids + warehouse_manager_ids + storekeeper_ids
        map_users_for_assignable_managers(all_user_ids)
      end

      # Hub-scoped: only Hub Managers and Warehouse Managers (for officer assignment)
      def receipt_order_managers_for_hub_managers_only(hub_id)
        warehouse_ids = Warehouse.where(hub_id: hub_id).pluck(:id)

        hub_manager_ids = UserAssignment.where(role_name: "Hub Manager", hub_id: hub_id).distinct.pluck(:user_id)
        warehouse_manager_ids = UserAssignment
          .where(role_name: "Warehouse Manager")
          .where(warehouse_id: warehouse_ids)
          .distinct
          .pluck(:user_id)

        all_user_ids = hub_manager_ids + warehouse_manager_ids
        map_users_for_assignable_managers(all_user_ids)
      end

      def receipt_order_managers_for_standalone_warehouse(warehouse_id)
        warehouse_ids = [ warehouse_id ]
        warehouse_manager_ids = UserAssignment.where(role_name: "Warehouse Manager", warehouse_id: warehouse_id).distinct.pluck(:user_id)
        storekeeper_ids = UserAssignment
          .where(role_name: "Storekeeper")
          .where(store_id: Store.where(warehouse_id: warehouse_ids).select(:id))
          .distinct
          .pluck(:user_id)

        all_user_ids = warehouse_manager_ids + storekeeper_ids
        map_users_for_assignable_managers(all_user_ids)
      end

      # Standalone warehouse: only Warehouse Managers (for officer assignment)
      def receipt_order_managers_for_standalone_warehouse_managers_only(warehouse_id)
        warehouse_manager_ids = UserAssignment.where(role_name: "Warehouse Manager", warehouse_id: warehouse_id).distinct.pluck(:user_id)
        map_users_for_assignable_managers(warehouse_manager_ids)
      end

      def available_stores_for_hub(hub_id)
        warehouse_ids = Warehouse.where(hub_id: hub_id).pluck(:id)
        Store.where(warehouse_id: warehouse_ids)
          .order(:name)
          .map { |s| { id: s.id, name: s.name, code: s.code, warehouse_id: s.warehouse_id } }
      end

      def available_stores_for_warehouse(warehouse_id)
        Store.where(warehouse_id: warehouse_id)
          .order(:name)
          .map { |s| { id: s.id, name: s.name, code: s.code, warehouse_id: s.warehouse_id } }
      end

      def map_users_for_assignable_managers(user_ids)
        return [] if user_ids.empty?

        mod_id = warehouse_module.id
        assignments = UserAssignment
          .where(user_id: user_ids)
          .includes(:user)
          .distinct

        result = []
        assignments.each do |assignment|
          next unless assignment.user&.active? && assignment.user.application_module_id == mod_id

          display = [ assignment.user.first_name, assignment.user.last_name ].compact.join(" ").strip
          display = assignment.user.email if display.blank?

          user_info = {
            id: assignment.user.id,
            name: display,
            role: assignment.role_name
          }

          case assignment.role_name
          when "Storekeeper"
            user_info[:store_id] = assignment.store_id
            user_info[:store_name] = assignment.store&.name
          when "Warehouse Manager"
            user_info[:warehouse_id] = assignment.warehouse_id
            user_info[:warehouse_name] = assignment.warehouse&.name
          when "Hub Manager"
            user_info[:hub_id] = assignment.hub_id
            user_info[:hub_name] = assignment.hub&.name
          end

          result << user_info
        end
        result.sort_by { |u| [ u[:name], u[:id] ] }
      end

      def find_optional_hub(id)
        id.present? ? Hub.find(id) : nil
      end

      def find_optional_warehouse(id)
        id.present? ? Warehouse.find(id) : nil
      end

      def replace_receipt_order_lines!(order, items)
        order.receipt_order_lines.destroy_all

        Array(items).each do |raw|
          order.receipt_order_lines.create!(ReceiptOrderLine.attributes_from_line_payload(raw))
        end
      end

      # Deduct commodity quantities when a receipt order is created
      def deduct_batch_quantities(order)
        order.receipt_order_lines.each do |line|
          next if line.commodity_id.blank? || line.quantity.to_f <= 0

          commodity = Cats::Core::Commodity.find_by(id: line.commodity_id)
          next unless commodity

          new_qty = commodity.quantity.to_f - line.quantity.to_f
          commodity.update_column(:quantity, [new_qty, 0].max)
        end
      end

      # Restore commodity quantities when a receipt order is deleted
      def restore_batch_quantities(order)
        order.receipt_order_lines.each do |line|
          next if line.commodity_id.blank? || line.quantity.to_f <= 0

          commodity = Cats::Core::Commodity.find_by(id: line.commodity_id)
          next unless commodity

          commodity.update_column(:quantity, commodity.quantity.to_f + line.quantity.to_f)
        end
      end
    end
  end
end
