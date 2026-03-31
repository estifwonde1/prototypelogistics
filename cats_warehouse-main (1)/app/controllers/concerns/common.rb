# A module that defines common actions for controller classes which includes it
module Common
  extend ActiveSupport::Concern

  included do
    before_action :set_clazz
    before_action :set_object, only: %i[show update]
  end

  def index
    data = serialize(@clazz.all)
    render json: { success: true, data: data }
  end

  def show
    render json: { success: true, data: serialize(@obj) }
  end

  def create
    obj = @clazz.new(model_params)
    if obj.save
      render json: { success: true, data: serialize(obj) }, status: :created
    else
      render json: { success: false, error: obj.errors.full_messages[0] }, status: :unprocessable_entity
    end
  end

  def update
    if @obj.update(model_params)
      render json: { success: true, data: serialize(@obj) }
    else
      render json: { success: false, error: @obj.errors.full_messages[0] }, status: :unprocessable_entity
    end
  end

  private

  def serialize(data)
    ActiveModelSerializers::SerializableResource.new(data)
  end

  def set_clazz
    @clazz = "Cats::Core::#{controller_name.classify}".constantize
  end

  def set_object
    @obj = @clazz.find(params[:id])
  end

  # This class should be overridden by respective child controllers
  def model_params; end
end
