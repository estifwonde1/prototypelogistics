import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import type { RoleSlug } from '../contracts/warehouse';

export interface OfficerScope {
  roleSlug: RoleSlug | null;
  /** Human-readable scope label, e.g. "Addis Ababa Region" */
  scopeLabel: string;
  /** Short description shown under the dashboard title */
  scopeDescription: string;
  /** Location names the officer is assigned to (for sub-federal roles) */
  assignedLocationNames: string[];
  /** Whether this officer sees all data (federal / generic officer) */
  isFullAccess: boolean;
}

export function useOfficerScope(): OfficerScope {
  const roleSlug = useAuthStore((state) => state.role) as RoleSlug | null;
  const assignments = useAuthStore((state) => state.assignments);

  return useMemo(() => {
    const locationAssignments = assignments.filter((a) => a.location != null);
    const assignedLocationNames = locationAssignments.map((a) => a.location!.name);

    const isFullAccess = roleSlug === 'federal_officer' || roleSlug === 'officer';

    const scopeLabel = (() => {
      if (isFullAccess) return 'All Regions (System-wide)';
      if (assignedLocationNames.length === 0) return 'No location assigned';
      if (assignedLocationNames.length === 1) return assignedLocationNames[0];
      return `${assignedLocationNames.length} locations`;
    })();

    const scopeDescription = (() => {
      switch (roleSlug) {
        case 'federal_officer':
        case 'officer':
          return 'System-wide overview across all regions, hubs, warehouses, and orders.';
        case 'regional_officer':
          return assignedLocationNames.length
            ? `Regional overview for: ${assignedLocationNames.join(', ')}.`
            : 'Regional overview — no region assigned yet.';
        case 'zonal_officer':
          return assignedLocationNames.length
            ? `Zonal overview for: ${assignedLocationNames.join(', ')}.`
            : 'Zonal overview — no zone assigned yet.';
        case 'woreda_officer':
          return assignedLocationNames.length
            ? `Woreda overview for: ${assignedLocationNames.join(', ')}.`
            : 'Woreda overview — no woreda assigned yet.';
        case 'kebele_officer':
          return assignedLocationNames.length
            ? `Kebele overview for: ${assignedLocationNames.join(', ')}.`
            : 'Kebele overview — no kebele assigned yet.';
        default:
          return 'Orchestrate warehouse receipt and dispatch operations.';
      }
    })();

    return { roleSlug, scopeLabel, scopeDescription, assignedLocationNames, isFullAccess };
  }, [roleSlug, assignments]);
}
