module Cats
  module Warehouse
    class InAppNotificationSerializer < ApplicationSerializer
      attributes :id, :type, :title, :body, :params, :read_at, :created_at

      def type
        object.read_attribute(:type)
      end

      def title
        copy[:title]
      end

      def body
        copy[:body]
      end

      private

      def copy
        @copy ||= InAppNotificationCopy.for(object.read_attribute(:type), object.params || {})
      end
    end
  end
end
