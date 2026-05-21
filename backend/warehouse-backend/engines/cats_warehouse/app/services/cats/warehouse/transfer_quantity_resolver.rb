# frozen_string_literal: true

module Cats
  module Warehouse
  # Resolves transfer quantity in the source stack's canonical unit from either
  # +quantity+ (stack unit) or +entered_quantity+ / +entered_unit_id+.
    class TransferQuantityResolver
      Result = Struct.new(
        :canonical_quantity,
        :entered_unit_id,
        :entered_quantity,
        keyword_init: true
      )

      def self.resolve(source_stack:, quantity: nil, entered_unit_id: nil, entered_quantity: nil)
        canonical_unit_id = source_stack.unit_id
        raise ArgumentError, "Source stack has no unit of measure" if canonical_unit_id.blank?

        if entered_unit_id.present? && entered_quantity.present?
          from_id = entered_unit_id.to_i
          entered_qty = entered_quantity.to_f
          canonical = UomConversionResolver.convert!(
            entered_qty,
            from_unit_id: from_id,
            to_unit_id: canonical_unit_id,
            commodity_id: source_stack.commodity_id
          )
          Result.new(
            canonical_quantity: canonical,
            entered_unit_id: from_id,
            entered_quantity: entered_qty
          )
        elsif quantity.present?
          qty = quantity.to_f
          Result.new(
            canonical_quantity: qty,
            entered_unit_id: canonical_unit_id,
            entered_quantity: qty
          )
        else
          raise ArgumentError, "Quantity is required"
        end
      end
    end
  end
end
