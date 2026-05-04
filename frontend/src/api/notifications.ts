import apiClient from './client';
import type { ApiResponse } from '../types/common';

export const notificationsQueryKey = ['notifications'] as const;
export const notificationsUnreadCountKey = ['notifications', 'unread_count'] as const;

export interface InAppNotificationDto {
  id: number;
  type: string;
  title: string;
  body: string;
  params: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export async function fetchNotifications(options?: {
  unread?: boolean;
  limit?: number;
  offset?: number;
}): Promise<InAppNotificationDto[]> {
  const res = await apiClient.get<ApiResponse<InAppNotificationDto[]>>('/notifications', {
    params: {
      unread: options?.unread,
      limit: options?.limit ?? 30,
      offset: options?.offset ?? 0,
    },
  });
  return Array.isArray(res.data.data) ? res.data.data : [];
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const res = await apiClient.get<ApiResponse<{ count: number }>>('/notifications/unread_count');
  return res.data.data?.count ?? 0;
}

export async function markNotificationRead(id: number): Promise<InAppNotificationDto> {
  const res = await apiClient.patch<ApiResponse<InAppNotificationDto>>(`/notifications/${id}/read`);
  return res.data.data as InAppNotificationDto;
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/notifications/read_all');
}
