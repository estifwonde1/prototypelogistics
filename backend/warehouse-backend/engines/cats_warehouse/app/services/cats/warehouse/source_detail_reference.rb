# frozen_string_literal: true

module Cats
  module Warehouse
    # Allocates and checks human-facing line identifiers shared across GRN items, inspection items,
    # and receipt order lines so each source detail has a single system-wide unique reference
    # (also used as inventory lot batch number on intake).
    module SourceDetailReference
      module_function

      def generate_unique
        loop do
          cand = "SD#{SecureRandom.alphanumeric(10).upcase}"
          return cand unless taken?(cand)
        end
      end

      def taken?(value, exclude_record: nil)
        return false if value.blank?

        [
          Cats::Warehouse::GrnItem,
          Cats::Warehouse::InspectionItem,
          Cats::Warehouse::ReceiptOrderLine
        ].any? do |model_class|
          scope = model_class.where(line_reference_no: value)
          if exclude_record.is_a?(model_class) && exclude_record.persisted?
            scope = scope.where.not(id: exclude_record.id)
          end
          scope.exists?
        end
      end
    end
  end
end
