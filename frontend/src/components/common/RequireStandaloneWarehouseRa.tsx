import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Title, Text, Button } from '@mantine/core';
import { useWarehouseManagerRaAccess } from '../../hooks/useWarehouseManagerRaAccess';
import { LoadingState } from './LoadingState';

type RequireStandaloneWarehouseRaProps = {
  children: ReactNode;
  /** When true, blocks hub-backed warehouse managers entirely (e.g. create/edit). */
  requireCreate?: boolean;
};

export function RequireStandaloneWarehouseRa({
  children,
  requireCreate = false,
}: RequireStandaloneWarehouseRaProps) {
  const navigate = useNavigate();
  const { isWarehouseManager, canAccessRaWorkspace, canCreateRa, isResolving } =
    useWarehouseManagerRaAccess();

  if (!isWarehouseManager) {
    return <>{children}</>;
  }

  if (isResolving) {
    return <LoadingState message="Checking warehouse access..." />;
  }

  const denied = requireCreate ? !canCreateRa : !canAccessRaWorkspace;

  if (denied) {
    return (
      <Stack gap="sm" align="center" justify="center" h="70vh">
        <Title order={2}>Receipt Authorizations unavailable</Title>
        <Text c="dimmed" ta="center" maw={480}>
          Only Warehouse Managers at <strong>independent warehouses</strong> (not under a hub) can
          {requireCreate ? ' create' : ' use'} Receipt Authorizations. For hub-backed warehouses,
          the Hub Manager authorizes inbound trucks.
        </Text>
        <Button variant="light" onClick={() => navigate('/warehouse/dashboard')}>
          Back to dashboard
        </Button>
      </Stack>
    );
  }

  return <>{children}</>;
}
