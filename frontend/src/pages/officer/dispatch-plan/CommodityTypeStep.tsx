import { useMemo } from 'react';
import { Group, Radio, Stack, Text } from '@mantine/core';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import type { CommodityReference, UnitReference } from '../../../types/referenceData';
import type { CommodityDefinition } from '../../../api/commodityDefinitions';
import type { CommodityGroup, CommodityLineDraft } from './types';
import { buildGroupedCommodityOptions } from './commodityGrouping';

interface CommodityTypeStepProps {
  value: CommodityLineDraft;
  commodities: CommodityReference[];
  definitions: CommodityDefinition[];
  units: UnitReference[];
  onChange: (patch: Partial<CommodityLineDraft>) => void;
}

export function CommodityTypeStep({ value, commodities, definitions, units, onChange }: CommodityTypeStepProps) {
  const commodityOptions = useMemo(
    () => buildGroupedCommodityOptions(definitions, commodities, value.commodityGroup),
    [definitions, commodities, value.commodityGroup]
  );

  const unitOptions = useMemo(
    () =>
      units.map((u) => ({
        value: u.id.toString(),
        label: u.name,
      })),
    [units]
  );

  const handleGroupChange = (group: string) => {
    onChange({
      commodityGroup: group as CommodityGroup,
      commodityName: null,
      commodityBatchIds: [],
      commodityLabel: '',
      unitId: 0,
      unitLabel: undefined,
      sourceAllocations: [],
      sourceType: null,
      sourceKey: null,
      warehouseId: null,
      warehouseName: '',
      hubId: null,
      hubName: null,
      quantity: 0,
      availableQty: 0,
    });
  };

  const handleCommodityChange = (commodityName: string | null) => {
    const option = commodityOptions.find((entry) => entry.value === commodityName);
    onChange({
      commodityName,
      commodityBatchIds: option?.batchIds ?? [],
      commodityLabel: option?.commodityName ?? '',
      unitId: option?.unitId ?? 0,
      unitLabel: option?.unitLabel,
      sourceAllocations: [],
      sourceType: null,
      sourceKey: null,
      warehouseId: null,
      warehouseName: '',
      hubId: null,
      hubName: null,
      quantity: 0,
      availableQty: 0,
    });
  };

  const handleUnitChange = (unitId: string | null) => {
    const unit = units.find((u) => u.id.toString() === unitId);
    onChange({
      unitId: unit ? unit.id : 0,
      unitLabel: unit ? (unit.abbreviation || unit.name) : undefined,
    });
  };

  const selectedUnitId = value.unitId ? value.unitId.toString() : null;

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" fw={600} mb="xs">
          Commodity Type
        </Text>
        <Radio.Group value={value.commodityGroup ?? ''} onChange={handleGroupChange}>
          <Group grow>
            <Radio value="Food" label="Food" />
            <Radio value="Non-Food" label="Non-Food" />
          </Group>
        </Radio.Group>
      </div>
      <SearchableSelect
        key={value.commodityGroup ?? 'unset'}
        label="Specific Commodity"
        placeholder={value.commodityGroup ? 'Select commodity' : 'Choose Food or Non-Food first'}
        description="Batches for the same commodity are combined in this list"
        data={commodityOptions}
        value={value.commodityName}
        onChange={handleCommodityChange}
        searchable
        disabled={!value.commodityGroup}
        required
      />
      {value.commodityName && (
        <SearchableSelect
          label="Unit"
          placeholder="Select unit"
          data={unitOptions}
          value={selectedUnitId}
          onChange={handleUnitChange}
          searchable
          required
        />
      )}
    </Stack>
  );
}
