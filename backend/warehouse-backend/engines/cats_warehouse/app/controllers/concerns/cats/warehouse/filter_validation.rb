# frozen_string_literal: true

module Cats
  module Warehouse
    module FilterValidation
      extend ActiveSupport::Concern

      private

      # Sanitize input for LIKE queries to prevent SQL injection
      def sanitize_like_input(input)
        return '' if input.blank?
        # Escape SQL LIKE wildcards and backslashes
        input.to_s.gsub(/[%_\\]/, '\\\\\\&')
      end

      # Validate and convert ID parameter
      def validate_id_param(param_name, required: false)
        param_value = params[param_name]
        
        if param_value.blank?
          return nil unless required
          raise ArgumentError, "#{param_name} is required"
        end

        id = param_value.to_i
        raise ArgumentError, "Invalid #{param_name}" if id <= 0
        
        id
      end

      # Validate warehouse access for current user
      def validate_warehouse_access!(warehouse_id)
        access = AccessContext.new(user: current_user)
        unless access.accessible_warehouse_ids.include?(warehouse_id)
          raise Pundit::NotAuthorizedError, "Access denied to warehouse #{warehouse_id}"
        end
      end

      # Validate store access for current user
      def validate_store_access!(store_id)
        access = AccessContext.new(user: current_user)
        unless access.assigned_store_ids.include?(store_id)
          raise Pundit::NotAuthorizedError, "Access denied to store #{store_id}"
        end
      end

      # Validate hub access for current user
      def validate_hub_access!(hub_id)
        access = AccessContext.new(user: current_user)
        unless access.accessible_hub_ids.include?(hub_id)
          raise Pundit::NotAuthorizedError, "Access denied to hub #{hub_id}"
        end
      end

      # Validate status parameter against allowed values
      def validate_status_param(param_name, allowed_statuses)
        status = params[param_name]
        return nil if status.blank?
        
        unless allowed_statuses.include?(status)
          raise ArgumentError, "Invalid #{param_name}. Allowed values: #{allowed_statuses.join(', ')}"
        end
        
        status
      end

      # Validate date parameter
      def validate_date_param(param_name, required: false)
        date_string = params[param_name]
        
        if date_string.blank?
          return nil unless required
          raise ArgumentError, "#{param_name} is required"
        end

        begin
          date = Date.parse(date_string)
          
          # Validate reasonable date ranges (not too far in the past/future)
          current_date = Date.current
          min_date = current_date - 10.years
          max_date = current_date + 1.year

          if date < min_date || date > max_date
            raise ArgumentError, "#{param_name} is out of reasonable range (#{min_date} to #{max_date})"
          end

          date
        rescue ArgumentError => e
          raise ArgumentError, "Invalid #{param_name} format: #{e.message}"
        end
      end

      # Validate date range
      def validate_date_range(from_param = :from, to_param = :to)
        from_date = validate_date_param(from_param) if params[from_param].present?
        to_date = validate_date_param(to_param) if params[to_param].present?

        if from_date && to_date && from_date > to_date
          raise ArgumentError, "#{from_param} date cannot be after #{to_param} date"
        end

        return nil if from_date.nil? && to_date.nil?

        if from_date && to_date
          from_date..to_date
        elsif from_date
          from_date..Date.current
        elsif to_date
          Date.new(1900, 1, 1)..to_date
        end
      end
    end
  end
end