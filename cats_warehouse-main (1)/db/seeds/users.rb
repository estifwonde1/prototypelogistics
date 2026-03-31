
# db/seeds/users.rb

puts '****************************** Seeding Users *************************************'

application_module = Cats::Core::ApplicationModule.find_by(prefix: 'CATS-WH')

unless application_module
  puts 'Application module CATS-WH not found. Please run main seeds first.'
  return
end

roles_data = [
  { name: 'admin', count: 1 },
  { name: 'hub_manager', count: 2 },
  { name: 'warehouse_manager', count: 2 },
  { name: 'store_keeper', count: 2 },
  { name: 'fdp_store_keeper', count: 2 },
  { name: 'dispatch_planner', count: 2 },
  { name: 'psnp_manager', count: 2 },
  { name: 'storage_and_reserve_officer', count: 2 },
  { name: 'logistics_officer', count: 2 },
  { name: 'hub_and_dispatch_officer', count: 2 },
  { name: 'hub_and_dispatch_approver', count: 2 },
  { name: 'dispatcher', count: 2 }
]

first_names = %w[John Jane Michael Emily David Sarah Robert Linda James Barbara William Susan Joseph Margaret Thomas Jessica Christopher Sarah Karen]

user_index = 0

roles_data.each do |role_info|
  role_name = role_info[:name]
  role = Cats::Core::Role.find_by(name: role_name, application_module: application_module)
  
  unless role
    puts "Role #{role_name} not found. Skipping..."
    next
  end

  role_info[:count].times do |i|
    first_name = first_names[user_index % first_names.length]
    # Naming convention: Last name = role name, Format: FirstName + RoleName
    # Example: John Manager
    # Wait, the requirement says: "Last name = role name. Format: FirstName + RoleName. Example: John Manager"
    # This is slightly contradictory. "Format: FirstName + RoleName" could mean the full name is FirstNameRoleName, 
    # but the example "John Manager" shows Last Name is "Manager".
    # I'll stick to: first_name = actual first name, last_name = role name formatted nicely.
    
    display_role_name = role_name.split('_').map(&:capitalize).join(' ')
    email = "#{first_name.downcase}.#{role_name}#{i + 1}@example.com"
    
    user = Cats::Core::User.where(email: email).first_or_initialize
    user.first_name = first_name
    user.last_name = display_role_name
    user.password = 'password123'
    user.application_module = application_module
    user.active = true
    user.save!
    
    # Assign role
    # Assuming the User model has add_role method as seen in seeds.rb
    # Or we can do it manually if add_role is from a library like rolify
    user.roles << role unless user.roles.include?(role)
    
    puts "Created user: #{user.first_name} #{user.last_name} (#{email}) with role: #{role_name}"
    user_index += 1
  end
end

puts '****************************** Users Seeded Successfully **************************'
