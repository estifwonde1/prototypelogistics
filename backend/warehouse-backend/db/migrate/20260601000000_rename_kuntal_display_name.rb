# frozen_string_literal: true

class RenameKuntalDisplayName < ActiveRecord::Migration[7.0]
  def up
    return unless table_exists?(:cats_core_unit_of_measures)

    kntl = Cats::Core::UnitOfMeasure.find_by(abbreviation: "kntl")
    return unless kntl

    kntl.update_column(:name, "Kuntal") if kntl.name == "Kuntal (100 kg)"
  end

  def down
    return unless table_exists?(:cats_core_unit_of_measures)

    kntl = Cats::Core::UnitOfMeasure.find_by(abbreviation: "kntl")
    return unless kntl

    kntl.update_column(:name, "Kuntal (100 kg)")
  end
end
