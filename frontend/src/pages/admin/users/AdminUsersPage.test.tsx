import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import AdminUsersPage from './AdminUsersPage';
import * as adminUsersApi from '../../../api/adminUsers';
import * as adminRolesApi from '../../../api/adminRoles';
import * as warehousesApi from '../../../api/warehouses';

// Mock the API modules
vi.mock('../../../api/adminUsers');
vi.mock('../../../api/adminRoles');
vi.mock('../../../api/warehouses');
vi.mock('@mantine/notifications');

const mockUsers = [
  {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone_number: '1234567890',
    active: true,
    roles: ['Hub Manager']
  },
  {
    id: 2,
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@example.com',
    phone_number: '0987654321',
    active: true,
    roles: ['Warehouse Manager']
  }
];

const mockWarehouses = [
  { id: 1, name: 'Main Warehouse', code: 'MW001', warehouse_type: 'Standard', status: 'Active' },
  { id: 2, name: 'Secondary Warehouse', code: 'SW001', warehouse_type: 'Standard', status: 'Active' }
];

const mockRoles = [
  { id: 1, name: 'Hub Manager' },
  { id: 2, name: 'Warehouse Manager' }
];

// Wrapper for providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        {component}
      </MantineProvider>
    </QueryClientProvider>
  );
};

describe('AdminUsersPage - Delete Confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(mockUsers);
    vi.mocked(warehousesApi.getWarehouses).mockResolvedValue(mockWarehouses);
    vi.mocked(adminRolesApi.getAdminRoles).mockResolvedValue(mockRoles);
    vi.mocked(adminUsersApi.deleteAdminUser).mockResolvedValue(undefined);
    vi.mocked(notifications.show).mockImplementation(() => '');
  });

  it('shows confirmation modal when delete button is clicked', async () => {
    renderWithProviders(<AdminUsersPage />);

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find and click the delete button for John Doe
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(btn => 
      btn.querySelector('svg') && btn.getAttribute('color') === 'red'
    );
    
    expect(deleteButton).toBeInTheDocument();
    fireEvent.click(deleteButton!);

    // Check that confirmation modal appears
    await waitFor(() => {
      expect(screen.getByText('Delete User')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete user/)).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
    });

    // Check that modal has Cancel and Delete buttons
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete User' })).toBeInTheDocument();
  });

  it('closes confirmation modal when Cancel is clicked', async () => {
    renderWithProviders(<AdminUsersPage />);

    // Wait for users to load and open delete confirmation
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(btn => 
      btn.querySelector('svg') && btn.getAttribute('color') === 'red'
    );
    
    fireEvent.click(deleteButton!);

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText('Delete User')).toBeInTheDocument();
    });

    // Click Cancel
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByText('Delete User')).not.toBeInTheDocument();
    });

    // Verify delete API was not called
    expect(adminUsersApi.deleteAdminUser).not.toHaveBeenCalled();
  });

  it('deletes user when Delete User button is clicked in confirmation modal', async () => {
    renderWithProviders(<AdminUsersPage />);

    // Wait for users to load and open delete confirmation
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(btn => 
      btn.querySelector('svg') && btn.getAttribute('color') === 'red'
    );
    
    fireEvent.click(deleteButton!);

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText('Delete User')).toBeInTheDocument();
    });

    // Click Delete User
    const confirmDeleteButton = screen.getByRole('button', { name: 'Delete User' });
    fireEvent.click(confirmDeleteButton);

    // Verify delete API was called with correct user ID
    await waitFor(() => {
      expect(adminUsersApi.deleteAdminUser).toHaveBeenCalledWith(1);
    });

    // Verify success notification was shown
    expect(notifications.show).toHaveBeenCalledWith({
      title: 'Success',
      message: 'User deleted',
      color: 'green'
    });
  });

  it('shows error notification when delete fails', async () => {
    // Mock delete to fail
    const errorMessage = 'Failed to delete user';
    vi.mocked(adminUsersApi.deleteAdminUser).mockRejectedValue({
      response: { data: { error: { message: errorMessage } } }
    });

    renderWithProviders(<AdminUsersPage />);

    // Wait for users to load and open delete confirmation
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(btn => 
      btn.querySelector('svg') && btn.getAttribute('color') === 'red'
    );
    
    fireEvent.click(deleteButton!);

    // Wait for modal and click delete
    await waitFor(() => {
      expect(screen.getByText('Delete User')).toBeInTheDocument();
    });

    const confirmDeleteButton = screen.getByRole('button', { name: 'Delete User' });
    fireEvent.click(confirmDeleteButton);

    // Verify error notification was shown
    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Error',
        message: errorMessage,
        color: 'red'
      });
    });
  });
});