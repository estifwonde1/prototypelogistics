class PrintablesController < ApplicationController
  include Cats::Core::DocumentHelper

  ISSUE = 'Issue'.freeze
  RECEIPT = 'Receipt'.freeze

  before_action :set_service, only: %i[hub_authorization issue_receipt receiving_receipt]
  # skip_before_action :authenticate, only: %i[hub_authorization issue_receipt receiving_receipt]

  def hub_authorization
    id = authorization_params[:id]
    auth_type = authorization_params[:authorization_type]

    data = @service.hub_authorization(id)
    data[:prepared_by] = authorization_params[:prepared_by]
    data[:approved_by] = authorization_params[:approved_by]
    data[:authorized_by] = authorization_params[:authorized_by]

    case auth_type
    when ISSUE
      template = File.expand_path('../../templates/issue_authorization_template.docx', __dir__)
      output = File.expand_path('../../templates/issue_authorization.docx', __dir__)
    when RECEIPT
      template = File.expand_path('../../templates/receipt_authorization_template.docx', __dir__)
      output = File.expand_path('../../templates/receipt_authorization.docx', __dir__)
      data[:reference_no] = authorization_params[:authorization_no]
    end

    generate_document(template, output, data)

    file = File.open(output)
    send_file(file.path)
  end

  def issue_receipt
    id = issue_receipt_params[:id]
    template = File.expand_path('../../templates/issue_receipt_template.docx', __dir__)
    output = File.expand_path('../../templates/issue_receipt.docx', __dir__)
    data = @service.issue_receipt(id, current_user)
    p = issue_receipt_params.to_h.symbolize_keys
    p.delete(:id)
    data = data.merge(p)
    generate_document(template, output, data)

    file = File.open(output)
    send_file(file.path)
  end

  def receiving_receipt
    id = receiving_receipt_params[:id]
    template = File.expand_path('../../templates/receiving_receipt_template.docx', __dir__)
    output = File.expand_path('../../templates/receiving_receipt.docx', __dir__)
    data = @service.receiving_receipt(id, current_user)
    p = receiving_receipt_params.to_h.symbolize_keys
    p.delete(:id)
    data = data.merge(p)
    generate_document(template, output, data)

    file = File.open(output)
    send_file(file.path)
  end

  private

  def set_service
    @service = PrintableService.new
  end

  def authorization_params
    params.require(:payload).permit(:id, :authorization_type, :prepared_by, :approved_by, :authorized_by, :authorization_no)
  end

  def issue_receipt_params
    params.require(:payload).permit(:id, :receipt_no, :department, :account_no, :wt_bridge_ticket_no, :container_type,
                                    :no_of_containers, :gross, :net, :license_no, :driver_region, :driver_woreda,
                                    :driver_kebele, :driver_house_no, :driver_id_no)
  end

  def receiving_receipt_params
    params.require(:payload).permit(:id, :receipt_no, :purchase_requisition_no, :requested_by, :invoice_no,
                                    :wt_bridge_ticket_no, :container_type, :no_of_containers, :gross, :net)
  end
end
