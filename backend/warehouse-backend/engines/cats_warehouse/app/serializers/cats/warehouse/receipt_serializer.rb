module Cats
  module Warehouse
    class ReceiptSerializer < ApplicationSerializer
      attributes :id,
                 :reference_no,
                 :receipt_authorization_id,
                 :commodity_status,
                 :commodity_grade,
                 :quantity,
                 :unit_id,
                 :remark,
                 :created_at,
                 :updated_at
    end
  end
end
