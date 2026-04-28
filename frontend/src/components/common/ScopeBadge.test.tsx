import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ScopeBadge } from './ScopeBadge';

// Wrapper for Mantine components
const renderWithMantine = (component: React.ReactElement) => {
  return render(<MantineProvider>{component}</MantineProvider>);
};

describe('ScopeBadge', () => {
  // Unit tests for specific examples
  it('renders "Federal / System-wide" when both props are null', () => {
    renderWithMantine(<ScopeBadge locationName={null} hierarchicalLevel={null} />);
    expect(screen.getByText('Federal / System-wide')).toBeInTheDocument();
  });

  it('renders "Federal / System-wide" when hierarchicalLevel is "Federal"', () => {
    renderWithMantine(
      <ScopeBadge locationName="Oromia" hierarchicalLevel="Federal" />
    );
    expect(screen.getByText('Federal / System-wide')).toBeInTheDocument();
  });

  it('renders location name and level for regional order', () => {
    renderWithMantine(
      <ScopeBadge locationName="Oromia Region" hierarchicalLevel="Region" />
    );
    expect(screen.getByText('Oromia Region — Region')).toBeInTheDocument();
  });

  it('renders location name and level for zonal order', () => {
    renderWithMantine(
      <ScopeBadge locationName="East Shewa Zone" hierarchicalLevel="Zone" />
    );
    expect(screen.getByText('East Shewa Zone — Zone')).toBeInTheDocument();
  });

  it('renders "Federal / System-wide" when locationName is undefined', () => {
    renderWithMantine(
      <ScopeBadge locationName={undefined} hierarchicalLevel="Region" />
    );
    expect(screen.getByText('Federal / System-wide')).toBeInTheDocument();
  });

  it('renders "Federal / System-wide" when hierarchicalLevel is undefined', () => {
    renderWithMantine(
      <ScopeBadge locationName="Oromia" hierarchicalLevel={undefined} />
    );
    expect(screen.getByText('Federal / System-wide')).toBeInTheDocument();
  });
});
