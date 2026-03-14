import { AppShell as MantineAppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Header } from './Header';
import { RouteGuard } from './RouteGuard';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Header 
          mobileOpened={mobileOpened} 
          desktopOpened={desktopOpened}
          toggleMobile={toggleMobile}
          toggleDesktop={toggleDesktop}
        />
      </MantineAppShell.Header>

      <MantineAppShell.Navbar>
        <Sidebar onLinkClick={() => mobileOpened && toggleMobile()} />
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <RouteGuard />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
