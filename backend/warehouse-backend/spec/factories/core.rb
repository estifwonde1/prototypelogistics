FactoryBot.define do
  sequence(:core_code) { |n| "CODE#{n}" }
  sequence(:core_name) { |n| "Name #{n}" }
  sequence(:core_abbr) { |n| "u#{n}" }
  sequence(:core_email) { |n| "user#{n}@example.com" }

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

  factory :cats_core_application_module, class: "Cats::Core::ApplicationModule" do
    prefix { "core" }
    name { "Core" }
  end

  factory :cats_core_role, class: "Cats::Core::Role" do
    name { "Admin" }
    application_module { association :cats_core_application_module }
  end

  factory :cats_core_user, class: "Cats::Core::User" do
    first_name { "Test" }
    last_name { "User" }
    email { generate(:core_email) }
    password { "Password1!" }
    active { true }
    application_module { association :cats_core_application_module }

    transient do
      role_name { nil }
    end

    after(:create) do |user, evaluator|
      next if evaluator.role_name.blank?

      role = Cats::Core::Role.find_or_create_by!(name: evaluator.role_name, application_module: user.application_module)
      user.roles << role unless user.roles.exists?(role.id)
    end
  end

  factory :cats_core_commodity, class: "Cats::Core::Commodity" do
    batch_no { "BATCH-#{generate(:core_code)}" }
    unit_of_measure { association :cats_core_unit_of_measure }
    project { association :cats_core_project }
    quantity { 100 }
    best_use_before { Date.today + 365 }
  end

  factory :cats_core_transporter, class: "Cats::Core::Transporter" do
    name { "Transporter #{generate(:core_name)}" }
    address { "Transporter Address" }
    contact_phone { "+251911000000" }
  end
end
