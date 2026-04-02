module Cats
  module Warehouse
    class ReceiptOrdersController < BaseController
      def index
        authorize ReceiptOrder
        orders = policy_scope(ReceiptOrder).includes(*order_detail_includes).order(created_at: :desc)
        render_resource(orders, each_serializer: ReceiptOrderSerializer)
      end

      def show
        order = policy_scope(ReceiptOrder).includes(*order_detail_includes).find(params[:id])
        authorize order
        render_order_payload(order)
      end

      def create
        payload = receipt_order_params
        authorize ReceiptOrder

        # Map frontend params to backend params
        warehouse_id = payload[:destination_warehouse_id] || payload[:warehouse_id]
        received_date = payload[:expected_delivery_date] || payload[:received_date] || Date.today
        items = payload[:lines] || payload[:receipt_order_lines] || []
        source_name = payload[:source_name] || payload[:name]

        order = ReceiptOrderCreator.new(
          hub: find_optional_hub(payload[:hub_id]),
          warehouse: find_optional_warehouse(warehouse_id),
          received_date: received_date,
          created_by: current_user,
          items: items,
          source: PolymorphicReferenceResolver.resolve_source(payload[:source_type], payload[:source_id]),
          reference_no: payload[:reference_no],
          description: payload[:description] || payload[:notes],
          name: source_name
        ).call

        # Reload with proper associations
        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order, status: :created)
      end

      def update
        order = policy_scope(ReceiptOrder).includes(receipt_order_lines: [:commodity, :unit]).find(params[:id])
        authorize order

        raise ArgumentError, "Only draft receipt orders can be updated" unless order.status_draft?

        ReceiptOrder.transaction do
          payload = receipt_order_params

          warehouse_attr =
            if payload.key?(:warehouse_id) || payload.key?(:destination_warehouse_id)
              wid = payload[:destination_warehouse_id].presence || payload[:warehouse_id]
              wid.present? ? find_optional_warehouse(wid) : order.warehouse
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

          order.assign_attributes(
            hub: payload.key?(:hub_id) ? find_optional_hub(payload[:hub_id]) : order.hub,
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
        order = policy_scope(ReceiptOrder).find(params[:id])
        authorize order

        raise ArgumentError, "Only draft receipt orders can be deleted" unless order.status_draft?

        destroyed_id = order.id
        order.destroy!
        render_success({ id: destroyed_id })
      end

      def confirm
        order = policy_scope(ReceiptOrder).find(params[:id])
        authorize order

        ReceiptOrderConfirmer.new(order: order, confirmed_by: current_user).call
        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order)
      end

      def assignable_managers
        order = policy_scope(ReceiptOrder).find(params[:id])
        authorize order, :assignable_managers?

        hub_id = order.hub_id
        if hub_id.blank?
          return render_success(
            assignable_managers: [],
            hub_id: hub_id,
            hub_name: order.hub&.name
          )
        end

        warehouse_ids = Warehouse.where(hub_id: hub_id).pluck(:id)
        hm_scope = UserAssignment.where(role_name: "Hub Manager", hub_id: hub_id)
        assignment_rows =
          if warehouse_ids.any?
            UserAssignment
              .where(role_name: "Warehouse Manager", warehouse_id: warehouse_ids)
              .or(hm_scope)
          else
            hm_scope
          end
        user_ids = assignment_rows.distinct.pluck(:user_id)
        mod_id = warehouse_module.id
        users =
          Cats::Core::User
            .where(id: user_ids, active: true, application_module_id: mod_id)
            .order(:last_name, :first_name, :id)

        assignable_managers =
          users.map do |u|
            display = [ u.first_name, u.last_name ].compact.join(" ").strip
            display = u.email if display.blank?
            { id: u.id, name: display }
          end

        render_success(
          assignable_managers: assignable_managers,
          hub_id: hub_id,
          hub_name: order.hub&.name
        )
      end

      def assign
        order = policy_scope(ReceiptOrder).find(params[:id])
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
            receipt_order_lines: [:commodity, :unit],
            receipt_order_assignments: [:assigned_to, :assigned_by, :hub, :warehouse, :store]
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
            :unit_price,              # NEW: Accept frontend param name
            :notes                    # NEW: Accept frontend param name
          ],
          lines: [                    # NEW: Accept frontend param name
            :commodity_id,
            :quantity,
            :unit_id,
            :unit_price,
            :notes
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
    end
  end
end
