# frozen_string_literal: true

require "rails_helper"

RSpec.describe Cats::Warehouse::ReceiptOrderCompletionChecker, type: :model do
  let(:hub) { create(:cats_warehouse_hub) }
  let(:warehouse) { create(:cats_warehouse_warehouse, hub: hub) }
  let(:store) { create(:cats_warehouse_store, warehouse: warehouse) }
  let(:actor) { create(:cats_core_user, role_name: "Hub Manager") }
  let(:commodity) { create(:cats_core_commodity) }
  let(:unit) { commodity.unit_of_measure }
  let(:transporter) { create(:cats_core_transporter) }

  let(:receipt_order) do
    Cats::Warehouse::ReceiptOrder.create!(
      hub: hub,
      created_by: actor,
      status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:in_progress],
      reference_no: "RO-ROC-#{SecureRandom.hex(4)}",
      received_date: Date.current
    )
  end

  def build_ra!(line:, qty:, status:, line_id: line.id)
    Cats::Warehouse::ReceiptAuthorization.create!(
      receipt_order: receipt_order,
      receipt_order_line_id: line_id,
      receipt_order_line: line_id ? line : nil,
      warehouse: warehouse,
      store: store,
      transporter: transporter,
      created_by: actor,
      status: status,
      authorized_quantity: qty,
      driver_name: "Driver",
      driver_id_number: "ID-1",
      truck_plate_number: "AA-11111",
      waybill_number: "WB-#{SecureRandom.hex(4)}",
      reference_no: "RA-ROC-#{SecureRandom.hex(5)}"
    )
  end

  before do
    allow(Cats::Warehouse::NotificationFanout).to receive(:deliver)
    allow(Cats::Warehouse::WorkflowEventRecorder).to receive(:record!)
  end

  context "single line 10 mt" do
    let!(:line) do
      Cats::Warehouse::ReceiptOrderLine.create!(
        receipt_order: receipt_order,
        commodity: commodity,
        unit: unit,
        quantity: 10,
        line_reference_no: "RL-ROC-#{SecureRandom.hex(4)}"
      )
    end

    it "does not complete when only a 2 mt RA is closed (remainder never authorized)" do
      build_ra!(line: line, qty: 2, status: Cats::Warehouse::ReceiptAuthorization::CLOSED, line_id: line.id)

      described_class.new(receipt_order: receipt_order.reload, actor: actor).call

      expect(receipt_order.reload.status).to eq(Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:in_progress])
      expect(Cats::Warehouse::NotificationFanout).not_to have_received(:deliver).with(
        "receipt_order.completed",
        hash_including(receipt_order_id: receipt_order.id)
      )
    end

    it "completes when two closed RAs sum to the line quantity" do
      build_ra!(line: line, qty: 4, status: Cats::Warehouse::ReceiptAuthorization::CLOSED, line_id: line.id)
      build_ra!(line: line, qty: 6, status: Cats::Warehouse::ReceiptAuthorization::CLOSED, line_id: line.id)

      described_class.new(receipt_order: receipt_order.reload, actor: actor).call

      expect(receipt_order.reload.status).to eq(Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:completed])
      expect(Cats::Warehouse::NotificationFanout).to have_received(:deliver).with(
        "receipt_order.completed",
        hash_including(receipt_order_id: receipt_order.id)
      )
    end

    it "attributes nil receipt_order_line_id to the sole line when closed" do
      ra = build_ra!(line: line, qty: 10, status: Cats::Warehouse::ReceiptAuthorization::CLOSED, line_id: nil)
      ra.update_columns(receipt_order_line_id: nil)

      described_class.new(receipt_order: receipt_order.reload, actor: actor).call

      expect(receipt_order.reload.status).to eq(Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:completed])
    end

    it "does not complete while a non-cancelled RA is still pending" do
      build_ra!(line: line, qty: 5, status: Cats::Warehouse::ReceiptAuthorization::CLOSED, line_id: line.id)
      build_ra!(line: line, qty: 5, status: Cats::Warehouse::ReceiptAuthorization::PENDING, line_id: line.id)

      described_class.new(receipt_order: receipt_order.reload, actor: actor).call

      expect(receipt_order.reload.status).to eq(Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:in_progress])
    end
  end

  context "two lines" do
    let!(:line_a) do
      Cats::Warehouse::ReceiptOrderLine.create!(
        receipt_order: receipt_order,
        commodity: commodity,
        unit: unit,
        quantity: 5,
        line_reference_no: "RL-ROC-A-#{SecureRandom.hex(4)}"
      )
    end
    let!(:line_b) do
      Cats::Warehouse::ReceiptOrderLine.create!(
        receipt_order: receipt_order,
        commodity: commodity,
        unit: unit,
        quantity: 5,
        line_reference_no: "RL-ROC-B-#{SecureRandom.hex(4)}"
      )
    end

    it "does not complete when only one line is fully covered by closed RAs" do
      build_ra!(line: line_a, qty: 5, status: Cats::Warehouse::ReceiptAuthorization::CLOSED, line_id: line_a.id)

      described_class.new(receipt_order: receipt_order.reload, actor: actor).call

      expect(receipt_order.reload.status).to eq(Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:in_progress])
    end

    it "does not complete when a closed RA has no line id on a multi-line order" do
      ra = build_ra!(line: line_a, qty: 10, status: Cats::Warehouse::ReceiptAuthorization::CLOSED, line_id: line_a.id)
      ra.update_columns(receipt_order_line_id: nil)

      described_class.new(receipt_order: receipt_order.reload, actor: actor).call

      expect(receipt_order.reload.status).to eq(Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:in_progress])
    end

    it "completes when each line has enough closed RA quantity" do
      build_ra!(line: line_a, qty: 5, status: Cats::Warehouse::ReceiptAuthorization::CLOSED, line_id: line_a.id)
      build_ra!(line: line_b, qty: 5, status: Cats::Warehouse::ReceiptAuthorization::CLOSED, line_id: line_b.id)

      described_class.new(receipt_order: receipt_order.reload, actor: actor).call

      expect(receipt_order.reload.status).to eq(Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:completed])
    end
  end

  context "self-heal wrongly completed receipt order" do
    let!(:line) do
      Cats::Warehouse::ReceiptOrderLine.create!(
        receipt_order: receipt_order,
        commodity: commodity,
        unit: unit,
        quantity: 10,
        line_reference_no: "RL-ROC-#{SecureRandom.hex(4)}"
      )
    end

    it "reverts completed to in_progress when all RAs are closed but lines are under-covered" do
      receipt_order.update!(status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:completed])
      build_ra!(line: line, qty: 2, status: Cats::Warehouse::ReceiptAuthorization::CLOSED, line_id: line.id)

      described_class.new(receipt_order: receipt_order.reload, actor: actor).call

      expect(receipt_order.reload.status).to eq(Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:in_progress])
      expect(Cats::Warehouse::WorkflowEventRecorder).to have_received(:record!).with(
        hash_including(event_type: "receipt_order.completion_reverted")
      )
    end
  end
end
