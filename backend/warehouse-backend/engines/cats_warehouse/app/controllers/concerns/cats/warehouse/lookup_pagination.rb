# frozen_string_literal: true

module Cats
  module Warehouse
    module LookupPagination
      extend ActiveSupport::Concern

      private

      def paginate_scope(scope, search_columns: %w[name code])
        page = [params[:page].to_i, 1].max
        per_page = params[:per_page].present? ? [[params[:per_page].to_i, 1].max, 100].min : 25

        if params[:q].present? && search_columns.any?
          q = "%#{params[:q].to_s.strip}%"
          table = scope.klass.table_name
          conditions = search_columns.map { |col| "#{table}.#{col} ILIKE ?" }.join(" OR ")
          scope = scope.where(conditions, *([q] * search_columns.length))
        end

        if params[:ids].present?
          ids = Array(params[:ids]).map(&:to_i).reject(&:zero?)
          scope = scope.where(id: ids) if ids.any?
        end

        total = scope.count
        items = scope.offset((page - 1) * per_page).limit(per_page)

        { items: items, meta: { page: page, per_page: per_page, total_count: total } }
      end

      def render_paginated_lookup(scope, serializer: LookupOptionSerializer, search_columns: %w[name code])
        result = paginate_scope(scope, search_columns: search_columns)
        render_success(
          items: ActiveModelSerializers::SerializableResource.new(result[:items], each_serializer: serializer).as_json,
          meta: result[:meta]
        )
      end
    end
  end
end
