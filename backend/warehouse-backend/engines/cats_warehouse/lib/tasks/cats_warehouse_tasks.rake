# desc "Explaining what the task does"
# task :cats_warehouse do
#   # Task goes here
# end

namespace :cats_warehouse do
  desc "Recalculate hub capacity rollups from child warehouse dimensions"
  task recalculate_hub_capacities: :environment do
    count = 0
    Cats::Warehouse::Hub.find_each do |hub|
      Cats::Warehouse::HubCapacityRecalculator.call(hub)
      count += 1
    end
    puts "Recalculated capacity for #{count} hub(s)."
  end
end
