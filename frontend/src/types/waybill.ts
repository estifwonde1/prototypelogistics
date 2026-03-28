export interface Waybill {
  id: number;
  reference_no: string;
  dispatch_id?: number;
  source_location_id: number;
  source_location_name?: string;
  destination_location_id: number;
  destination_location_name?: string;
  issued_on: string;
  status: string;
  waybill_transport?: WaybillTransport;
  waybill_items?: WaybillItem[];
}

export interface WaybillTransport {
  id?: number;
  waybill_id?: number;
  transporter_id: number;
  vehicle_plate_no: string;
  driver_name: string;
  driver_phone: string;
}

export interface WaybillItem {
  id?: number;
  waybill_id?: number;
  commodity_id: number;
  commodity_name?: string;
  commodity_code?: string;
  quantity: number;
  unit_id: number;
  unit_name?: string;
  unit_abbreviation?: string;
}
