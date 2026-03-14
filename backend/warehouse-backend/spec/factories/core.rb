FactoryBot.define do
  sequence(:core_code) { |n| "CODE#{n}" }
  sequence(:core_name) { |n| "Name #{n}" }
  sequence(:core_abbr) { |n| "u#{n}" }

  factory :cats_core_program, class: "Cats::Core::Program" do
    code { generate(:core_code) }
    name { generate(:core_name) }
  end

  factory :cats_core_donor, class: "Cats::Core::Donor" do
    code { generate(:core_code) }
    name { generate(:core_name) }
  end

  factory :cats_core_project, class: "Cats::Core::Project" do
    code { generate(:core_code) }
    program { association :cats_core_program }
    source { association :cats_core_donor }
    year { Date.today.year }
    implementing_agency { "Test Agency" }
  end

  factory :cats_core_unit_of_measure, class: "Cats::Core::UnitOfMeasure" do
    name { "Unit #{generate(:core_name)}" }
    abbreviation { generate(:core_abbr) }
    unit_type { "Weight" }
  end

  factory :cats_core_location, class: "Cats::Core::Location" do
    code { generate(:core_code) }
    name { generate(:core_name) }
    location_type { "Region" }
  end

  factory :cats_core_commodity, class: "Cats::Core::Commodity" do
    batch_no { "BATCH-#{generate(:core_code)}" }
    unit_of_measure { association :cats_core_unit_of_measure }
    project { association :cats_core_project }
    quantity { 100 }
    best_use_before { Date.today + 365 }
  end
end
