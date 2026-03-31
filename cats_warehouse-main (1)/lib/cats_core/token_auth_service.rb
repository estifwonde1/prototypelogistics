module Cats
  module Core
    class TokenAuthService
      SECRET = 'your-secret-key' # Change this to a secure key

      def self.issue(payload)
        JWT.encode(payload, SECRET, 'HS256')
      end

      def self.decode(token)
        JWT.decode(token, SECRET, true, algorithm: 'HS256').first
      rescue
        nil
      end
    end
  end
end