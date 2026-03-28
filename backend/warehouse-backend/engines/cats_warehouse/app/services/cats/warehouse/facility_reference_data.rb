module Cats
  module Warehouse
    class FacilityReferenceData
      OPTIONS = {
        loading_dock_type: [
          { value: "flush", label: "Flush Dock" },
          { value: "enclosed", label: "Enclosed Dock" },
          { value: "sawtooth", label: "Sawtooth Dock" }
        ],
        access_road_type: [
          { value: "asphalt", label: "Asphalt" },
          { value: "concrete", label: "Concrete" },
          { value: "gravel", label: "Gravel" },
          { value: "earth", label: "Earth" }
        ],
        floor_type: [
          { value: "concrete", label: "Concrete" },
          { value: "cement", label: "Cement" },
          { value: "compacted_earth", label: "Compacted Earth" }
        ],
        roof_type: [
          { value: "sheet_metal", label: "Sheet Metal" },
          { value: "concrete_slab", label: "Concrete Slab" },
          { value: "tile", label: "Tile" }
        ]
      }.freeze

      def self.options_for(group_key)
        OPTIONS.fetch(group_key.to_sym)
      end

      def self.as_json
        OPTIONS.transform_values(&:dup)
      end
    end
  end
end
