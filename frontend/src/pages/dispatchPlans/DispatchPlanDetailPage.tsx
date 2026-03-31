import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { getDispatchPlan, approveDispatchPlan } from '../../api/dispatchPlans';
import { createDispatchPlanItem, updateDispatchPlanItem } from '../../api/dispatchPlanItems';
import { createHubAuthorization } from '../../api/hubAuthorizations';
import { createDispatch } from '../../api/dispatches';
import { getCommodityReferences, getTransporterReferences, getUnitReferences } from '../../api/referenceData';
import { getWarehouses } from '../../api/warehouses';
import { getStores } from '../../api/stores';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';
import type { ApiError } from '../../types/common';
import type { DispatchPlanItem } from '../../types/dispatchPlan';

type ItemFormValues = {
  reference_no: string;
  source_id: string | null;
  destination_id: string | null;
  commodity_id: string | null;
  quantity: number;
  unit_id: string | null;
  commodity_status: string;
  beneficiaries: number;
};

type AuthorizationFormValues = {
  store_id: string | null;
  quantity: number;
  unit_id: string | null;
};

type DispatchFormValues = {
  reference_no: string;
  transporter_id: string | null;
  plate_no: string;
  driver_name: string;
  driver_phone: string;
  quantity: number;
  unit_id: string | null;
  commodity_status: string;
  remark: string;
};

const DEFAULT_ITEM_FORM: ItemFormValues = {
  reference_no: '',
  source_id: null,
  destination_id: null,
  commodity_id: null,
  quantity: 0,
  unit_id: null,
  commodity_status: 'Good',
  beneficiaries: 0,
};

const DEFAULT_AUTH_FORM: AuthorizationFormValues = {
  store_id: null,
  quantity: 0,
  unit_id: null,
};

const DEFAULT_DISPATCH_FORM: DispatchFormValues = {
  reference_no: '',
  transporter_id: null,
  plate_no: '',
  driver_name: '',
  driver_phone: '',
  quantity: 0,
  unit_id: null,
  commodity_status: 'Good',
  remark: '',
};

const COMMODITY_STATUS_OPTIONS = ['Good', 'Fair', 'Poor', 'Damaged'].map((status) => ({
  value: status,
  label: status,
}));

export default function DispatchPlanDetailPage() {
  const { id } = useParams();
  const planId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, role } = usePermission();
  const userId = useAuthStore((state) => state.userId);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DispatchPlanItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormValues>(DEFAULT_ITEM_FORM);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authType, setAuthType] = useState<'Source' | 'Destination'>('Source');
  const [authItem, setAuthItem] = useState<DispatchPlanItem | null>(null);
  const [authForm, setAuthForm] = useState<AuthorizationFormValues>(DEFAULT_AUTH_FORM);

  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchItem, setDispatchItem] = useState<DispatchPlanItem | null>(null);
  const [dispatchForm, setDispatchForm] = useState<DispatchFormValues>(DEFAULT_DISPATCH_FORM);

  const { data: plan, isLoading, error, refetch } = useQuery({
    queryKey: ['dispatch-plan', planId],
    queryFn: () => getDispatchPlan(planId),
    enabled: Number.isFinite(planId),
  });

  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: getWarehouses });
  const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: getStores });
  const { data: commodities = [] } = useQuery({
    queryKey: ['reference-data', 'commodities'],
    queryFn: getCommodityReferences,
  });
  const { data: units = [] } = useQuery({ queryKey: ['reference-data', 'units'], queryFn: getUnitReferences });
  const { data: transporters = [] } = useQuery({
    queryKey: ['reference_data', 'transporters'],
    queryFn: getTransporterReferences,
  });

  const warehouseLocationOptions = Array.from(
    new Map(
      warehouses
        .filter((w) => Boolean(w.location_id))
        .map((w) => [String(w.location_id), { value: String(w.location_id), label: `${w.code} - ${w.name}` }])
    ).values()
  );
  const commodityOptions = commodities.map((c) => ({ value: String(c.id), label: c.code ? `${c.name} (${c.code})` : c.name }));
  const unitOptions = units.map((u) => ({
    value: String(u.id),
    label: u.abbreviation ? `${u.name} (${u.abbreviation})` : u.name,
  }));
  const transporterOptions = transporters.map((t) => ({
    value: String(t.id),
    label: t.code ? `${t.code} - ${t.name}` : t.name,
  }));

  const storeOptionsForAuth = useMemo(() => {
    if (!authItem) return [];
    const sourceWarehouse = warehouses.find((w) => Number(w.location_id) === Number(authItem.source_id));
    const destinationWarehouse = warehouses.find((w) => Number(w.location_id) === Number(authItem.destination_id));
    const targetWarehouseId = authType === 'Source' ? sourceWarehouse?.id : destinationWarehouse?.id;
    if (!targetWarehouseId) return [];
    return stores
      .filter((s) => Number(s.warehouse_id) === Number(targetWarehouseId))
      .map((s) => ({ value: String(s.id), label: `${s.code} - ${s.name}` }));
  }, [authItem, authType, stores, warehouses]);

  const plannerCanManage = can('dispatch_plans', 'update');
  const plannerCanCreate = can('dispatch_plans', 'create');
  const plannerCanApprove = can('dispatch_plans', 'confirm');
  const canAuthorizeSource = role === 'hub_dispatch_officer' || role === 'hub_manager' || role === 'admin' || role === 'superadmin';
  const canAuthorizeDestination = role === 'hub_dispatch_approver' || role === 'hub_manager' || role === 'admin' || role === 'superadmin';
  const canCreateDispatch = can('dispatches', 'create');

  const refreshPlan = () => {
    queryClient.invalidateQueries({ queryKey: ['dispatch-plan', planId] });
    queryClient.invalidateQueries({ queryKey: ['dispatch-plans'] });
    queryClient.invalidateQueries({ queryKey: ['dispatches'] });
  };

  const handleMutationError = (err: unknown, fallback: string) => {
    const message =
      (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) ||
      (err instanceof Error ? err.message : undefined) ||
      fallback;
    notifications.show({ title: 'Error', message, color: 'red' });
  };

  const approveMutation = useMutation({
    mutationFn: () => approveDispatchPlan(planId, { approved_by_id: Number(userId) }),
    onSuccess: () => {
      refreshPlan();
      notifications.show({ title: 'Success', message: 'Dispatch plan approved', color: 'green' });
    },
    onError: (err) => handleMutationError(err, 'Failed to approve plan'),
  });

  const saveItemMutation = useMutation({
    mutationFn: () => {
      if (!itemForm.reference_no || !itemForm.source_id || !itemForm.destination_id || !itemForm.commodity_id || !itemForm.unit_id || !itemForm.quantity) {
        throw new Error('Fill all required item fields before saving.');
      }

      const payload = {
        reference_no: itemForm.reference_no.trim(),
        dispatch_plan_id: planId,
        source_id: Number(itemForm.source_id),
        destination_id: Number(itemForm.destination_id),
        commodity_id: Number(itemForm.commodity_id),
        quantity: Number(itemForm.quantity),
        unit_id: Number(itemForm.unit_id),
        commodity_status: itemForm.commodity_status || 'Good',
        beneficiaries: itemForm.beneficiaries || undefined,
      };

      return editingItem ? updateDispatchPlanItem(editingItem.id, payload) : createDispatchPlanItem(payload);
    },
    onSuccess: () => {
      refreshPlan();
      setItemModalOpen(false);
      setEditingItem(null);
      setItemForm(DEFAULT_ITEM_FORM);
      notifications.show({ title: 'Success', message: 'Plan item saved', color: 'green' });
    },
    onError: (err) => handleMutationError(err, 'Failed to save plan item'),
  });

  const authorizationMutation = useMutation({
    mutationFn: () => {
      if (!authItem || !authForm.store_id || !authForm.unit_id || !authForm.quantity || !userId) {
        throw new Error('Missing authorization inputs.');
      }
      return createHubAuthorization({
        dispatch_plan_item_id: authItem.id,
        store_id: Number(authForm.store_id),
        quantity: Number(authForm.quantity),
        unit_id: Number(authForm.unit_id),
        authorization_type: authType,
        authorized_by_id: Number(userId),
      });
    },
    onSuccess: () => {
      refreshPlan();
      setAuthModalOpen(false);
      setAuthItem(null);
      setAuthForm(DEFAULT_AUTH_FORM);
      notifications.show({ title: 'Success', message: `${authType} authorization created`, color: 'green' });
    },
    onError: (err) => handleMutationError(err, 'Failed to create authorization'),
  });

  const createDispatchMutation = useMutation({
    mutationFn: () => {
      if (!dispatchItem || !dispatchForm.reference_no || !dispatchForm.transporter_id || !dispatchForm.plate_no || !dispatchForm.driver_name || !dispatchForm.driver_phone || !dispatchForm.quantity || !dispatchForm.unit_id || !userId) {
        throw new Error('Fill all required dispatch fields before creating dispatch.');
      }
      return createDispatch({
        reference_no: dispatchForm.reference_no.trim(),
        dispatch_plan_item_id: dispatchItem.id,
        transporter_id: Number(dispatchForm.transporter_id),
        plate_no: dispatchForm.plate_no.trim(),
        driver_name: dispatchForm.driver_name.trim(),
        driver_phone: dispatchForm.driver_phone.trim(),
        quantity: Number(dispatchForm.quantity),
        unit_id: Number(dispatchForm.unit_id),
        commodity_status: dispatchForm.commodity_status || 'Good',
        remark: dispatchForm.remark || undefined,
        prepared_by_id: Number(userId),
      });
    },
    onSuccess: () => {
      refreshPlan();
      setDispatchModalOpen(false);
      setDispatchItem(null);
      setDispatchForm(DEFAULT_DISPATCH_FORM);
      notifications.show({ title: 'Success', message: 'Dispatch created from plan item', color: 'green' });
      navigate('/dispatches');
    },
    onError: (err) => handleMutationError(err, 'Failed to create dispatch'),
  });

  const openCreateItemModal = () => {
    setEditingItem(null);
    setItemForm(DEFAULT_ITEM_FORM);
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: DispatchPlanItem) => {
    setEditingItem(item);
    setItemForm({
      reference_no: item.reference_no || '',
      source_id: String(item.source_id),
      destination_id: String(item.destination_id),
      commodity_id: String(item.commodity_id),
      quantity: Number(item.quantity),
      unit_id: String(item.unit_id),
      commodity_status: item.commodity_status || 'Good',
      beneficiaries: Number(item.beneficiaries || 0),
    });
    setItemModalOpen(true);
  };

  const openAuthorizationModal = (item: DispatchPlanItem, type: 'Source' | 'Destination') => {
    setAuthItem(item);
    setAuthType(type);
    setAuthForm({
      ...DEFAULT_AUTH_FORM,
      quantity: Number(item.quantity),
      unit_id: String(item.unit_id),
    });
    setAuthModalOpen(true);
  };

  const openDispatchModal = (item: DispatchPlanItem) => {
    setDispatchItem(item);
    setDispatchForm({
      ...DEFAULT_DISPATCH_FORM,
      reference_no: `DSP-${item.reference_no}`,
      quantity: Number(item.quantity),
      unit_id: String(item.unit_id),
    });
    setDispatchModalOpen(true);
  };

  if (isLoading) return <LoadingState message="Loading dispatch plan..." />;
  if (error || !plan) return <ErrorState message="Failed to load dispatch plan" onRetry={() => refetch()} />;

  const planApproved = plan.status === 'Approved';

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>{plan.reference_no}</Title>
          <Text c="dimmed" size="sm">
            {plan.description || 'No description'}
          </Text>
        </div>
        <Group>
          <Badge variant="light">{plan.status}</Badge>
          {plannerCanManage && (
            <Button variant="default" onClick={() => navigate(`/dispatch-plans/${plan.id}/edit`)}>
              Edit Plan
            </Button>
          )}
          {plannerCanApprove && (
            <Button onClick={() => approveMutation.mutate()} loading={approveMutation.isPending}>
              Approve Plan
            </Button>
          )}
        </Group>
      </Group>

      <Card withBorder>
        <Group justify="space-between">
          <div>
            <Text fw={600}>Dispatch Plan Items</Text>
            <Text c="dimmed" size="sm">
              Add items, complete hub authorizations, approve the plan header, then create dispatch
            </Text>
          </div>
          {plannerCanCreate && <Button onClick={openCreateItemModal}>Add Plan Item</Button>}
        </Group>

        {!planApproved && (
          <Alert color="amber" title="Approve the dispatch plan" mt="md">
            The parent plan must be <strong>Approved</strong> before you can create a dispatch, even when a line item is
            Dispatchable (required by the dispatch rules).
          </Alert>
        )}

        <Table.ScrollContainer minWidth={1100} mt="md">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Reference</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Destination</Table.Th>
                <Table.Th>Commodity</Table.Th>
                <Table.Th>Qty</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Authorizations</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(plan.dispatch_plan_items || []).map((item) => {
                const sourceWarehouse = warehouses.find((w) => Number(w.location_id) === Number(item.source_id));
                const destinationWarehouse = warehouses.find((w) => Number(w.location_id) === Number(item.destination_id));
                const commodity = commodities.find((c) => Number(c.id) === Number(item.commodity_id));
                const sourceAuthorized = (item.hub_authorizations || []).some((a) => a.authorization_type === 'Source');
                const destinationAuthorized = (item.hub_authorizations || []).some((a) => a.authorization_type === 'Destination');
                const authSummary = `${sourceAuthorized ? 'Source' : '-'} / ${destinationAuthorized ? 'Destination' : '-'}`;

                return (
                  <Table.Tr key={item.id}>
                    <Table.Td>{item.reference_no}</Table.Td>
                    <Table.Td>{sourceWarehouse?.name || `Location ${item.source_id}`}</Table.Td>
                    <Table.Td>{destinationWarehouse?.name || `Location ${item.destination_id}`}</Table.Td>
                    <Table.Td>{commodity?.name || `Commodity ${item.commodity_id}`}</Table.Td>
                    <Table.Td>{item.quantity}</Table.Td>
                    <Table.Td>
                      <Badge variant="light">{item.status}</Badge>
                    </Table.Td>
                    <Table.Td>{authSummary}</Table.Td>
                    <Table.Td>
                      <Group justify="flex-end">
                        {plannerCanManage && (
                          <Button size="xs" variant="default" onClick={() => openEditItemModal(item)}>
                            Edit
                          </Button>
                        )}
                        {canAuthorizeSource && (
                          <Button size="xs" variant="light" onClick={() => openAuthorizationModal(item, 'Source')}>
                            Source Auth
                          </Button>
                        )}
                        {canAuthorizeDestination && (
                          <Button size="xs" variant="light" onClick={() => openAuthorizationModal(item, 'Destination')}>
                            Destination Auth
                          </Button>
                        )}
                        {canCreateDispatch && (
                          <Tooltip
                            label={
                              !planApproved
                                ? 'Approve the dispatch plan first (Approve Plan at the top of this page).'
                                : item.status !== 'Dispatchable'
                                  ? 'Complete source and destination hub authorizations first.'
                                  : ''
                            }
                            disabled={planApproved && item.status === 'Dispatchable'}
                          >
                            <span style={{ display: 'inline-block' }}>
                              <Button
                                size="xs"
                                onClick={() => openDispatchModal(item)}
                                disabled={item.status !== 'Dispatchable' || !planApproved}
                              >
                                Create Dispatch
                              </Button>
                            </span>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      <Modal opened={itemModalOpen} onClose={() => setItemModalOpen(false)} title={editingItem ? 'Edit Plan Item' : 'Create Plan Item'}>
        <Stack>
          <TextInput label="Reference No" value={itemForm.reference_no} onChange={(e) => setItemForm((f) => ({ ...f, reference_no: e.target.value }))} required />
          <Group grow>
            <Select
              label="Source Warehouse"
              data={warehouseLocationOptions}
              value={itemForm.source_id}
              onChange={(value) => setItemForm((f) => ({ ...f, source_id: value }))}
              searchable
              required
            />
            <Select
              label="Destination Warehouse"
              data={warehouseLocationOptions}
              value={itemForm.destination_id}
              onChange={(value) => setItemForm((f) => ({ ...f, destination_id: value }))}
              searchable
              required
            />
          </Group>
          <Group grow>
            <Select
              label="Commodity"
              data={commodityOptions}
              value={itemForm.commodity_id}
              onChange={(value) => setItemForm((f) => ({ ...f, commodity_id: value }))}
              searchable
              required
            />
            <Select
              label="Unit"
              data={unitOptions}
              value={itemForm.unit_id}
              onChange={(value) => setItemForm((f) => ({ ...f, unit_id: value }))}
              searchable
              required
            />
          </Group>
          <Group grow>
            <NumberInput
              label="Quantity"
              value={itemForm.quantity}
              min={0}
              onChange={(value) => setItemForm((f) => ({ ...f, quantity: Number(value) }))}
              required
            />
            <NumberInput
              label="Beneficiaries"
              value={itemForm.beneficiaries}
              min={0}
              onChange={(value) => setItemForm((f) => ({ ...f, beneficiaries: Number(value) }))}
            />
          </Group>
          <Select
            label="Commodity Status"
            data={COMMODITY_STATUS_OPTIONS}
            value={itemForm.commodity_status}
            onChange={(value) => setItemForm((f) => ({ ...f, commodity_status: value || 'Good' }))}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setItemModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveItemMutation.mutate()} loading={saveItemMutation.isPending}>
              Save Item
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={authModalOpen} onClose={() => setAuthModalOpen(false)} title={`${authType} Authorization`}>
        <Stack>
          <Select
            label="Store"
            data={storeOptionsForAuth}
            value={authForm.store_id}
            onChange={(value) => setAuthForm((f) => ({ ...f, store_id: value }))}
            searchable
            required
          />
          <Group grow>
            <NumberInput
              label="Quantity"
              value={authForm.quantity}
              min={0}
              onChange={(value) => setAuthForm((f) => ({ ...f, quantity: Number(value) }))}
              required
            />
            <Select
              label="Unit"
              data={unitOptions}
              value={authForm.unit_id}
              onChange={(value) => setAuthForm((f) => ({ ...f, unit_id: value }))}
              required
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setAuthModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => authorizationMutation.mutate()} loading={authorizationMutation.isPending}>
              Submit Authorization
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={dispatchModalOpen} onClose={() => setDispatchModalOpen(false)} title="Create Dispatch from Plan Item">
        <Stack>
          <TextInput
            label="Reference No"
            value={dispatchForm.reference_no}
            onChange={(e) => setDispatchForm((f) => ({ ...f, reference_no: e.target.value }))}
            required
          />
          <Select
            label="Transporter"
            data={transporterOptions}
            value={dispatchForm.transporter_id}
            onChange={(value) => setDispatchForm((f) => ({ ...f, transporter_id: value }))}
            searchable
            required
          />
          <Group grow>
            <TextInput
              label="Plate No"
              value={dispatchForm.plate_no}
              onChange={(e) => setDispatchForm((f) => ({ ...f, plate_no: e.target.value }))}
              required
            />
            <TextInput
              label="Driver Name"
              value={dispatchForm.driver_name}
              onChange={(e) => setDispatchForm((f) => ({ ...f, driver_name: e.target.value }))}
              required
            />
          </Group>
          <TextInput
            label="Driver Phone"
            value={dispatchForm.driver_phone}
            onChange={(e) => setDispatchForm((f) => ({ ...f, driver_phone: e.target.value }))}
            required
          />
          <Group grow>
            <NumberInput
              label="Quantity"
              value={dispatchForm.quantity}
              onChange={(value) => setDispatchForm((f) => ({ ...f, quantity: Number(value) }))}
              min={0}
              required
            />
            <Select
              label="Unit"
              data={unitOptions}
              value={dispatchForm.unit_id}
              onChange={(value) => setDispatchForm((f) => ({ ...f, unit_id: value }))}
              required
            />
          </Group>
          <Select
            label="Commodity Status"
            data={COMMODITY_STATUS_OPTIONS}
            value={dispatchForm.commodity_status}
            onChange={(value) => setDispatchForm((f) => ({ ...f, commodity_status: value || 'Good' }))}
          />
          <TextInput
            label="Remark"
            value={dispatchForm.remark}
            onChange={(e) => setDispatchForm((f) => ({ ...f, remark: e.target.value }))}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDispatchModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createDispatchMutation.mutate()} loading={createDispatchMutation.isPending}>
              Create Dispatch
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
