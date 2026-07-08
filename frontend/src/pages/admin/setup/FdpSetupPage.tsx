/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Group,
  Button,
  Card,
  Table,
  ActionIcon,
  Modal,
  TextInput,
  NumberInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconEdit, IconTrash, IconMapPin } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import {
  getFdps,
  createFdp,
  updateFdp,
  deleteFdp,
  type Fdp,
  type FdpPayload,
} from '../../../api/fdps';
import { getKebeles, getRegions, getWoredas, getZones } from '../../../api/locations';
import { SearchableSelect } from '../../../components/common/SearchableSelect';
import { LoadingState } from '../../../components/common/LoadingState';
import { ErrorState } from '../../../components/common/ErrorState';
import { EmptyState } from '../../../components/common/EmptyState';
import { safeTextFilter, sanitizeSearchInput } from '../../../utils/filterUtils';
import { dedupOptions } from '../../../utils/dedup';
import {
  KEBELE_DROPDOWN_OPTIONS,
  kebeleNumberFromName,
  kebeleValueFromNumber,
  resolveKebeleIdForNumber,
} from '../../../constants/kebeleOptions';
import { resolveLocationContextByLocationId } from '../../../utils/locationContext';
import type { ApiError } from '../../../types/common';

const DEFAULT_REGION_NAME = 'Addis Ababa';

const emptyFormValues: FdpPayload = {
  name: '',
  location_id: null,
  location_name: null,
  number_of_families: null,
  number_of_beneficiaries: null,
};

function buildLocationName(
  regionLabel?: string,
  zoneLabel?: string,
  woredaLabel?: string,
  kebeleValue?: string
): string {
  const parts = [woredaLabel, zoneLabel, regionLabel].filter(Boolean);
  const base = parts.join(', ');
  if (!kebeleValue) return base;
  return base ? `${base} — Kebele ${kebeleValue}` : `Kebele ${kebeleValue}`;
}

function resetLocationState() {
  return {
    regionId: null as string | null,
    zoneId: null as string | null,
    woredaId: null as string | null,
    kebele: '' as string,
  };
}

export default function FdpSetupPage() {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Fdp | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Fdp | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [regionId, setRegionId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [woredaId, setWoredaId] = useState<string | null>(null);
  const [kebele, setKebele] = useState('');

  const { data: fdps = [], isLoading, error, refetch } = useQuery({
    queryKey: ['fdps'],
    queryFn: () => getFdps(),
  });

  const { data: regions, isLoading: regionsLoading } = useQuery({
    queryKey: ['locations', 'regions'],
    queryFn: getRegions,
  });

  const { data: zones, isLoading: zonesLoading } = useQuery({
    queryKey: ['locations', 'zones', regionId],
    queryFn: () => getZones(regionId ? Number(regionId) : undefined),
    enabled: !!regionId,
  });

  const { data: woredas, isLoading: woredasLoading } = useQuery({
    queryKey: ['locations', 'woredas', zoneId],
    queryFn: () => getWoredas(Number(zoneId)),
    enabled: !!zoneId,
  });

  const { data: kebeles } = useQuery({
    queryKey: ['locations', 'kebeles', woredaId],
    queryFn: () => getKebeles(Number(woredaId)),
    enabled: !!woredaId,
  });

  const form = useForm<FdpPayload>({
    initialValues: emptyFormValues,
    validate: {
      name: (value) => (value.trim() ? null : 'FDP name is required'),
    },
  });

  useEffect(() => {
    if (!createModalOpen || editTarget) return;
    if (regions && regions.length > 0 && !regionId) {
      const defaultRegion =
        regions.find((region) => region.name === DEFAULT_REGION_NAME) || regions[0];
      setRegionId(String(defaultRegion.id));
    }
  }, [regions, regionId, createModalOpen, editTarget]);

  useEffect(() => {
    if (!createModalOpen || editTarget) return;
    if (!zones || zones.length === 0) {
      if (zoneId !== null) setZoneId(null);
      return;
    }
    if (!zoneId || !zones.some((zone) => String(zone.id) === zoneId)) {
      setZoneId(String(zones[0].id));
    }
  }, [zones, zoneId, createModalOpen, editTarget]);

  useEffect(() => {
    if (!createModalOpen || editTarget) return;
    if (!woredas || woredas.length === 0) {
      if (woredaId !== null) setWoredaId(null);
      return;
    }
    if (!woredaId || !woredas.some((entry) => String(entry.id) === woredaId)) {
      setWoredaId(String(woredas[0].id));
    }
  }, [woredas, woredaId, createModalOpen, editTarget]);

  const filteredFdps = useMemo(() => {
    const q = sanitizeSearchInput(nameFilter);
    if (!q) return fdps;
    return fdps.filter((fdp) => safeTextFilter(fdp.name, q) || safeTextFilter(fdp.location_name ?? '', q));
  }, [fdps, nameFilter]);

  const regionOptions = useMemo(
    () => dedupOptions(regions?.map((r) => ({ value: String(r.id), label: r.name })) || []),
    [regions]
  );
  const zoneOptions = useMemo(
    () => dedupOptions(zones?.map((z) => ({ value: String(z.id), label: z.name })) || []),
    [zones]
  );
  const woredaOptions = useMemo(
    () => dedupOptions(woredas?.map((w) => ({ value: String(w.id), label: w.name })) || []),
    [woredas]
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fdps'] });

  const closeModal = () => {
    setCreateModalOpen(false);
    setEditTarget(null);
    form.reset();
    const reset = resetLocationState();
    setRegionId(reset.regionId);
    setZoneId(reset.zoneId);
    setWoredaId(reset.woredaId);
    setKebele(reset.kebele);
  };

  const createMutation = useMutation({
    mutationFn: createFdp,
    onSuccess: () => {
      invalidate();
      closeModal();
      notifications.show({ title: 'Success', message: 'FDP registered successfully', color: 'green' });
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error',
        message: (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) || 'Failed to register FDP',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: FdpPayload }) => updateFdp(id, payload),
    onSuccess: () => {
      invalidate();
      closeModal();
      notifications.show({ title: 'Success', message: 'FDP updated successfully', color: 'green' });
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error',
        message: (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) || 'Failed to update FDP',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFdp,
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      notifications.show({ title: 'Success', message: 'FDP deleted successfully', color: 'green' });
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Error',
        message: (isAxiosError<ApiError>(err) ? err.response?.data?.error?.message : undefined) || 'Failed to delete FDP',
        color: 'red',
      });
    },
  });

  const applyLocationContext = async (locationId?: number | null) => {
    const reset = resetLocationState();
    if (!locationId) {
      setRegionId(reset.regionId);
      setZoneId(reset.zoneId);
      setWoredaId(reset.woredaId);
      setKebele(reset.kebele);
      return;
    }

    const context = await resolveLocationContextByLocationId(locationId);
    if (context.regionId) setRegionId(String(context.regionId));
    if (context.zoneId) setZoneId(String(context.zoneId));
    if (context.woredaId) setWoredaId(String(context.woredaId));
    if (context.kebeleName) {
      setKebele(kebeleValueFromNumber(kebeleNumberFromName(context.kebeleName)));
    } else {
      setKebele('');
    }
  };

  const openCreate = () => {
    form.setValues(emptyFormValues);
    const reset = resetLocationState();
    setRegionId(reset.regionId);
    setZoneId(reset.zoneId);
    setWoredaId(reset.woredaId);
    setKebele(reset.kebele);
    setCreateModalOpen(true);
  };

  const openEdit = async (fdp: Fdp) => {
    form.setValues({
      name: fdp.name,
      location_id: fdp.location_id ?? null,
      location_name: fdp.location_name ?? null,
      number_of_families: fdp.number_of_families ?? null,
      number_of_beneficiaries: fdp.number_of_beneficiaries ?? null,
    });
    setEditTarget(fdp);
    await applyLocationContext(fdp.location_id);
  };

  const handleSubmit = () => {
    const validation = form.validate();
    if (validation.hasErrors) return;

    if (!woredaId) {
      notifications.show({ title: 'Validation', message: 'Select a woreda for this FDP', color: 'red' });
      return;
    }

    const regionLabel = regionOptions.find((option) => option.value === regionId)?.label;
    const zoneLabel = zoneOptions.find((option) => option.value === zoneId)?.label;
    const woredaLabel = woredaOptions.find((option) => option.value === woredaId)?.label;
    const kebeleLocationId =
      kebele !== '' ? resolveKebeleIdForNumber(kebeles, Number(kebele)) : undefined;
    const locationId = kebeleLocationId ?? Number(woredaId);
    const locationName = buildLocationName(regionLabel, zoneLabel, woredaLabel, kebele || undefined);

    const payload: FdpPayload = {
      name: form.values.name.trim(),
      location_id: locationId,
      location_name: locationName || null,
      number_of_families: form.values.number_of_families ?? null,
      number_of_beneficiaries: form.values.number_of_beneficiaries ?? null,
    };

    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isLoading || regionsLoading) return <LoadingState message="Loading FDPs..." />;
  if (error) return <ErrorState message="Failed to load FDPs." onRetry={refetch} />;

  const modalOpen = createModalOpen || !!editTarget;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const canSubmit = !!woredaId;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>FDP Setup</Title>
          <Text c="dimmed" size="sm">
            Register Food Distribution Points for dispatch planning
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Register FDP
        </Button>
      </Group>

      <Card withBorder padding="md">
        <TextInput
          placeholder="Search by name or location..."
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          leftSection={<IconMapPin size={16} />}
          mb="md"
        />

        {filteredFdps.length === 0 ? (
          <EmptyState
            title="No FDPs found"
            description={nameFilter ? 'Try adjusting your search' : 'Register your first FDP to get started'}
            action={!nameFilter ? { label: 'Register FDP', onClick: openCreate } : undefined}
          />
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>FDP Name</Table.Th>
                  <Table.Th>Location</Table.Th>
                  <Table.Th>Families</Table.Th>
                  <Table.Th>Beneficiaries</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredFdps.map((fdp) => (
                  <Table.Tr key={fdp.id}>
                    <Table.Td fw={600}>{fdp.name}</Table.Td>
                    <Table.Td>{fdp.location_name || '—'}</Table.Td>
                    <Table.Td>{fdp.number_of_families ?? '—'}</Table.Td>
                    <Table.Td>{fdp.number_of_beneficiaries ?? '—'}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        <ActionIcon variant="subtle" color="blue" onClick={() => void openEdit(fdp)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" color="red" onClick={() => setDeleteTarget(fdp)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      <Modal opened={modalOpen} onClose={closeModal} title={editTarget ? 'Edit FDP' : 'Register FDP'} size="lg">
        <Stack gap="md">
          <TextInput label="FDP Name" required {...form.getInputProps('name')} />

          <Group grow align="flex-start">
            <SearchableSelect
              label="Region"
              data={regionOptions}
              value={regionId}
              onChange={(value) => {
                setRegionId(value);
                setZoneId(null);
                setWoredaId(null);
                setKebele('');
              }}
              searchable
            />
            <SearchableSelect
              label="Zone / Subcity"
              data={zoneOptions}
              value={zoneId}
              onChange={(value) => {
                setZoneId(value);
                setWoredaId(null);
                setKebele('');
              }}
              disabled={!regionId || zonesLoading}
              searchable
            />
            <SearchableSelect
              label="Woreda"
              data={woredaOptions}
              value={woredaId}
              onChange={(value) => {
                setWoredaId(value);
                setKebele('');
              }}
              disabled={!zoneId || woredasLoading}
              searchable
              required
            />
            <SearchableSelect
              label="Kebele (Optional)"
              data={KEBELE_DROPDOWN_OPTIONS}
              placeholder="Select kebele"
              description="01 (minimum) through 40 (maximum)"
              value={kebele || null}
              onChange={(value) => setKebele(value || '')}
              disabled={!woredaId}
              clearable
              searchable
            />
          </Group>

          <NumberInput
            label="Number of Families to be Supported"
            min={0}
            allowDecimal={false}
            {...form.getInputProps('number_of_families')}
          />
          <NumberInput
            label="Number of Beneficiaries"
            min={0}
            allowDecimal={false}
            {...form.getInputProps('number_of_beneficiaries')}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={isSaving} disabled={!canSubmit}>
              {editTarget ? 'Save Changes' : 'Register FDP'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete FDP" size="sm">
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
