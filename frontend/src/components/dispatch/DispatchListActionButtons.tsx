import { Group, Button } from '@mantine/core';
import type { MouseEvent } from 'react';
import { IconArrowRight } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { ListRowActions } from '../../utils/dispatchListActions';

interface DispatchListActionButtonsProps {
  actions: ListRowActions;
  size?: 'xs' | 'sm';
}

export function DispatchListActionButtons({ actions, size = 'sm' }: DispatchListActionButtonsProps) {
  const navigate = useNavigate();

  const go = (path: string) => (event: MouseEvent) => {
    event.stopPropagation();
    navigate(path);
  };

  return (
    <Group gap="xs" wrap="nowrap" justify="flex-end">
      {actions.secondary && (
        <Button
          size={size}
          variant={actions.secondary.variant ?? 'light'}
          color={actions.secondary.color}
          onClick={go(actions.secondary!.path)}
        >
          {actions.secondary.label}
        </Button>
      )}
      <Button
        size={size}
        variant={actions.primary.variant ?? 'filled'}
        color={actions.primary.color}
        rightSection={<IconArrowRight size={14} />}
        onClick={go(actions.primary.path)}
      >
        {actions.primary.label}
      </Button>
    </Group>
  );
}
