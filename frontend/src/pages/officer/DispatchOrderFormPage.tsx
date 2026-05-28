import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Center, Loader } from '@mantine/core';
import { getDispatchOrder } from '../../api/dispatchOrders';
import type { DispatchOrderLineV2 } from '../../types/dispatchV2';
import LegacyDispatchOrderFormPage from './LegacyDispatchOrderFormPage';
import OfficerDispatchOrderWizard from './OfficerDispatchOrderWizard';

function isAllocationDispatchOrder(order: {
  dispatch_reference?: string | null;
  plan_reference?: string | null;
  dispatch_order_lines?: DispatchOrderLineV2[];
}): boolean {
  return (order.dispatch_order_lines ?? []).some((l) => (l.source_allocations?.length ?? 0) > 0);
}

/** Routes new allocation-based orders to the wizard; legacy single-warehouse orders use LegacyDispatchOrderFormPage. */
function DispatchOrderFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const { data: existing, isLoading } = useQuery({
    queryKey: ['dispatch_orders', id],
    queryFn: () => getDispatchOrder(Number(id)),
    enabled: isEdit,
  });

  if (!isEdit) {
    return <OfficerDispatchOrderWizard />;
  }

  if (isLoading) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  if (existing && !isAllocationDispatchOrder(existing)) {
    return <Navigate to={`/officer/dispatch-orders/${id}/edit-legacy`} replace />;
  }

  return <OfficerDispatchOrderWizard />;
}

export default DispatchOrderFormPage;
