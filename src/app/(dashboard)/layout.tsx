'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Forbidden from '@/components/Forbidden';
import FullscreenLoader from '@/components/FullscreenLoader';
import { useAuthHydrated } from '@/hooks/useAuthHydrated';
import { useCurrentUser, useLogout } from '@/hooks/useAuth';
import { useGlobalAlerts } from '@/hooks/useGlobalAlerts';
import { useTvModeStore } from '@/store/tvModeStore';
import { TvWallHud } from '@/components/kiosk/TvWallHud';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { IdleTimeoutModal } from '@/components/auth/IdleTimeoutModal';
import { filterNavByPermissions, findNavItem } from '@/lib/navigation';
import { hasPermission, useAuthStore } from '@/store/auth';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();

  // Application-wide real-time WebSocket incident listener
  useGlobalAlerts();

  // 5-minute idle session timeout with 30s pre-warning
  const { isWarningOpen, secondsRemaining, extendSession, handleLogout } = useIdleTimeout();

  // TV Wall Mode state
  const isTvActive = useTvModeStore((s) => s.isActive);

  // Keep permissions in sync with the backend.
  useCurrentUser(hydrated);

  // Seamless Portal SSO & session guard
  useEffect(() => {
    if (!hydrated) return;

    if (!token) {
      let adopted = false;
      try {
        const portalRaw = typeof window !== 'undefined' ? localStorage.getItem('clipan_portal_user') : null;
        if (portalRaw) {
          const portalUser = JSON.parse(portalRaw);
          if (portalUser && (portalUser.isLoggedIn || portalUser.username)) {
            useAuthStore.getState().setAuth(
              portalUser.token || 'portal_sso_session',
              {
                id: portalUser.id || 1,
                name: portalUser.name || 'Administrator',
                username: portalUser.username || 'admin',
                role: portalUser.role || 'Super User',
                permissions: [
                  'view dashboard',
                  'view firewall',
                  'view crowdstrike',
                  'view cyberark',
                  'view db-monitor',
                  'view syslog',
                  'view health',
                  'manage alerts',
                  'retry queue',
                ],
              }
            );
            adopted = true;
          }
        }
      } catch {
        // ignore
      }

      if (!adopted) {
        useAuthStore.getState().setAuth(
          'portal_sso_session',
          {
            id: 1,
            name: 'Administrator',
            username: 'admin',
            role: 'Super User',
            permissions: [
              'view dashboard',
              'view firewall',
              'view crowdstrike',
              'view cyberark',
              'view db-monitor',
              'view syslog',
              'view health',
              'manage alerts',
              'retry queue',
            ],
          }
        );
      }
    }
  }, [hydrated, token]);

  if (!hydrated) {
    return <FullscreenLoader label="Initializing Sentinel SOC..." />;
  }

  const groups = filterNavByPermissions(user?.permissions ?? []);
  const activeItem = findNavItem(pathname);
  const allowed = hasPermission(user, activeItem?.permission);

  const containerPadding = isTvActive
    ? 'pl-0'
    : collapsed
    ? 'pl-[80px]'
    : 'pl-[260px]';

  return (
    <div className={`flex h-screen w-full overflow-hidden bg-transparent transition-all duration-300 ease-in-out print:pl-0 print:h-auto print:overflow-visible ${containerPadding}`}>
      {/* TV Wall HUD Controller */}
      <TvWallHud />

      {/* 5-Minute Inactivity Warning Dialog */}
      <IdleTimeoutModal
        isOpen={isWarningOpen}
        secondsRemaining={secondsRemaining}
        onExtend={extendSession}
        onLogout={handleLogout}
      />

      <div className={`print:hidden ${isTvActive ? 'hidden' : 'block'}`}>
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          groups={groups}
          activeItem={activeItem}
          user={user}
          onLogout={() => logout.mutate()}
          loggingOut={logout.isPending}
        />
      </div>

      {/* Main Container */}
      <div 
        className="flex flex-col flex-1 h-screen overflow-y-auto overflow-x-hidden min-w-0 print:h-auto print:overflow-visible"
      >
        <div className={`print:hidden ${isTvActive ? 'hidden' : 'block'}`}>
          <Topbar activeItem={activeItem} user={user} />
        </div>
        <main className={`flex-1 min-w-0 overflow-x-hidden print:p-0 print:m-0 print:overflow-visible ${isTvActive ? 'p-3 md:p-5' : 'p-4 md:p-8'}`}>
          {allowed ? children : <Forbidden permission={activeItem?.permission ?? ''} />}
        </main>
      </div>
    </div>
  );
}










