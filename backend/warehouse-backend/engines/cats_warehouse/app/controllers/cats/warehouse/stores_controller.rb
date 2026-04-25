module Cats
  module Warehouse
    class StoresController < BaseController
      def index
        authorize Store
        render_resource(policy_scope(Store).order(:id), each_serializer: StoreSerializer)
      end

      def show
        store = policy_scope(Store).find(params[:id])
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
        store.destroy!
        render_success({ id: store.id })
      end

      def storekeepers
        authorize Store, :storekeepers?
        
        # Get all warehouses accessible to the current user
        access = AccessContext.new(user: current_user)
        warehouse_ids = access.accessible_warehouse_ids
        
        # Get all storekeepers assigned to these warehouses (warehouse-level or store-level)
        assignments = UserAssignment
          .where(role_name: "Storekeeper")
          .where("warehouse_id IN (?) OR store_id IN (?)", 
                 warehouse_ids, 
                 Store.where(warehouse_id: warehouse_ids).select(:id))
          .includes(:user, :warehouse, :store)
        
        storekeepers_data = assignments.group_by(&:user_id).map do |user_id, user_assignments|
          user = user_assignments.first.user
          warehouse_assignment = user_assignments.find { |a| a.warehouse_id.present? }
          store_assignments = user_assignments.select { |a| a.store_id.present? }
          
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
        
        user = Cats::Core::User.find(user_id)
        warehouse = store.warehouse
        
        # Verify user is a storekeeper
        unless user.has_role?("Storekeeper")
          return render_error("User is not a Storekeeper", status: :unprocessable_entity)
        end
        
        # Delete existing assignments for this storekeeper in this warehouse
        UserAssignment.where(
          user_id: user_id,
          role_name: "Storekeeper"
        ).where("warehouse_id = ? OR store_id IN (?)", 
                warehouse.id, 
                Store.where(warehouse_id: warehouse.id).select(:id))
        .delete_all
        
        if store_ids.empty?
          # Reset to warehouse-level assignment (all stores)
          UserAssignment.create!(
            user: user,
            role_name: "Storekeeper",
            warehouse: warehouse
          )
          assignment_type = "warehouse"
        else
          # Create store-level assignments
          store_ids.each do |sid|
            store_to_assign = Store.find(sid)
            # Verify store belongs to the same warehouse
            if store_to_assign.warehouse_id != warehouse.id
              return render_error("Store #{sid} does not belong to warehouse #{warehouse.id}", status: :unprocessable_entity)
            end
            
            UserAssignment.create!(
              user: user,
              role_name: "Storekeeper",
              store_id: sid
            )
          end
          assignment_type = "store"
        end
        
        render_success(
          message: "Storekeeper assigned successfully",
          assignment_type: assignment_type,
          store_ids: store_ids
        )
      end

      private

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
