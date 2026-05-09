# frozen_string_literal: true

# Adds weight units Kuntal (metric quintal = 100 kg) and Pound (avoirdupois),
# with global UOM edges into Kilogram so existing kg → mt (and other) chains work site-wide.
class AddKuntalPoundUomUnitsAndConversions < ActiveRecord::Migration[7.0]
  # 1 lb = 0.45359237 kg (international avoirdupois pound)
  LB_TO_KG = BigDecimal("0.45359237")
  # 1 metric quintal (kuntal) = 100 kg
  KNTL_TO_KG = BigDecimal("100")
  # Direct to metric ton (backend resolver is single-hop; these mirror kg→mt chain)
  LB_TO_MT = LB_TO_KG * BigDecimal("0.001")
  KNTL_TO_MT = KNTL_TO_KG * BigDecimal("0.001")

  def up
    return unless table_exists?(:cats_core_unit_of_measures)

    weight_type = Cats::Core::UnitOfMeasure::WEIGHT

    kntl = Cats::Core::UnitOfMeasure.find_or_initialize_by(abbreviation: "kntl")
    kntl.assign_attributes(name: "Kuntal (100 kg)", unit_type: weight_type)
    kntl.save!

    lb = Cats::Core::UnitOfMeasure.find_or_initialize_by(abbreviation: "lb")
    lb.assign_attributes(name: "Pound", unit_type: weight_type)
    lb.save!

    kg = Cats::Core::UnitOfMeasure.find_by(abbreviation: "kg")
    mt = Cats::Core::UnitOfMeasure.find_by(abbreviation: "mt")
    return unless kg

    seed_conversion!(from_unit: kntl, to_unit: kg, multiplier: KNTL_TO_KG)
    seed_conversion!(from_unit: lb, to_unit: kg, multiplier: LB_TO_KG)

    if mt
      seed_conversion!(from_unit: kntl, to_unit: mt, multiplier: KNTL_TO_MT)
      seed_conversion!(from_unit: lb, to_unit: mt, multiplier: LB_TO_MT)
    end
  end

  def down
    return unless table_exists?(:cats_core_unit_of_measures)

    kntl = Cats::Core::UnitOfMeasure.find_by(abbreviation: "kntl")
    lb = Cats::Core::UnitOfMeasure.find_by(abbreviation: "lb")
    kg = Cats::Core::UnitOfMeasure.find_by(abbreviation: "kg")
    mt = Cats::Core::UnitOfMeasure.find_by(abbreviation: "mt")

    [kntl, lb].compact.each do |unit|
      next unless kg

      Cats::Warehouse::UomConversion.where(commodity_id: nil, from_unit_id: unit.id, to_unit_id: kg.id).delete_all
      if mt
        Cats::Warehouse::UomConversion.where(commodity_id: nil, from_unit_id: unit.id, to_unit_id: mt.id).delete_all
      end
    end

    lb&.destroy
    kntl&.destroy
  end

  private

  def seed_conversion!(from_unit:, to_unit:, multiplier:)
    return unless table_exists?(:cats_warehouse_uom_conversions)

    row = Cats::Warehouse::UomConversion.find_or_initialize_by(
      commodity_id: nil,
      from_unit_id: from_unit.id,
      to_unit_id: to_unit.id
    )
    row.assign_attributes(multiplier: multiplier, active: true, conversion_type: "weight")
    row.save!
  end
end
