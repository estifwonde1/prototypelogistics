export type CommodityGroup = 'Food' | 'Non-Food';
export type SourceFacilityType = 'hub' | 'independent';

export interface SourceAllocationDraft {
  id: string;
  sourceType: SourceFacilityType;
  sourceKey: string;
  warehouseId: number;
  warehouseName: string;
  hubId?: number | null;
  hubName?: string | null;
  quantity: number;
  availableQty: number;
  unitLabel?: string;
}

export interface DispatchPlanLineDraft {
  id: string;
  commodityGroup: CommodityGroup;
  commodityId: number;
  commodityLabel: string;
  unitId: number;
  sourceType: SourceFacilityType;
  warehouseId: number;
  warehouseName: string;
  hubId?: number | null;
  hubName?: string | null;
  quantity: number;
  availableQty: number;
  unitLabel?: string;
  fdpId: number;
  fdpName: string;
  expectedReceiveAt: Date;
}

export interface DispatchPlanReferenceDraft {
  responsePlanRef: string;
  approvalDate: Date | null;
  responseType: string | null;
  description: string;
}

export interface CommodityLineDraft {
  commodityGroup: CommodityGroup | null;
  commodityName: string | null;
  commodityBatchIds: number[];
  commodityLabel: string;
  unitId: number;
  sourceAllocations: SourceAllocationDraft[];
  sourceType: SourceFacilityType | null;
  sourceKey: string | null;
  warehouseId: number | null;
  warehouseName: string;
  hubId?: number | null;
  hubName?: string | null;
  quantity: number;
  availableQty: number;
  unitLabel?: string;
  fdpId: string | null;
  fdpName: string;
  expectedReceiveAt: Date | null;
  expectedReceiveTime: string;
}

export const emptyCommodityLineDraft = (): CommodityLineDraft => ({
  commodityGroup: null,
  commodityName: null,
  commodityBatchIds: [],
  commodityLabel: '',
  unitId: 0,
  sourceAllocations: [],
  sourceType: null,
  sourceKey: null,
  warehouseId: null,
  warehouseName: '',
  hubId: null,
  hubName: null,
  quantity: 0,
  availableQty: 0,
  unitLabel: undefined,
  fdpId: null,
  fdpName: '',
  expectedReceiveAt: new Date(),
  expectedReceiveTime: '09:00',
});
