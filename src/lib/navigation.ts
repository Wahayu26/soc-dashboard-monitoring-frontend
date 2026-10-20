import {
  LayoutDashboard,
  ShieldAlert,
  Activity,
  Lock,
  Server,
  Database,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
  /** Spatie permission name required to see/access this route. \
ull\ = any authenticated user. */
  permission: string | null;
  subtitle?: string;
  children?: NavItem[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Single source of truth for navigation + route-level RBAC.
 * Permission names must match \RolesAndPermissionsSeeder\ on the Laravel side.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Main',
    items: [
      { label: 'Overview', href: '/overview', icon: LayoutDashboard, permission: 'view dashboard', subtitle: 'Security Command Center' },
    ],
  },
  {
    title: 'Security',
    items: [
      {
        label: 'Firewall',
        icon: ShieldAlert,
        permission: 'view firewall',
        children: [
          { label: 'Forti ISFW', href: '/firewall/isfw', permission: 'view firewall', subtitle: 'Internal Segmentation Firewall' },
          { label: 'Forti FGDC', href: '/firewall/fgdc', permission: 'view firewall', subtitle: 'FortiGate Data Center' },
          { label: 'Palo-Alto', href: '/firewall/palo-alto', permission: 'view firewall', subtitle: 'Palo Alto Networks' },
        ],
      },
      { label: 'CrowdStrike EDR', href: '/edr', icon: Activity, permission: 'view crowdstrike', subtitle: 'Endpoint Detection & Response' },
      { label: 'CyberArk PAM', href: '/pam', icon: Lock, permission: 'view cyberark', subtitle: 'Privileged Access Management' },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { label: 'Connector Health', href: '/health', icon: Server, permission: 'view dashboard', subtitle: 'Ingestion pipeline status' },
      { label: 'DB Monitor', href: '/db', icon: Database, permission: 'view db-monitor', subtitle: 'Database performance & sessions' },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => {
  const items: NavItem[] = [];
  g.items.forEach((item) => {
    if (item.href) items.push(item);
    if (item.children) {
      item.children.forEach((child) => {
        if (child.href) items.push(child);
      });
    }
  });
  return items;
});

/** Find the nav item that owns a pathname (longest prefix match). */
export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === '/' || pathname === '/overview') return ALL_ITEMS.find((i) => i.href === '/overview');
  return ALL_ITEMS.filter((i) => i.href && i.href !== '/' && (pathname === i.href || pathname.startsWith(i.href + '/')))
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];
}

export function filterNavByPermissions(permissions: string[]): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.map((i) => {
      if (i.children) {
        return {
          ...i,
          children: i.children.filter((child) => !child.permission || permissions.includes(child.permission)),
        };
      }
      return i;
    }).filter((i) => {
      if (i.children && i.children.length === 0) return false;
      return !i.permission || permissions.includes(i.permission);
    }),
  })).filter((g) => g.items.length > 0);
}
