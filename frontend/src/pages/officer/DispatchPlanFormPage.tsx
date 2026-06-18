import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Stepper,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { createDispatchOrder, confirmDispatchOrder } from '../../api/dispatchOrders';
import { getWarehouses } from '../../api/warehouses';
import { getCommodityReferences } from '../../api/referenceData';
import { getCommodityDefinitions } from '../../api/commodityDefinitions';
import { getStockBalances } from '../../api/stockBalances';
import { useAuthStore } from '../../store/authStore';
import type { ApiError } from '../../types/common';
import { ReferenceStep } from './dispatch-plan/ReferenceStep';
import { CommodityTypeStep } from './dispatch-plan/CommodityTypeStep';
import { SourceQuantityStep } from './dispatch-plan/SourceQuantityStep';
import { FdpReceiveStep } from './dispatch-plan/FdpReceiveStep';
import { LinesReviewStep } from './dispatch-plan/LinesReviewStep';
import { ExecuteStep } from './dispatch-plan/ExecuteStep';
import {
  emptyCommodityLineDraft,
  type CommodityLineDraft,
  type DispatchPlanLineDraft,
  type DispatchPlanReferenceDraft,
} from './dispatch-plan/types';
import { buildDispatchPlanPayload, combineDateAndTime } from './dispatch-plan/helpers';
import { resolveCommodityBatchId } from './dispatch-plan/commodityGrouping';

const SUB_FEDERAL_ROLES = ['Regional Officer', 'Zonal Officer', 'Woreda Officer', 'Kebele Officer'];

function DispatchPlanFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeAssignment = useAuthStore((state) => state.activeAssignment);
  const location = activeAssignment?.location;
  const jurisdictionLabel = location
    ? `${location.name} (${location.location_type})`
    : 'Federal / System-wide';

  const isSubFederalOfficer = activeAssignment?.role_name
    ? SUB_FEDERAL_ROLES.includes(activeAssignment.role_name)
    : false;
  const hasLocationIssue = isSubFederalOfficer && !location;

  const [activeStep, setActiveStep] = useState(0);
  const [reference, setReference] = useState<DispatchPlanReferenceDraft>({
    responsePlanRef: '',
    approvalDate: new Date(),
    responseType: null,
    description: '',
  });
  const [currentLine, setCurrentLine] = useState<CommodityLineDraft>(emptyCommodityLineDraft());
  const [addedLines, setAddedLines] = useState<DispatchPlanLineDraft[]>([]);
  const [isAddingAnotherCommodity, setIsAddingAnotherCommodity] = useState(false);

  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: getCommodityReferences,
  });

  const { data: definitions = [] } = useQuery({
    queryKey: ['commodity-definitions'],
    queryFn: getCommodityDefinitions,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => getWarehouses({}),
  });

  const { data: allStockBalances = [] } = useQuery({
    queryKey: ['stock_balances', 'dispatch-plan'],
    queryFn: () => getStockBalances({}),
    enabled: currentLine.commodityBatchIds.length > 0,
  });

  const stockBalances = useMemo(() => {
    const balances = Array.isArray(allStockBalances) ? allStockBalances : [];
    return balances.filter((balance) =>
      currentLine.commodityBatchIds.includes(balance.commodity_id)
    );
  }, [allStockBalances, currentLine.commodityBatchIds]);

  const saveMutation = useMutation({
    mutationFn: async (execute: boolean) => {
      const payload = buildDispatchPlanPayload(reference, addedLines, location);
      const order = await createDispatchOrder(payload);
      if (execute) return confirmDispatchOrder(order.id);
      return order;
    },
    onSuccess: (data, execute) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch_orders'] });
      notifications.show({
        title: 'Success',
        message: execute ? 'Dispatch Plan executed successfully' : 'Dispatch Plan saved as draft',
        color: 'green',
      });
      navigate(`/officer/dispatch-plan/${data.id}`);
    },
    onError: (error: unknown) => {
      notifications.show({
        title: 'Error',
        message:
          (isAxiosError<ApiError>(error) ? error.response?.data?.error?.message : undefined) ||
          'Failed to save Dispatch Plan',
        color: 'red',
      });
    },
  });

  const patchReference = (patch: Partial<DispatchPlanReferenceDraft>) => {
    setReference((prev) => ({ ...prev, ...patch }));
  };

  const patchCurrentLine = (patch: Partial<CommodityLineDraft>) => {
    setCurrentLine((prev) => ({ ...prev, ...patch }));
  };

  const validateReferenceStep = () => {
    if (!reference.responsePlanRef.trim()) {
      notifications.show({ title: 'Validation', message: 'Response Plan Reference is required', color: 'red' });
      return false;
    }
    if (!reference.approvalDate) {
      notifications.show({ title: 'Validation', message: 'Approval Date is required', color: 'red' });
      return false;
    }
    return true;
  };

  const validateCommodityStep = () => {
    if (!currentLine.commodityGroup || !currentLine.commodityName || currentLine.commodityBatchIds.length === 0) {
      notifications.show({ title: 'Validation', message: 'Select commodity type and commodity', color: 'red' });
      return false;
    }
    return true;
  };

  const validateSourceStep = () => {
    if (currentLine.sourceAllocations.length === 0) {
      notifications.show({
        title: 'Validation',
        message: 'Add at least one source with a quantity',
        color: 'red',
      });
      return false;
    }
    return true;
  };

  const validateFdpStep = () => {
    if (!currentLine.fdpId) {
      notifications.show({ title: 'Validation', message: 'Select an FDP destination', color: 'red' });
      return false;
    }
    const receiveAt = combineDateAndTime(currentLine.expectedReceiveAt, currentLine.expectedReceiveTime);
    if (!receiveAt) {
      notifications.show({ title: 'Validation', message: 'Expected receive date and time are required', color: 'red' });
      return false;
    }
    return true;
  };

  const addCurrentLineToPlan = () => {
    if (!validateFdpStep()) return false;

    const receiveAt = combineDateAndTime(
      currentLine.expectedReceiveAt,
      currentLine.expectedReceiveTime
    )!;

    const newLines: DispatchPlanLineDraft[] = [];

    for (const allocation of currentLine.sourceAllocations) {
      const resolvedCommodityId = resolveCommodityBatchId(
        currentLine.commodityBatchIds,
        allocation.warehouseId,
        stockBalances,
        allocation.quantity
      );

      if (!resolvedCommodityId) {
        notifications.show({
          title: 'Validation',
          message: `Could not resolve a commodity batch for ${allocation.sourceType === 'hub' ? allocation.hubName : allocation.warehouseName}`,
          color: 'red',
        });
        return false;
      }

      newLines.push({
        id: crypto.randomUUID(),
        commodityGroup: currentLine.commodityGroup!,
        commodityId: resolvedCommodityId,
        commodityLabel: currentLine.commodityLabel,
        unitId: currentLine.unitId,
        sourceType: allocation.sourceType,
        warehouseId: allocation.warehouseId,
        warehouseName: allocation.warehouseName,
        hubId: allocation.hubId,
        hubName: allocation.hubName,
        quantity: allocation.quantity,
        availableQty: allocation.availableQty,
        unitLabel: allocation.unitLabel ?? currentLine.unitLabel,
        fdpId: Number(currentLine.fdpId),
        fdpName: currentLine.fdpName,
        expectedReceiveAt: receiveAt,
      });
    }

    setAddedLines((prev) => [...prev, ...newLines]);
    setCurrentLine(emptyCommodityLineDraft());
    setIsAddingAnotherCommodity(false);
    setActiveStep(4);
    return true;
  };

  const handleNext = () => {
    if (activeStep === 0 && !validateReferenceStep()) return;
    if (activeStep === 1 && !validateCommodityStep()) return;
    if (activeStep === 2 && !validateSourceStep()) return;
    if (activeStep === 3) {
      if (!addCurrentLineToPlan()) return;
      return;
    }
    if (activeStep === 4) {
      setActiveStep(5);
      return;
    }
    setActiveStep((s) => Math.min(s + 1, 5));
  };

  const handleBack = () => {
    if (activeStep === 4) {
      setActiveStep(3);
      return;
    }
    setActiveStep((s) => Math.max(s - 1, 0));
  };

  const handleAddAnother = () => {
    setIsAddingAnotherCommodity(true);
    setCurrentLine(emptyCommodityLineDraft());
    setActiveStep(1);
  };

  const handleReturnToPlanLines = () => {
    setIsAddingAnotherCommodity(false);
    setCurrentLine(emptyCommodityLineDraft());
    setActiveStep(4);
  };

  const handleContinueToExecute = () => {
    setIsAddingAnotherCommodity(false);
    setActiveStep(5);
  };

  const isLoading = saveMutation.isPending;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Create Dispatch Plan</Title>
        <Text c="dimmed" size="sm">
          Step-by-step wizard to plan multi-commodity dispatches to FDPs
        </Text>
      </div>

      {hasLocationIssue && (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow" title="Missing Geographic Assignment">
          Your account has no geographic assignment. Contact your administrator.
        </Alert>
      )}

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stepper active={activeStep} onStepClick={setActiveStep} allowNextStepsSelect={false}>
          <Stepper.Step label="Reference" description="Plan details">
            <Stack pt="md">
              <ReferenceStep jurisdictionLabel={jurisdictionLabel} value={reference} onChange={patchReference} />
            </Stack>
          </Stepper.Step>
          <Stepper.Step label="Commodity" description="Type and item">
            <Stack pt="md">
              <CommodityTypeStep
                value={currentLine}
                commodities={commodities}
                definitions={definitions}
                onChange={patchCurrentLine}
              />
            </Stack>
          </Stepper.Step>
          <Stepper.Step label="Source" description="Hubs and quantities">
            <Stack pt="md">
              <SourceQuantityStep
                value={currentLine}
                stockBalances={stockBalances}
                warehouses={warehouses}
                onChange={patchCurrentLine}
              />
            </Stack>
          </Stepper.Step>
          <Stepper.Step label="FDP" description="Destination and time">
            <Stack pt="md">
              <FdpReceiveStep
                value={currentLine}
                onChange={patchCurrentLine}
              />
            </Stack>
          </Stepper.Step>
          <Stepper.Step label="Lines" description="Added commodities">
            <Stack pt="md">
              <LinesReviewStep
                lines={addedLines}
                onAddAnother={handleAddAnother}
                onContinue={handleContinueToExecute}
                onRemoveLine={(id) => setAddedLines((prev) => prev.filter((line) => line.id !== id))}
              />
            </Stack>
          </Stepper.Step>
          <Stepper.Step label="Execute" description="Review and submit">
            <Stack pt="md">
              <ExecuteStep reference={reference} jurisdictionLabel={jurisdictionLabel} lines={addedLines} />
            </Stack>
          </Stepper.Step>
        </Stepper>

        <Group justify="space-between" mt="xl">
          <Button variant="light" onClick={() => navigate('/officer/dispatch-plan')}>
            Cancel
          </Button>
          <Group>
            {isAddingAnotherCommodity && activeStep >= 1 && activeStep <= 3 && (
              <Button variant="light" onClick={handleReturnToPlanLines}>
                Back to Plan Lines
              </Button>
            )}
            {activeStep > 0 && activeStep !== 4 && activeStep !== 5 && (
              <Button variant="default" onClick={handleBack}>
                Back
              </Button>
            )}
            {activeStep < 3 && (
              <Button onClick={handleNext} disabled={hasLocationIssue}>
                Next
              </Button>
            )}
            {activeStep === 3 && (
              <Button onClick={handleNext} disabled={hasLocationIssue}>
                Add Line to Plan
              </Button>
            )}
            {activeStep === 5 && (
              <>
                <Button
                  variant="outline"
                  loading={isLoading}
                  disabled={hasLocationIssue || addedLines.length === 0}
                  onClick={() => saveMutation.mutate(false)}
                >
                  Save as Draft
                </Button>
                <Button
                  loading={isLoading}
                  disabled={hasLocationIssue || addedLines.length === 0}
                  onClick={() => saveMutation.mutate(true)}
                >
                  Confirm & Execute
                </Button>
              </>
            )}
          </Group>
        </Group>
      </Card>
    </Stack>
  );
}

export default DispatchPlanFormPage;
