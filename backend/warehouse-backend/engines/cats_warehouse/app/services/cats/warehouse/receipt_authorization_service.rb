module Cats
  module Warehouse
    class ReceiptAuthorizationService
      def self.assignment_not_rejected_scope(rel)
        t = ReceiptOrderAssignment.table_name
        rel.where.not("LOWER(TRIM(#{t}.status)) = ?", "rejected")
      end

      def initialize(receipt_order:, actor:, store:, authorized_quantity:,
                     driver_name:, driver_id_number:, truck_plate_number:,
                     transporter:, waybill_number:,
                     receipt_order_assignment: nil,
                     explicit_warehouse: nil,
                     receipt_order_line: nil,
                     authorized_quantity_input: nil,
                     authorized_quantity_input_unit: nil,
                     force_plan_change_notification: false)
        @receipt_order                  = receipt_order
        @actor                          = actor
        @store                          = store
        @authorized_quantity            = authorized_quantity.to_f
        @driver_name                    = driver_name
        @driver_id_number               = driver_id_number
        @truck_plate_number             = truck_plate_number
        @transporter                    = transporter
        @waybill_number                 = waybill_number.to_s.strip.presence
        @receipt_order_assignment       = receipt_order_assignment
        @explicit_warehouse             = explicit_warehouse
        @receipt_order_line             = receipt_order_line
        @authorized_quantity_input      = authorized_quantity_input
        @authorized_quantity_input_unit = authorized_quantity_input_unit
        @force_plan_change_notification = ActiveModel::Type::Boolean.new.cast(force_plan_change_notification)
      end

      def call
        ensure_receipt_order_line_column!

        if @receipt_order_assignment.present? && @explicit_warehouse.present?
          raise ArgumentError,
                "Specify either receipt_order_assignment_id or warehouse_id for routing, not both"
        end

        warehouse = resolved_warehouse
        raise ArgumentError, "A destination warehouse could not be determined for this Receipt Authorization" if warehouse.blank?

        line = resolved_receipt_order_line!
        validate_warehouse_for_routing!(warehouse)
        validate_quantities!(warehouse, line)

        routing_override      = routing_override?(warehouse)
        planned_ids           = planned_warehouse_ids_for_line(line)
        plan_deviated         = routing_override && planned_ids.any? && planned_ids.exclude?(warehouse.id)

        ReceiptAuthorization.transaction do
          ra = create_receipt_authorization_record!(
            warehouse: warehouse,
            line: line
          )

          WorkflowEventRecorder.record!(
            entity:      @receipt_order,
            event_type:  "receipt_authorization.created",
            actor:       @actor,
            from_status: @receipt_order.status,
            to_status:   @receipt_order.status,
            payload:     {
              receipt_authorization_id: ra.id,
              store_id:                 @store&.id,
              warehouse_id:             warehouse.id,
              quantity:                 @authorized_quantity
            }
          )

          if routing_override
            WorkflowEventRecorder.record!(
              entity:      @receipt_order,
              event_type:  "receipt_authorization.routing_override",
              actor:       @actor,
              from_status: @receipt_order.status,
              to_status:   @receipt_order.status,
              payload:     {
                receipt_authorization_id: ra.id,
                receipt_order_line_id:    line.id,
                chosen_warehouse_id:      warehouse.id,
                planned_warehouse_ids:    planned_ids,
                plan_deviated:            plan_deviated
              }
            )
          end

          enqueue_notification("receipt_authorization.created",
                               receipt_authorization_id: ra.id,
                               store_id:                 ra.store_id,
                               warehouse_id:             ra.warehouse_id)

          deliver_plan_change_notifications!(
            receipt_authorization: ra,
            line:                   line,
            warehouse:             warehouse,
            routing_override:      routing_override,
            plan_deviated:         plan_deviated,
            planned_warehouse_ids: planned_ids
          )

          if routing_override
            assignment_row = ensure_assignment_for_routing_override!(
              warehouse:             warehouse,
              line:                  line,
              ra:                    ra,
              plan_deviated:         plan_deviated,
              planned_warehouse_ids: planned_ids
            )
            enqueue_routing_override_assignment_notification!(assignment_row) if assignment_row
          end

          ra
        end
      end

      def self.cancel!(receipt_authorization:, actor:)
        ra = receipt_authorization

        raise ArgumentError, "Cannot cancel — Receipt Authorization is not Pending" unless ra.pending?
        raise ArgumentError, "Cannot cancel — an Inspection has already been recorded against this Receipt Authorization" if ra.inspections.any?

        ReceiptAuthorization.transaction do
          ra.update!(
            status:       ReceiptAuthorization::CANCELLED,
            cancelled_at: Time.current,
            cancelled_by: actor
          )

          WorkflowEventRecorder.record!(
            entity:      ra.receipt_order,
            event_type:  "receipt_authorization.cancelled",
            actor:       actor,
            from_status: ra.receipt_order.status,
            to_status:   ra.receipt_order.status,
            payload:     { receipt_authorization_id: ra.id }
          )

          enqueue_notification_static("receipt_authorization.cancelled",
                                      receipt_authorization_id: ra.id,
                                      store_id:                 ra.store_id)

          ra
        end
      end

      def self.assignments_matching_line_scope(receipt_order:, line:)
        rel = receipt_order.receipt_order_assignments
                           .includes(:warehouse, :store)
                           .where.not(warehouse_id: nil)

        rel = assignment_not_rejected_scope(rel)

        lines_count =
          if receipt_order.receipt_order_lines.loaded?
            receipt_order.receipt_order_lines.size
          else
            receipt_order.receipt_order_lines.count
          end

        if lines_count <= 1
          rel.where("receipt_order_line_id IS NULL OR receipt_order_line_id = ?", line.id)
        else
          rel.where(receipt_order_line_id: line.id)
        end
      end

      def self.plan_diversion_notify_user_ids(receipt_order:, line:, chosen_warehouse_id:, exclude_chosen:, all_on_line: false)
        rows = assignments_matching_line_scope(receipt_order: receipt_order, line: line).to_a
        targets =
          if all_on_line
            rows
          elsif exclude_chosen
            rows.reject { |a| a.warehouse_id.to_i == chosen_warehouse_id.to_i }
          else
            rows
          end

        ids = []
        targets.each do |a|
          ids << a.assigned_to_id if a.assigned_to_id.present?

          facility_wm_ids(a.warehouse_id).each { |uid| ids << uid }

          next if a.store_id.blank?

          UserAssignment.includes(:user).where(role_name: "Storekeeper", store_id: a.store_id).find_each do |ua|
            ids << ua.user_id if ua.user&.active?
          end
        end

        ids.compact.uniq
      end

      def self.facility_wm_ids(warehouse_id)
        return [] if warehouse_id.blank?

        UserAssignment.where(role_name: "Warehouse Manager", warehouse_id: warehouse_id)
                      .includes(:user)
                      .map { |ua| ua.user_id if ua.user&.active? }
                      .compact
      end

      def self.enqueue_notification_static(event, payload)
        NotificationFanout.deliver(event, payload)
      end

      private

      def ensure_receipt_order_line_column!
        receipt_order_line_column_present? ||
          raise(
            ArgumentError,
            "Database is missing column receipt_order_line_id on #{ReceiptAuthorization.table_name}. " \
            "Run: cd backend/warehouse-backend && bin/rails db:migrate && restart the Rails server."
          )
      end

      def receipt_order_line_column_present?
        ReceiptAuthorization.reset_column_information
        t = ReceiptAuthorization.table_name
        ReceiptAuthorization.connection.columns(t).any? { |c| c.name == "receipt_order_line_id" }
      end

      def create_receipt_authorization_record!(warehouse:, line:)
        attrs = {
          receipt_order:            @receipt_order,
          receipt_order_line:       line,
          receipt_order_assignment: @receipt_order_assignment,
          store:                    @store,
          warehouse:                warehouse,
          transporter:              @transporter,
          authorized_quantity:      @authorized_quantity,
          driver_name:              @driver_name,
          driver_id_number:         @driver_id_number,
          truck_plate_number:       @truck_plate_number,
          waybill_number:           resolved_waybill_number,
          status:                   ReceiptAuthorization::PENDING,
          reference_no:             generate_reference_no,
          created_by:               @actor
        }
        attrs.merge!(resolved_input_quantity_attrs(line: line))
        ReceiptAuthorization.create!(attrs)
      rescue ActiveModel::MissingAttributeError => e
        raise e unless e.message.to_s.include?("receipt_order_line_id")

        raise ArgumentError,
              "Receipt authorizations schema is outdated (missing receipt_order_line_id). " \
              "Run bin/rails db:migrate in backend/warehouse-backend, restart Spring if used (bin/spring stop), " \
              "then restart the API."
      end

      # Preserve "as-typed" qty + unit on the RA when the client sent them; otherwise
      # default to the normalized qty in the receipt-order line unit so historical/API
      # callers that omit the new fields still produce well-formed display data.
      # No-op when the columns haven't been migrated in this environment yet.
      def resolved_input_quantity_attrs(line:)
        cols = ReceiptAuthorization.column_names
        return {} unless cols.include?("authorized_quantity_input") &&
                         cols.include?("authorized_quantity_input_unit_id")

        qty_in = @authorized_quantity_input.present? ? @authorized_quantity_input.to_f : @authorized_quantity.to_f
        unit_id_in = @authorized_quantity_input_unit&.id || line.unit_id

        {
          authorized_quantity_input:         qty_in,
          authorized_quantity_input_unit_id: unit_id_in
        }
      end

      def routing_override?(warehouse)
        @receipt_order_assignment.blank? && @explicit_warehouse.present? && warehouse.id == @explicit_warehouse.id
      end

      def planned_warehouse_ids_for_line(line)
        self.class.assignments_matching_line_scope(receipt_order: @receipt_order, line: line)
                   .distinct
                   .pluck(:warehouse_id)
      end

      def ensure_assignment_for_routing_override!(warehouse:, line:, ra:, plan_deviated:,
                                                   planned_warehouse_ids:)
        return unless @receipt_order_assignment.blank?

        # Before superseding planned rows, reuse the same warehouse manager so notifications and
        # policy scope (assigned_to) stay correct when the WM has no separate UserAssignment row
        # for the newly chosen warehouse.
        assignee_fallback_id = routing_override_assignee_fallback(
          line: line, planned_warehouse_ids: planned_warehouse_ids, plan_deviated: plan_deviated
        )

        if plan_deviated && planned_warehouse_ids.present?
          reject_superseded_planned_assignments!(
            line:                  line,
            chosen_warehouse_id:   warehouse.id,
            planned_warehouse_ids: planned_warehouse_ids
          )
        end

        hub_id_for_row = warehouse.hub_id.presence ||
                         line.destination_hub_id.presence ||
                         @receipt_order.hub_id
        wm_id          = self.class.facility_wm_ids(warehouse.id).first
        wm_id ||= assignee_fallback_id
        assigned       = ContractConstants::DOCUMENT_STATUSES[:assigned]

        existing = self.class.assignment_not_rejected_scope(
          @receipt_order.receipt_order_assignments.where(receipt_order_line_id: line.id, warehouse_id: warehouse.id)
        ).order(:id).first

        row = if existing
                existing.update!(
                  hub_id:           hub_id_for_row,
                  quantity:         @authorized_quantity,
                  assigned_to_id:   wm_id.presence || existing.assigned_to_id,
                  status:           assignment_status_promote(existing.status.to_s)
                )
                existing
              else
                ReceiptOrderAssignment.create!(
                  receipt_order:        @receipt_order,
                  receipt_order_line:   line,
                  hub_id:               hub_id_for_row,
                  warehouse_id:         warehouse.id,
                  store_id:             nil,
                  assigned_by:          @actor,
                  assigned_to_id:       wm_id,
                  quantity:             @authorized_quantity,
                  status:               assigned
                )
              end

        ra.update!(receipt_order_assignment: row) if ra.receipt_order_assignment_id.blank?
        row
      end

      def routing_override_assignee_fallback(line:, planned_warehouse_ids:, plan_deviated:)
        return nil unless plan_deviated

        planned_ids_int = planned_warehouse_ids.compact.filter_map(&:to_i).uniq
        return nil if planned_ids_int.blank?

        row = self.class.assignments_matching_line_scope(receipt_order: @receipt_order, line: line)
                  .where(warehouse_id: planned_ids_int)
                  .where.not(assigned_to_id: nil)
                  .order(:id)
                  .first
        row&.assigned_to_id
      end

      def reject_superseded_planned_assignments!(line:, chosen_warehouse_id:, planned_warehouse_ids:)
        planned_ids_int = planned_warehouse_ids.compact.filter_map(&:to_i).uniq
        return if planned_ids_int.blank?

        self.class.assignment_not_rejected_scope(@receipt_order.receipt_order_assignments)
          .where(receipt_order_line_id: line.id, warehouse_id: planned_ids_int)
          .where.not(warehouse_id: chosen_warehouse_id.to_i)
          .find_each do |assignment|
          assignment.update!(status: "rejected")
        end
      end

      def assignment_status_promote(_raw)
        # Explicit routing always targets a warehouse; row should behave as an active WM assignment.
        ContractConstants::DOCUMENT_STATUSES[:assigned]
      end

      def enqueue_routing_override_assignment_notification!(assignment)
        ids = []
        ids << assignment.assigned_to_id if assignment.assigned_to_id.present?

        if assignment.store_id.present?
          UserAssignment.includes(:user).where(role_name: "Storekeeper", store_id: assignment.store_id).find_each do |ua|
            ids << ua.user_id if ua.user&.active?
          end
        end

        ids = ids.compact.uniq
        return if ids.blank?

        NotificationFanout.deliver(
          "receipt_order.assigned",
          receipt_order_id:  @receipt_order.id,
          assigned_to_ids:   ids
        )
      end

      def deliver_plan_change_notifications!(receipt_authorization:, line:, warehouse:, routing_override:, plan_deviated:,
                                             planned_warehouse_ids:)
        return unless routing_override && planned_warehouse_ids.any?

        notify_full_deviation = plan_deviated
        notify_advisory =
          !plan_deviated &&
          @force_plan_change_notification &&
          planned_warehouse_ids.include?(warehouse.id)

        return unless notify_full_deviation || notify_advisory

        exclude_chosen = notify_full_deviation
        all_on_line    = notify_advisory

        ids = self.class.plan_diversion_notify_user_ids(
          receipt_order:         @receipt_order,
          line:                  line,
          chosen_warehouse_id:   warehouse.id,
          exclude_chosen:        exclude_chosen,
          all_on_line:           all_on_line
        )

        return if ids.blank?

        NotificationFanout.deliver(
          "receipt_authorization.plan_deviated",
          receipt_order_id:          @receipt_order.id,
          receipt_authorization_id: receipt_authorization.id,
          receipt_order_line_id:    line.id,
          commodity_id:             line.commodity_id,
          chosen_warehouse_id:      warehouse.id,
          planned_warehouse_ids:    planned_warehouse_ids,
          notify_user_ids:          ids,
          advisory_only:            notify_advisory
        )
      end

      def resolved_receipt_order_line!
        line =
          @receipt_order_line.presence ||
          @receipt_order_assignment&.receipt_order_line

        if line.blank? && @receipt_order.receipt_order_lines.one?
          line = @receipt_order.receipt_order_lines.first
        end

        raise ArgumentError, "receipt_order_line_id is required when the Receipt Order has multiple lines" if line.blank?

        line
      end

      def resolved_warehouse
        return @store.warehouse if @store.present?
        return @receipt_order_assignment.warehouse if @receipt_order_assignment&.warehouse.present?
        return @explicit_warehouse if @explicit_warehouse.present?

        @receipt_order.warehouse
      end

      def order_effective_hub_id
        @receipt_order.hub_id.presence || @receipt_order.warehouse&.hub_id
      end

      def validate_warehouse_for_routing!(warehouse)
        return validate_assignment_warehouse!(warehouse) if @receipt_order_assignment.present?

        validate_explicit_override_warehouse!(warehouse) if @explicit_warehouse.present?
      end

      def validate_assignment_warehouse!(warehouse)
        directly_targeted = @receipt_order.warehouse_id == warehouse.id
        has_assignment = self.class.assignment_not_rejected_scope(
          @receipt_order.receipt_order_assignments.where(warehouse_id: warehouse.id)
        ).exists?

        return if directly_targeted || has_assignment

        raise ArgumentError, "Destination warehouse is not allocated for this Receipt Order"
      end

      def validate_explicit_override_warehouse!(warehouse)
        return if @receipt_order.warehouse_id == warehouse.id

        hub_id = order_effective_hub_id
        if hub_id.present?
          wh_hub = warehouse.hub_id
          if wh_hub.present? && wh_hub != hub_id
            raise ArgumentError, "Chosen warehouse must belong to this Receipt Order hub"
          end
          if wh_hub.blank? && warehouse.id != @receipt_order.warehouse_id
            raise ArgumentError, "Chosen warehouse must belong to this Receipt Order hub"
          end
          return
        end

        if @receipt_order.warehouse.blank?
          raise ArgumentError,
                "Receipt Order must have a hub or warehouse destination before authorizing trucks directly"
        end

        return if warehouse.id == @receipt_order.warehouse_id

        raise ArgumentError, "Destination warehouse is not allocated for this Receipt Order"
      end

      def validate_quantities!(warehouse, line)
        if @authorized_quantity <= 0
          raise ArgumentError, "Authorized quantity must be positive"
        end

        validate_quantity_against_receipt_order_line_total!(line)
        validate_quantity_within_allocation!(warehouse) if @receipt_order_assignment.present?
      end

      def validate_quantity_against_receipt_order_line_total!(line)
        line_ceiling   = line.quantity.to_f
        line_unit_id   = line.unit_id
        commodity_id   = line.commodity_id
        normalized_new = @authorized_quantity.to_f # client sends qty in receipt line unit for both paths

        base_scope = ReceiptAuthorization.where(receipt_order: @receipt_order)
                                          .where.not(status: ReceiptAuthorization::CANCELLED)
                                          .includes(:receipt_order_assignment, :receipt_order_line)

        normalized_existing_sum = base_scope.to_a.inject(0.0) do |acc, other|
          next acc unless ra_counts_toward_line?(other, line.id)

          other_qty = other.authorized_quantity.to_f
          from_uid = infer_unit_id_for_ra(other, line_unit_id)
          acc + UomConversionResolver.convert(other_qty,
                                              from_unit_id: from_uid,
                                              to_unit_id: line_unit_id,
                                              commodity_id: commodity_id)
        end

        proposed = normalized_existing_sum + normalized_new

        return unless proposed - line_ceiling > 0.0001

        raise ArgumentError,
              "Authorized quantity exceeds the Receipt Order line total (#{line_ceiling.round(4)} in order units)"
      end

      def ra_counts_toward_line?(ra, line_id)
        if ra.receipt_order_line_id.present?
          return ra.receipt_order_line_id.to_i == line_id.to_i
        end

        alid = ra.receipt_order_assignment&.receipt_order_line_id
        if alid.present?
          return alid.to_i == line_id.to_i
        end

        @receipt_order.receipt_order_lines.one?
      end

      def infer_unit_id_for_ra(ra, default_line_unit_id)
        if ra.association(:receipt_order_line).loaded? && ra.receipt_order_line.present?
          return ra.receipt_order_line.unit_id
        end
        if ra.receipt_order_line_id.present?
          ol = ra.receipt_order_line
          return ol.unit_id if ol
        end

        al = ra.association(:receipt_order_assignment).loaded? ? ra.receipt_order_assignment : nil
        al ||= ra.receipt_order_assignment if ra.receipt_order_assignment_id.present?
        if al&.receipt_order_line.present?
          return al.receipt_order_line.unit_id
        end

        default_line_unit_id
      end

      def validate_quantity_within_allocation!(warehouse)
        allocation = @receipt_order_assignment || find_allocation_for_warehouse(warehouse)
        return if allocation.nil?

        allocated_qty = allocation.quantity.to_f

        base_scope = ReceiptAuthorization.where(receipt_order: @receipt_order).where.not(
          status: ReceiptAuthorization::CANCELLED
        )

        existing_qty =
          if @receipt_order_assignment.present?
            base_scope.where(receipt_order_assignment_id: allocation.id).sum(:authorized_quantity).to_f
          else
            base_scope.where(warehouse: warehouse).sum(:authorized_quantity).to_f
          end

        remaining = allocated_qty - existing_qty

        return unless @authorized_quantity - remaining > 0.0001

        raise ArgumentError,
              "Cannot authorize #{@authorized_quantity}; only #{remaining.round(4)} remaining for this assignment"
      end

      def find_allocation_for_warehouse(warehouse)
        self.class.assignment_not_rejected_scope(
          @receipt_order.receipt_order_assignments.where(warehouse_id: warehouse.id)
        ).order(:id).first
      end

      def generate_reference_no
        loop do
          ref = "RA-#{SecureRandom.hex(4).upcase}"
          break ref unless ReceiptAuthorization.exists?(reference_no: ref)
        end
      end

      def resolved_waybill_number
        @waybill_number || generate_waybill_number
      end

      def generate_waybill_number
        loop do
          ref = "WB-#{SecureRandom.hex(4).upcase}"
          break ref unless ReceiptAuthorization.exists?(waybill_number: ref)
        end
      end

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end
    end
  end
end
