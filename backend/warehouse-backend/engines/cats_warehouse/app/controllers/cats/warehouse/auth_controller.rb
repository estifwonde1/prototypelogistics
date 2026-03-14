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
        # Prefer warehouse module role for this app; fallback to first role (e.g. Admin)
        warehouse_module = Cats::Core::ApplicationModule.find_by(prefix: "warehouse")
        role_record = if warehouse_module
                        user.roles.find_by(application_module: warehouse_module)
                      end
        role_record ||= user.roles.first
        role_name = role_record&.name

        render_success({ token: token, user_id: user.id, role: role_name })
      end
    end
  end
end
