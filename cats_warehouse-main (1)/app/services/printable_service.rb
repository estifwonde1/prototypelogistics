class PrintableService
  def hub_authorization(id)
    item = Cats::Core::DispatchPlanItem.includes(
      :dispatch_plan,
      :source,
      :destination,
      :unit,
      { commodity: { project: :source } }
    ).find(id)
    commodity_source = item.commodity.project.source
    donor = commodity_source.respond_to?('donor') ? commodity_source.donor.name : nil
    commodity_name = commodity_source.respond_to?(:commodity_name) ? commodity_source.commodity_name : commodity_label(item.commodity)
    {
      date: Date.today,
      requisition_no: item.dispatch_plan.reference_no,
      reference_no: item.reference_no,
      source: item.source.name,
      destination: item.destination.name,
      commodity_source: commodity_source.description,
      donor: donor,
      commodities: [
        {
          s_no: 1,
          name: commodity_name,
          batch_no: item.commodity.batch_no,
          quantity: item.quantity,
          unit: item.unit.abbreviation,
          vessel_name: item.commodity.shipping_reference
        }
      ]
    }
  end

  def issue_receipt(id, user)
    authorization = Cats::Core::DispatchAuthorization.includes(
      { dispatch: [:transporter, :unit, { dispatch_plan_item: %i[source destination dispatch_plan commodity] }] },
      :store
    ).find(id)

    dispatch = authorization.dispatch
    dpi = dispatch.dispatch_plan_item
    dispatch_plan = dpi.dispatch_plan
    # dispatchable is polymorphic (e.g. RoundPlan) and may be nil
    plan_reference = dispatch_plan.dispatchable&.reference_no.presence || dispatch_plan.reference_no.presence || ''

    destination = dpi.destination
    fdp = destination.location_type == Cats::Core::Location::FDP ? destination : nil
    woreda = destination.location_type == Cats::Core::Location::WOREDA ? destination : destination.parent
    region_name = woreda.parent&.parent&.name.presence || ''
    zone_name = woreda.parent&.name.presence || ''

    {
      date: Date.today,
      plan_reference: plan_reference,
      authorization_no: dpi.reference_no.to_s,
      source: dpi.source&.name.to_s,
      store: authorization.store&.code.to_s,
      region: region_name,
      zone: zone_name,
      woreda: woreda.name.to_s,
      fdp: fdp&.name,
      transporter: dispatch.transporter&.name.to_s,
      plate_no: dispatch.plate_no.to_s,
      prepared_by: user.full_name.to_s,
      driver_name: dispatch.driver_name.to_s,
      commodities: [
        {
          s_no: 1,
          name: commodity_label(dpi.commodity),
          batch_no: dpi.commodity&.batch_no.to_s,
          quantity: authorization.quantity,
          unit: dispatch.unit&.abbreviation.to_s
        }
      ]
    }
  end

  def receiving_receipt(id, user)
    authorization = Cats::Core::ReceiptAuthorization.includes(
      {
        dispatch: [
          :transporter,
          {
            dispatch_plan_item: [
              :source,
              :destination,
              :dispatch_plan,
              {
                commodity: { project: :source }
              }
            ]
          }
        ]
      },
      :store
    ).find(id)

    commodity_source = authorization.dispatch.dispatch_plan_item.commodity.project.source
    po_reference = commodity_source.instance_of?(Cats::Core::PurchaseOrder) ? commodity_source.reference_no : nil
    commodity_grade = authorization.receipts.first&.commodity_grade
    donor = commodity_source.respond_to?('donor') ? commodity_source.donor.name : nil
    {
      date: Date.today,
      donor: donor,
      transporter: authorization.dispatch.transporter.name,
      dispatch_reference_no: authorization.dispatch.reference_no,
      destination: authorization.dispatch.dispatch_plan_item.destination.name,
      store: authorization.store.code,
      po_reference_no: po_reference,
      commodity_grade: commodity_grade,
      prepared_by: user.full_name,
      driver_name: authorization.dispatch.driver_name,
      commodities: [
        {
          s_no: 1,
          name: commodity_label(authorization.dispatch.dispatch_plan_item.commodity),
          batch_no: authorization.dispatch.dispatch_plan_item.commodity.batch_no,
          quantity: authorization.quantity,
          received_quantity: authorization.received_quantity,
          unit: authorization.dispatch.unit.abbreviation
        }
      ]
    }
  end

  # Avoid Commodity#name when project.source is a Donor (no commodity_name).
  # Use description or batch_no from the commodity record.
  def commodity_label(commodity)
    commodity.description.presence || commodity.batch_no.presence || "Commodity #{commodity.id}"
  end
end
