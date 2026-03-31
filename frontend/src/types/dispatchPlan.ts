export interface HubAuthorization {
  id: number;
  dispatch_plan_item_id: number;
  store_id: number;
  quantity: number;
  unit_id: number;
  authorization_type: 'Source' | 'Destination';
  authorized_by_id: number;
  created_at: string;
  updated_at: string;
}

export interface DispatchPlanItem {
  id: number;
  reference_no: string;
  dispatch_plan_id: number;
  source_id: number;
  destination_id: number;
  commodity_id: number;
  quantity: number;
  unit_id: number;
  commodity_status?: string | null;
  status: 'Unauthorized' | 'Source Authorized' | 'Destination Authorized' | 'Dispatchable' | string;
  beneficiaries?: number | null;
  created_at: string;
  updated_at: string;
  hub_authorizations?: HubAuthorization[];
}

export interface DispatchPlan {
  id: number;
  reference_no: string;
  description?: string | null;
  status: string;
  dispatchable_type?: string | null;
  dispatchable_id?: number | null;
  upstream?: boolean | null;
  prepared_by_id: number;
  approved_by_id?: number | null;
  created_at: string;
  updated_at: string;
  dispatch_plan_items?: DispatchPlanItem[];
}

export interface CreateDispatchPlanPayload {
  reference_no: string;
  description?: string;
  status?: string;
  dispatchable_type?: string;
  dispatchable_id?: number;
  upstream?: boolean;
  prepared_by_id: number;
  approved_by_id?: number;
}

export interface UpdateDispatchPlanPayload extends Partial<CreateDispatchPlanPayload> {}

export interface ApproveDispatchPlanPayload {
  approved_by_id: number;
}

export interface CreateDispatchPlanItemPayload {
  reference_no: string;
  dispatch_plan_id: number;
  source_id: number;
  destination_id: number;
  commodity_id: number;
  quantity: number;
  unit_id: number;
  commodity_status?: string;
  status?: string;
  beneficiaries?: number;
}

export interface UpdateDispatchPlanItemPayload extends Partial<CreateDispatchPlanItemPayload> {}

export interface CreateHubAuthorizationPayload {
  dispatch_plan_item_id: number;
  store_id: number;
  quantity: number;
  unit_id: number;
  authorization_type: 'Source' | 'Destination';
  authorized_by_id: number;
}
