module Cats
  module Warehouse
    class StoresController < BaseController
      STORE_INCLUDES = [ { warehouse: :warehouse_capacity } ].freeze

      def index
        authorize Store
        stores = policy_scope(Store).includes(*STORE_INCLUDES)

        # CRITICAL: Filter by warehouse_id if provided (for warehouse managers with multiple warehouses)
        if params[:warehouse_id].present?
          warehouse_id = params[:warehouse_id].to_i

          # Verify user has access to this warehouse
          access = AccessContext.new(user: current_user)
          unless access.can_access_warehouse?(warehouse_id)
            return render_error("Access denied to warehouse #{warehouse_id}", status: :forbidden)
          end

          stores = stores.where(warehouse_id: warehouse_id)
        end

        render_resource(stores.order(:id), each_serializer: StoreSerializer)
      end

      def show
        store = policy_scope(Store).includes(*STORE_INCLUDES).find(params[:id])
        authorize store
        render_resource(store, serializer: StoreSerializer)
      end

      def create
        authorize Store
        store = Store.create!(store_params)
        render_resource(store, status: :created, serializer: StoreSerializer)
      end

      def update
        store = policy_scope(Store).find(params[:id])
        authorize store
        store.update!(store_params)
        render_resource(store, serializer: StoreSerializer)
      end

      def destroy
        store = policy_scope(Store).find(params[:id])
        authorize store

        if CapacityUsage.for_store(store).used_mt.positive?
          return render_error(
            "Cannot delete a store that has stock. Move or remove stock first.",
            status: :unprocessable_entity
          )
        end

        store.destroy!
        render_success({ id: store.id })
      end

      def storekeepers
        authorize Store, :storekeepers?
        
        # Get all warehouses accessible to the current user
        access = AccessContext.new(user: current_user)
        warehouse_ids = access.accessible_warehouse_ids
        
        # CRITICAL: Filter by warehouse_id if provided (for warehouse managers with multiple warehouses)
        if params[:warehouse_id].present?
          warehouse_ids = warehouse_ids & [params[:warehouse_id].to_i]
        end
        
        # Storekeepers and warehouse managers are eligible for explicit store assignment.
        assignments = UserAssignment
          .where(role_name: ["Storekeeper", "Warehouse Manager"])
          .where("warehouse_id IN (?) OR store_id IN (?)", 
                 warehouse_ids, 
                 Store.where(warehouse_id: warehouse_ids).select(:id))
          .includes(:user, :warehouse, :store)
        
        storekeepers_data = assignments.group_by(&:user_id).map do |user_id, user_assignments|
          user = user_assignments.first.user
          warehouse_assignment = user_assignments.find { |a| a.role_name == "Storekeeper" && a.warehouse_id.present? } ||
            user_assignments.find { |a| a.role_name == "Warehouse Manager" && a.warehouse_id.present? }
          store_assignments = user_assignments.select { |a| a.role_name == "Storekeeper" && a.store_id.present? }
          
          {
            id: user.id,
            name: "#{user.first_name} #{user.last_name}",
            email: user.email,
            assignment_type: warehouse_assignment.present? ? "warehouse" : "store",
            warehouse_id: warehouse_assignment&.warehouse_id || store_assignments.first&.store&.warehouse_id,
            warehouse_name: warehouse_assignment&.warehouse&.name || store_assignments.first&.store&.warehouse&.name,
            assigned_store_ids: store_assignments.map(&:store_id),
            assigned_stores: store_assignments.map { |a| { id: a.store.id, name: a.store.name } }
          }
        end
        
        render_success(storekeepers: storekeepers_data)
      end

      def assign_storekeeper
        store = policy_scope(Store).find(params[:id])
        authorize store, :assign_storekeeper?
        
        user_id = params[:user_id]
        store_ids_param = params[:store_ids]
        store_ids = store_ids_param.is_a?(Array) ? store_ids_param.map(&:to_i) : []
        store_ids = [store.id] if store_ids.empty?
        
        user = Cats::Core::User.find(user_id)
        warehouse = store.warehouse
        
        # Warehouse managers can also operate as storekeepers once explicitly assigned.
        unless user.has_role?("Storekeeper") || user.has_role?("Warehouse Manager")
          return render_error("User is not a Storekeeper or Warehouse Manager", status: :unprocessable_entity)
        end
        ensure_storekeeper_role!(user)

        ensure_storekeeper_pool_assignment!(user, warehouse)

        # Create store-level assignments.
        store_ids.each do |sid|
          store_to_assign = Store.find(sid)
          # Verify store belongs to the same warehouse
          if store_to_assign.warehouse_id != warehouse.id
            return render_error("Store #{sid} does not belong to warehouse #{warehouse.id}", status: :unprocessable_entity)
          end

          UserAssignment.find_or_create_by!(
            user: user,
            role_name: "Storekeeper",
            store_id: sid
          )
        end
        assignment_type = "store"
        
        render_success(
          message: "Storekeeper assigned successfully",
          assignment_type: assignment_type,
          store_ids: store_ids
        )
      end

      def unassign_storekeeper
        store = policy_scope(Store).find(params[:id])
        authorize store, :assign_storekeeper?

        user_id = params[:user_id]
        user = Cats::Core::User.find(user_id)
        ensure_storekeeper_pool_assignment!(user, store.warehouse)

        deleted = UserAssignment.where(
          user_id: user_id,
          role_name: "Storekeeper",
          store_id: store.id
        ).delete_all

        render_success(
          message: "Storekeeper removed from store",
          store_id: store.id,
          user_id: user_id.to_i,
          removed: deleted.positive?
        )
      end

      private

      def ensure_storekeeper_role!(user)
        return if user.has_role?("Storekeeper")

        role = Cats::Core::Role.find_by(name: "Storekeeper", application_module: warehouse_module)
        role ||= Cats::Core::Role.find_by(name: "Storekeeper")
        user.roles << role if role && !user.roles.exists?(id: role.id)
      end

      def ensure_storekeeper_pool_assignment!(user, warehouse)
        return if user.has_role?("Warehouse Manager")

        UserAssignment.find_or_create_by!(
          user: user,
          role_name: "Storekeeper",
          warehouse_id: warehouse.id
        )
      end

      def store_params
        params.require(:payload).permit(
          :code,
          :name,
          :length,
          :width,
          :height,
          :temporary,
          :has_gangway,
          :gangway_length,
          :gangway_width,
          :gangway_corner_dist,
          :warehouse_id
        )
      end
    end
  end
end
