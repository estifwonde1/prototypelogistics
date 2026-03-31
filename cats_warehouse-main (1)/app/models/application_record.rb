class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true

  def self.serialize(data, serializer = nil)
    return ActiveModelSerializers::SerializableResource.new(data).as_json if serializer.nil?

    ActiveModelSerializers::SerializableResource.new(data, each_serializer: serializer).as_json
  end
end
