module Cats
  module Warehouse
    class CommodityDefinitionsController < BaseController
      # GET /commodity_definitions
      # All facility roles can read (for officer dropdowns)
      def index
        authorize CommodityDefinition, :read?, policy_class: CommodityDefinitionPolicy
        category_map = Cats::Core::CommodityCategory.all.index_by(&:id)

        definitions = CommodityDefinition.order(:name).map do |d|
          serialize_definition(d, category_map)
        end

        render_success(commodity_definitions: definitions)
      end

      # POST /commodity_definitions
      # Admin only
      def create
        authorize CommodityDefinition, :create?, policy_class: CommodityDefinitionPolicy

        payload = definition_params
        definition = CommodityDefinition.new(
          name: payload[:name]&.strip,
          commodity_code: payload[:commodity_code]&.strip,
          commodity_category_id: payload[:commodity_category_id]
        )

        if definition.save
          category_map = Cats::Core::CommodityCategory.all.index_by(&:id)
          render_success(serialize_definition(definition, category_map), status: :created)
        else
          render_error(definition.errors.full_messages.to_sentence, status: :unprocessable_entity)
        end
      end

      # PATCH /commodity_definitions/:id
      # Admin only
      def update
        definition = CommodityDefinition.find(params[:id])
        authorize definition, :update?, policy_class: CommodityDefinitionPolicy

        payload = definition_params
        definition.assign_attributes(
          name: payload[:name]&.strip,
          commodity_code: payload[:commodity_code]&.strip,
          commodity_category_id: payload[:commodity_category_id]
        )

        if definition.save
          category_map = Cats::Core::CommodityCategory.all.index_by(&:id)
          render_success(serialize_definition(definition, category_map))
        else
          render_error(definition.errors.full_messages.to_sentence, status: :unprocessable_entity)
        end
      end

      # DELETE /commodity_definitions/:id
      # Admin only
      def destroy
        definition = CommodityDefinition.find(params[:id])
        authorize definition, :destroy?, policy_class: CommodityDefinitionPolicy

        definition.destroy!
        render_success(id: definition.id)
      end

      private

      def definition_params
        params.require(:commodity_definition).permit(:name, :commodity_code, :commodity_category_id)
      end

      def serialize_definition(definition, category_map)
        category = category_map[definition.commodity_category_id]
        # Determine the commodity group from the category's parent (ancestry gem)
        group_name = resolve_group_name(category, category_map)

        {
          id: definition.id,
          name: definition.name,
          commodity_code: definition.commodity_code,
          category_id: definition.commodity_category_id,
          category_name: category&.name,
          group_name: group_name
        }
      end

      # Resolve the top-level group name for a category.
      # If the category has a parent (ancestry), walk up to the root.
      # Otherwise treat the category itself as the group.
      def resolve_group_name(category, category_map)
        return nil if category.nil?

        # Support ancestry gem: if the category responds to ancestor_ids, walk up
        if category.respond_to?(:ancestor_ids) && category.ancestor_ids.any?
          root_id = category.ancestor_ids.first
          root = category_map[root_id]
          root&.name
        elsif category.respond_to?(:parent_id) && category.parent_id.present?
          parent = category_map[category.parent_id]
          parent&.name
        else
          # Top-level category is itself the group
          category.name
        end
      end
    end
  end
end
