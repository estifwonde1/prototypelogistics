module Cats
  module Warehouse
    class PolymorphicReferenceResolver
      SOURCE_MAP = {
        "Receipt" => "Cats::Core::Receipt",
        "Cats::Core::Receipt" => "Cats::Core::Receipt",
        "Waybill" => "Cats::Warehouse::Waybill",
        "Cats::Warehouse::Waybill" => "Cats::Warehouse::Waybill",
        "Grn" => "Cats::Warehouse::Grn",
        "Cats::Warehouse::Grn" => "Cats::Warehouse::Grn"
      }.freeze

      DESTINATION_MAP = {
        "Dispatch" => "Cats::Core::Dispatch",
        "Cats::Core::Dispatch" => "Cats::Core::Dispatch",
        "Waybill" => "Cats::Warehouse::Waybill",
        "Cats::Warehouse::Waybill" => "Cats::Warehouse::Waybill"
      }.freeze

      def self.resolve_source(type, id)
        resolve(type, id, SOURCE_MAP)
      end

      def self.resolve_destination(type, id)
        resolve(type, id, DESTINATION_MAP)
      end

      def self.resolve(type, id, mapping)
        return nil if type.blank? || id.blank?

        klass_name = mapping[type]
        raise ArgumentError, "Unsupported reference type: #{type}" if klass_name.blank?

        klass_name.constantize.find(id)
      end
      private_class_method :resolve
    end
  end
end
