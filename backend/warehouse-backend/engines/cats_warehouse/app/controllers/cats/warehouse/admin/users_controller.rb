module Cats
  module Warehouse
    module Admin
      class UsersController < BaseController
        skip_after_action :verify_authorized, raise: false

        def index
          users = Cats::Core::User.where(application_module_id: application_module.id).order(:id)

          if params[:warehouse_id].present?
            users = users.joins("INNER JOIN cats_warehouse_user_assignments uwa ON uwa.user_id = cats_core_users.id")
                         .joins("LEFT JOIN cats_warehouse_stores s ON s.id = uwa.store_id")
                         .where("uwa.warehouse_id = :wid OR s.warehouse_id = :wid", wid: params[:warehouse_id])
          end

          if params[:hub_id].present?
            users = users.joins("INNER JOIN cats_warehouse_user_assignments uha ON uha.user_id = cats_core_users.id")
                         .where("uha.hub_id = ?", params[:hub_id])
          end

          if params[:store_id].present?
            users = users.joins("INNER JOIN cats_warehouse_user_assignments usa ON usa.user_id = cats_core_users.id")
                         .where("usa.store_id = ?", params[:store_id])
          end

          if params[:role_name].present?
            users = users.joins(:roles).where(cats_core_roles: { name: params[:role_name] })
          end

          users = users.distinct

          render_success(users: users.map { |u| user_payload(u) })
        end

        def create
          payload = user_params
          unless required_user_fields_present?(payload)
            return render_error("Missing required user fields", status: :unprocessable_entity)
          end
          unless role_payload_present?(payload)
            return render_error("role_name is required", status: :unprocessable_entity)
          end
          unless password_confirmation_valid?(payload)
            return render_error("Password confirmation does not match", status: :unprocessable_entity)
          end

          if email_taken?(payload[:email])
            return render_error("Email already exists", status: :unprocessable_entity)
          end

          user = Cats::Core::User.new(payload.except(:role_names, :role_name))
          user.application_module = application_module
          user.save!

          assign_roles(user, payload)

          render_success({ user: user_payload(user) }, status: :created)
        end

        def update
          user = Cats::Core::User.find(params[:id])
          payload = user_params

          if payload[:password].present? && !password_confirmation_valid?(payload)
            return render_error("Password confirmation does not match", status: :unprocessable_entity)
          end

          if payload[:email].present? && email_taken?(payload[:email], user.id)
            return render_error("Email already exists", status: :unprocessable_entity)
          end

          user.update!(payload.except(:role_names, :role_name))
          assign_roles(user, payload)

          render_success({ user: user_payload(user) })
        end

        def destroy
          user = Cats::Core::User.find(params[:id])
          Cats::Warehouse::UserAssignment.where(user_id: user.id).delete_all
          user.destroy!
          render_success({ id: user.id })
        end

        private

        def application_module
          @application_module ||= Cats::Core::ApplicationModule.find_by(prefix: "CATS-WH")
        end

        def assign_roles(user, payload)
          role_names = payload[:role_names] || Array(payload[:role_name])
          role_names = role_names.compact
          return if role_names.empty?

          roles = Cats::Core::Role.where(application_module_id: application_module.id, name: role_names)

          # Replace roles to allow role switching
          user.roles = roles
        end

        def user_params
          params.require(:payload).permit(
            :first_name,
            :last_name,
            :email,
            :password,
            :password_confirmation,
            :phone_number,
            :active,
            :role_name,
            role_names: []
          )
        end

        def required_user_fields_present?(payload)
          payload[:first_name].present? &&
            payload[:last_name].present? &&
            payload[:email].present? &&
            payload[:phone_number].present? &&
            payload[:password].present?
        end

        def role_payload_present?(payload)
          payload[:role_name].present? || payload[:role_names].present?
        end

        def password_confirmation_valid?(payload)
          return true unless payload[:password].present?

          payload[:password] == payload[:password_confirmation]
        end

        def email_taken?(email, current_user_id = nil)
          scope = Cats::Core::User.where(email: email)
          scope = scope.where.not(id: current_user_id) if current_user_id
          scope.exists?
        end

        def user_payload(user)
          {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone_number: user.phone_number,
            active: user.active,
            roles: user.roles.map(&:name)
          }
        end
      end
    end
  end
end
