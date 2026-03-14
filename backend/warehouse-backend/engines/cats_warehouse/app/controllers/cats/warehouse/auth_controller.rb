module Cats
  module Warehouse
    class AuthController < BaseController
      skip_before_action :authenticate_user!
      skip_after_action :verify_authorized

      def login
        payload = params.require(:payload).permit(:email, :password)
        user = Cats::Core::User.find_by(email: payload[:email])

        unless user&.authenticate(payload[:password])
          return render_error("Invalid credentials", status: :unauthorized)
        end

        token = user.signed_id(purpose: "auth", expires_in: 24.hours)
        render_success({ token: token, user_id: user.id })
      end
    end
  end
end
