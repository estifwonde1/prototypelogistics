import type { Grn, GrnItem } from '../types/grn';
import type { Gin, GinItem } from '../types/gin';
import type { Inspection, InspectionItem } from '../types/inspection';
import type { Waybill, WaybillItem, WaybillTransport } from '../types/waybill';

export interface CreateGrnRequest {
  reference_no: string;
  warehouse_id: number;
  received_on: string;
  received_by_id?: number;
  source_type?: string;
  source_id?: number;
  receipt_order_id?: number;
  status?: string;
  items: GrnItem[];
}

export interface CreateGinRequest {
  reference_no: string;
  warehouse_id: number;
  issued_on: string;
  issued_by_id?: number;
  destination_type?: string;
  destination_id?: number;
  status?: string;
  transporter_id?: number;
  truck_plate_number?: string;
  driver_name?: string;
  driver_id_number?: string;
  dispatch_order_authorization_id?: number;
  items: GinItem[];
}

export interface CreateInspectionRequest {
  reference_no: string;
  warehouse_id: number;
  inspected_on: string;
  inspector_id?: number;
  source_type?: string;
  source_id?: number;
  receipt_order_id?: number;
  receipt_authorization_id?: number;
  status?: string;
  items: InspectionItem[];
}

export interface CreateWaybillRequest {
  reference_no: string;
  issued_on: string;
  source_location_id: number;
  destination_location_id: number;
  source_context?: 'manual' | 'receipt_order' | 'receipt_authorization';
  dispatch_id?: number;
  status?: string;
  transport: WaybillTransport;
  items: WaybillItem[];
}

export function toCreateGrnRequest(data: Partial<Grn> & { items?: GrnItem[]; receipt_order_id?: number }): CreateGrnRequest {
  return {
    reference_no: data.reference_no ?? '',
    warehouse_id: data.warehouse_id ?? 0,
    received_on: data.received_on ?? '',
    received_by_id: data.received_by_id,
    source_type: data.source_type,
    source_id: data.source_id,
    receipt_order_id: data.receipt_order_id,
    status: data.status,
    items: data.items ?? data.grn_items ?? [],
  };
}

export function toCreateGinRequest(data: Partial<Gin> & { items?: GinItem[] }): CreateGinRequest {
  return {
    reference_no: data.reference_no ?? '',
    warehouse_id: data.warehouse_id ?? 0,
    issued_on: data.issued_on ?? '',
    issued_by_id: data.issued_by_id,
    destination_type: data.destination_type,
    destination_id: data.destination_id,
    status: data.status,
    transporter_id: data.transporter_id,
    truck_plate_number: data.truck_plate_number,
    driver_name: data.driver_name,
    driver_id_number: data.driver_id_number,
    dispatch_order_authorization_id: data.dispatch_order_authorization_id,
    items: data.items ?? data.gin_items ?? [],
  };
}

export function toCreateInspectionRequest(
  data: Partial<Inspection> & { items?: InspectionItem[]; inspector_id?: number; receipt_order_id?: number; receipt_authorization_id?: number }
): CreateInspectionRequest {
  return {
    reference_no: data.reference_no ?? '',
    warehouse_id: data.warehouse_id ?? 0,
    inspected_on: data.inspected_on ?? '',
    inspector_id: data.inspector_id,
    source_type: data.source_type,
    source_id: data.source_id,
    receipt_order_id: data.receipt_order_id,
    receipt_authorization_id: data.receipt_authorization_id,
    status: data.status,
    items: data.items ?? data.inspection_items ?? [],
  };
}

export function toCreateWaybillRequest(
  data: Partial<Waybill> & { items?: WaybillItem[]; transport?: WaybillTransport }
): CreateWaybillRequest {
  return {
    reference_no: data.reference_no ?? '',
    issued_on: data.issued_on ?? '',
    source_location_id: data.source_location_id ?? 0,
    destination_location_id: data.destination_location_id ?? 0,
    source_context: (data as { source_context?: CreateWaybillRequest['source_context'] }).source_context,
    dispatch_id: data.dispatch_id,
    status: data.status,
    transport: data.transport ?? data.waybill_transport ?? ({} as WaybillTransport),
    items: data.items ?? data.waybill_items ?? [],
  };
}
