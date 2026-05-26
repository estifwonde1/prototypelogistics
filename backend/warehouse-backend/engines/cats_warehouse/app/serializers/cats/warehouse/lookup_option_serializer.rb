# frozen_string_literal: true

module Cats
  module Warehouse
    class LookupOptionSerializer < ApplicationSerializer
      attributes :id, :name, :code, :label, :location_type, :meta

      def label
        code = object.respond_to?(:code) ? object.code : nil
        name = object.respond_to?(:name) ? object.name : object.try(:label)
        code.present? ? "#{name} (#{code})" : name.to_s
      end

      def location_type
        object.location_type if object.respond_to?(:location_type)
      end

      def meta
        {}
      end
    end
  end
end
