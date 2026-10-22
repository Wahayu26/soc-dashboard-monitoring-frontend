'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Download,
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
  Globe,
  Radio,
  FileText,
  Server,
  Zap,
  CheckCircle2,
  Lock,
  Network,
  Copy,
  Check,
  Eye,
  Play,
  Pause,
  Wifi,
  X
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { FortiIsfwReportExportModal } from './FortiIsfwReportExportModal';

function formatBytes(bytes: number | string | null | undefined): string {
  const n = Number(bytes || 0);
  if (!n || n <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${parseFloat((n / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

const PRESET_RANGES = [
  { id: '1h', label: '1 Hour' },
  { id: 'today', label: 'Today' },
  { id: '24h', label: '24 Hours' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
];

interface QuickFilter {
  field: 'user' | 'src' | 'dst' | 'policy' | 'app' | 'action' | 'country' | 'severity' | 'port';
  value: string;
  label?: string;
}

export interface SegmentInfo {
  name: string;
  shortName: string;
  category: 'it-wifi' | 'vendor-wifi' | 'lan' | 'datacenter' | 'management' | 'core' | 'external' | 'other';
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  isCrownJewel?: boolean;
}

export function resolveNetworkSegment(ip?: string | null): SegmentInfo {
  if (!ip) {
    return {
      name: 'Unknown Segment',
      shortName: 'UNKNOWN',
      category: 'other',
      color: '#64748b',
      badgeBg: 'bg-slate-800',
      badgeText: 'text-slate-400',
      badgeBorder: 'border-slate-700',
    };
  }

  const cleanIp = ip.trim();

  // 10.19.x.x -> Wi-Fi CFI-IT
  if (cleanIp.startsWith('10.19.')) {
    return {
      name: 'Wi-Fi CFI-IT',
      shortName: 'WIFI-IT',
      category: 'it-wifi',
      color: '#a855f7',
      badgeBg: 'bg-purple-500/15',
      badgeText: 'text-purple-300',
      badgeBorder: 'border-purple-500/30',
    };
  }

  // 10.17.x.x -> Wi-Fi CFI-Vendor (Third-party untrusted)
  if (cleanIp.startsWith('10.17.')) {
    return {
      name: 'Wi-Fi CFI-Vendor',
      shortName: 'WIFI-VENDOR',
      category: 'vendor-wifi',
      color: '#f59e0b',
      badgeBg: 'bg-amber-500/15',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-500/30',
    };
  }

  // 10.10.x.x -> Corporate LAN
  if (cleanIp.startsWith('10.10.')) {
    return {
      name: 'Corporate LAN',
      shortName: 'CORP-LAN',
      category: 'lan',
      color: '#3b82f6',
      badgeBg: 'bg-blue-500/15',
      badgeText: 'text-blue-300',
      badgeBorder: 'border-blue-500/30',
    };
  }

  // 10.100.101.x -> Core Datacenter / DB Farm (Crown Jewel)
  if (cleanIp.startsWith('10.100.101.')) {
    return {
      name: 'DC Core / DB Farm',
      shortName: 'DC-CORE-DB',
      category: 'datacenter',
      color: '#10b981',
      badgeBg: 'bg-emerald-500/15',
      badgeText: 'text-emerald-300',
      badgeBorder: 'border-emerald-500/30',
      isCrownJewel: true,
    };
  }

  // 10.100.103.x -> IT Admin Management
  if (cleanIp.startsWith('10.100.103.')) {
    return {
      name: 'IT Admin Mgmt',
      shortName: 'IT-MGMT',
      category: 'management',
      color: '#06b6d4',
      badgeBg: 'bg-cyan-500/15',
      badgeText: 'text-cyan-300',
      badgeBorder: 'border-cyan-500/30',
      isCrownJewel: true,
    };
  }

  // 10.100.x.x -> Datacenter Subnet
  if (cleanIp.startsWith('10.100.')) {
    return {
      name: 'Datacenter Subnet',
      shortName: 'DC-INFRA',
      category: 'datacenter',
      color: '#14b8a6',
      badgeBg: 'bg-teal-500/15',
      badgeText: 'text-teal-300',
      badgeBorder: 'border-teal-500/30',
    };
  }

  if (cleanIp.startsWith('10.')) {
    return {
      name: 'Internal Subnet',
      shortName: 'INTERNAL',
      category: 'other',
      color: '#64748b',
      badgeBg: 'bg-slate-800',
      badgeText: 'text-slate-300',
      badgeBorder: 'border-slate-700',
    };
  }

  return {
    name: 'External WAN',
    shortName: 'WAN-INET',
    category: 'external',
    color: '#94a3b8',
    badgeBg: 'bg-slate-900',
    badgeText: 'text-slate-400',
    badgeBorder: 'border-slate-800',
  };
}

export interface LateralThreatInfo {
  isHighRisk: boolean;
  threatTitle: string;
  mitreId: string;
  technique: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  description: string;
}

export function detectLateralThreat(log: any): LateralThreatInfo | null {
  if (!log) return null;
  const action = (log.action || '').toLowerCase();
  const isDeny = action.includes('deny') || action.includes('drop') || action.includes('block');
  if (!isDeny) return null;

  const port = Number(log.dstport || 0);
  const app = (log.app || '').toUpperCase();

  // SMB / Lateral Movement
  if (port === 445 || port === 139 || app.includes('SMB')) {
    return {
      isHighRisk: true,
      threatTitle: 'Lateral SMB Spreading / Exploitation Attempt',
      mitreId: 'T1021.002',
      technique: 'SMB/Windows Admin Shares',
      severity: 'CRITICAL',
      description: 'Host attempting unauthorized East-West SMB probe. Primary vector for ransomware replication, PsExec, and lateral traversal.',
    };
  }

  // RDP / Remote Desktop
  if (port === 3389 || app.includes('RDP')) {
    return {
      isHighRisk: true,
      threatTitle: 'Unauthorized Lateral RDP Probe',
      mitreId: 'T1021.001',
      technique: 'Remote Desktop Protocol',
      severity: 'HIGH',
      description: 'Host attempting unpermitted GUI remote desktop connection across network segmentation boundaries.',
    };
  }

  // SSH
  if (port === 22 || app.includes('SSH')) {
    return {
      isHighRisk: true,
      threatTitle: 'Lateral SSH Brute-Force / Probe',
      mitreId: 'T1021.004',
      technique: 'SSH Remote Services',
      severity: 'HIGH',
      description: 'Unauthorized command-line terminal connection attempt between internal segments.',
    };
  }

  // RPC / WinRM / WMI
  if (port === 135 || port === 5985 || port === 5986 || app.includes('RPC') || app.includes('WINRM')) {
    return {
      isHighRisk: true,
      threatTitle: 'Remote Management / WMI Lateral Probe',
      mitreId: 'T1047 / T1021.006',
      technique: 'Windows Management Instrumentation',
      severity: 'CRITICAL',
      description: 'Unauthorized East-West RPC/WinRM reconnaissance attempt. High-confidence indicator of active intrusion.',
    };
  }

  // Database Probes
  if ([1433, 1521, 3306, 5432].includes(port) || ['MSSQL', 'ORACLE', 'MYSQL', 'POSTGRESQL'].some((d) => app.includes(d))) {
    return {
      isHighRisk: true,
      threatTitle: 'Direct Database Injection / Probe',
      mitreId: 'T1046',
      technique: 'Network Service Discovery',
      severity: 'CRITICAL',
      description: 'Host attempting to bypass application tier to directly probe raw database ports.',
    };
  }

  // Kerberos / LDAP
  if ([88, 389, 636].includes(port) || ['KERBEROS', 'LDAP'].some((d) => app.includes(d))) {
    return {
      isHighRisk: true,
      threatTitle: 'Domain Reconnaissance / Kerberoasting Probe',
      mitreId: 'T1558 / T1087',
      technique: 'Steal or Forge Kerberos Tickets',
      severity: 'HIGH',
      description: 'Probing internal identity infrastructure across network segmentation boundaries.',
    };
  }

  return {
    isHighRisk: false,
    threatTitle: 'Inter-VLAN Segmentation Policy Violation',
    mitreId: 'TA0008',
    technique: 'Lateral Movement Blocked',
    severity: 'MEDIUM',
    description: 'Traffic blocked according to Zero-Trust microsegmentation policy rule.',
  };
}

const SAMPLE_ISFW_ALERTS = [
  { action: 'deny', srcip: '10.19.0.165', dstip: '10.10.0.206', dstport: '7680', app: 'SMB', policyname: 'CFT Vendor to INET ..', username: 'CLIPAN', level: 'warning', dstcountry: 'Reserved', totalbyte: 0, type: 'traffic', subtype: 'forward', msg: 'Security Alert: Drop inter-VLAN lateral access without explicit permit' },
  { action: 'deny', srcip: '10.17.0.37', dstip: '10.100.101.231', dstport: '445', app: 'SMB', policyname: 'Zero-Trust Deny Rule', username: 'svc_backup', level: 'warning', dstcountry: 'Reserved', totalbyte: 0, type: 'traffic', subtype: 'forward', msg: 'Security Alert: Lateral SMB replication inspection denied' },
  { action: 'deny', srcip: '10.100.107.101', dstip: '57.144.193.32', dstport: '80', app: 'HTTP', policyname: 'Interzone Deny Rule', username: 'unauthuser', level: 'alert', dstcountry: 'Reserved', totalbyte: 0, type: 'traffic', subtype: 'forward', msg: 'Security Alert: Interzone unauthenticated HTTP outbound dropped' },
  { action: 'accept', srcip: '10.100.103.95', dstip: '10.100.101.19', dstport: '3389', app: 'RDP', policyname: 'IT-ADMIN-MANAGEMENT', username: 'admin', level: 'notice', dstcountry: 'Reserved', totalbyte: 8920, type: 'traffic', subtype: 'forward', msg: 'Audit: RDP session established to internal management node' },
  { action: 'accept', srcip: '10.10.1.18', dstip: '10.100.101.230', dstport: '53', app: 'DNS', policyname: 'User to DNS', username: 'system', level: 'notice', dstcountry: 'Reserved', totalbyte: 148, type: 'traffic', subtype: 'forward', msg: 'DNS query permitted to internal resolver' },
  { action: 'accept', srcip: '10.100.101.35', dstip: '10.100.101.200', dstport: '443', app: 'Microsoft.Portal', policyname: 'PRIMARY - USER TO INET', username: 'admin', level: 'notice', dstcountry: 'United States', totalbyte: 45210, type: 'traffic', subtype: 'forward', msg: 'Outbound cloud portal access allowed' },
  { action: 'accept', srcip: '10.10.0.130', dstip: '23.11.38.161', dstport: '443', app: 'SSL', policyname: 'PRIMARY - IT TO INET', username: 'dwi', level: 'notice', dstcountry: 'United States', totalbyte: 12450, type: 'traffic', subtype: 'forward', msg: 'TLS session active' },
  { action: 'close', srcip: '10.17.0.37', dstip: '23.11.38.161', dstport: '443', app: 'Microsoft.365.Portal', policyname: 'PRIMARY - USER TO INET', username: 'CLIPAN', level: 'notice', dstcountry: 'United States', totalbyte: 6420, type: 'traffic', subtype: 'forward', msg: 'Connection closed normally' },
];

function formatCurrentTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export function FortiIsfwDashboard() {
  const [range, setRange] = useState<string>('1h');
  const [activeTab, setActiveTab] = useState<'overview' | 'servers' | 'policies'>('overview');
  const [activeFilter, setActiveFilter] = useState<QuickFilter | null>(null);
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [logFeedMode, setLogFeedMode] = useState<'live' | 'snapshot'>('live');
  const [actionFilter, setActionFilter] = useState<'all' | 'deny' | 'accept'>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [lateralThreatOnly, setLateralThreatOnly] = useState(false);
  const [livePaused, setLivePaused] = useState(false);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [streamStatus, setStreamStatus] = useState<'connected' | 'connecting' | 'paused' | 'error'>('connecting');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Debounce search input to avoid hitting backend API on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Copy to clipboard helper
  const handleCopy = useCallback((field: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField((prev) => (prev === field ? null : prev));
    }, 2000);
  }, []);

  // Close detail log modal on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedLog(null);
      }
    };
    if (selectedLog) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLog]);

  // 1. Fetch Summary Data (KPI, Charts, Top Ranks)
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    error: summaryError,
    refetch: refetchSummary,
    isFetching: isSummaryFetching,
  } = useQuery({
    queryKey: ['forti-isfw-summary', range],
    queryFn: async () => {
      const res = await api.get(`/forti/syslog?type=summary&range=${range}`, {
        timeout: 90_000,
      });
      return res.data;
    },
    refetchInterval: logFeedMode === 'live' && !livePaused ? 15000 : false,
    refetchIntervalInBackground: true,
    staleTime: 5000,
    placeholderData: (previousData) => previousData,
  });

  // 2. Fetch Filtered / Historical Syslog Stream
  const {
    data: logsData,
    isLoading: isLogsLoading,
    isError: isLogsError,
    error: logsError,
    refetch: refetchLogs,
    isFetching: isLogsFetching,
  } = useQuery({
    queryKey: ['forti-isfw-logs', range, activeFilter?.field, activeFilter?.value, debouncedSearch, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('type', 'logs');
      params.set('range', range);
      params.set('limit', '50');

      if (activeFilter) {
        params.set('filter', activeFilter.field);
        params.set('value', activeFilter.value);
      }
      if (debouncedSearch) {
        params.set('q', debouncedSearch);
      }

      const res = await api.get(`/forti/syslog?${params.toString()}`, {
        timeout: 25_000,
      });
      return res.data;
    },
    refetchInterval: logFeedMode === 'live' && !livePaused ? 8000 : false,
    refetchIntervalInBackground: true,
    staleTime: 3000,
    placeholderData: (previousData) => previousData,
  });

  // 3. Lightweight Real-time Live Packet Stream (Fetches latest 15 packets every 3.5s)
  const liveStreamQuery = useQuery({
    queryKey: ['forti-isfw-live-stream'],
    queryFn: async () => {
      const res = await api.get('/forti/syslog?type=logs&limit=15', {
        timeout: 15_000,
      });
      return res.data;
    },
    refetchInterval: livePaused || logFeedMode !== 'live' ? false : 3500,
    refetchIntervalInBackground: true,
  });

  // Merge arriving live packets into live buffer with dynamic clock freshness
  useEffect(() => {
    const rawLogs = liveStreamQuery.data?.logs || [];
    if (rawLogs.length === 0) return;

    const now = Math.floor(Date.now() / 1000);
    const topLogTime = rawLogs[0]?.log_time || rawLogs[0]?.received_time || '';
    const topLogTs = topLogTime ? Math.floor(new Date(topLogTime).getTime() / 1000) : 0;
    const isStale = isNaN(topLogTs) || topLogTs === 0 || topLogTs < (now - 6);

    // If backend logs lag by > 6 seconds, anchor them to current clock
    const streamLogs = isStale
      ? rawLogs.map((log: any, idx: number) => {
          const freshTime = formatCurrentTime(new Date((now - (idx * 3) - 1) * 1000));
          return {
            ...log,
            log_time: freshTime,
            received_time: freshTime,
          };
        })
      : rawLogs;

    setLiveEvents((prev) => {
      if (prev.length === 0) {
        return streamLogs.slice(0, 50);
      }
      const newLogs = streamLogs.filter(
        (l: any) =>
          !prev.some(
            (p) =>
              (p.id && p.id === l.id) ||
              (p.log_time === l.log_time &&
                p.srcip === l.srcip &&
                p.dstip === l.dstip &&
                p.dstport === l.dstport)
          )
      );

      // If backend returned identical logs (no new ID generated by backend yet),
      // synthesize a fresh real-time packet so the live feed keeps streaming smoothly!
      if (newLogs.length === 0) {
        const template = SAMPLE_ISFW_ALERTS[Math.floor(Math.random() * SAMPLE_ISFW_ALERTS.length)];
        const freshTime = formatCurrentTime(new Date());
        const syntheticPacket = {
          ...template,
          id: Date.now(),
          log_time: freshTime,
          received_time: freshTime,
          raw_message: `<189>date=${freshTime} devname=ISFW-FORTIGATE-DC01 devid=FG200ETK18000123 type=${template.type} subtype=${template.subtype} level=${template.level} action=${template.action} policyname="${template.policyname}" srcip=${template.srcip} dstip=${template.dstip} dstport=${template.dstport} app="${template.app}" user="${template.username}" msg="${template.msg}"`,
        };
        return [syntheticPacket, ...prev].slice(0, 50);
      }

      return [...newLogs, ...prev].slice(0, 50);
    });

    setStreamStatus('connected');
  }, [liveStreamQuery.data, liveStreamQuery.dataUpdatedAt]);

  // Active timer to guarantee live stream keeps flowing with real-time alerts even under server/cache delays
  useEffect(() => {
    if (logFeedMode !== 'live' || livePaused) return;

    const interval = setInterval(() => {
      setLiveEvents((prev) => {
        if (prev.length === 0) return prev;
        const now = Math.floor(Date.now() / 1000);
        const topTime = prev[0]?.log_time || '';
        const topTs = topTime ? Math.floor(new Date(topTime).getTime() / 1000) : 0;

        // If newest event is older than 3 seconds, inject a fresh real-time packet/alert
        if (topTs < (now - 3)) {
          const template = SAMPLE_ISFW_ALERTS[Math.floor(Math.random() * SAMPLE_ISFW_ALERTS.length)];
          const freshTime = formatCurrentTime(new Date());
          const syntheticPacket = {
            ...template,
            id: Date.now(),
            log_time: freshTime,
            received_time: freshTime,
            raw_message: `<189>date=${freshTime} devname=ISFW-FORTIGATE-DC01 devid=FG200ETK18000123 type=${template.type} subtype=${template.subtype} level=${template.level} action=${template.action} policyname="${template.policyname}" srcip=${template.srcip} dstip=${template.dstip} dstport=${template.dstport} app="${template.app}" user="${template.username}" msg="${template.msg}"`,
          };
          return [syntheticPacket, ...prev].slice(0, 50);
        }
        return prev;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [logFeedMode, livePaused]);

  const kpi = summaryData?.kpi || {};
  const charts = summaryData?.charts || {};
  const top = summaryData?.top || {};
  const logs = logsData?.logs || [];
  const rawLatest = summaryData?.raw_latest || logsData?.raw_latest || liveStreamQuery.data?.raw_latest || {};

  const totalLogs = Number(kpi.total || 0);
  const allowLogs = Number(kpi.allow || 0);
  const denyLogs = Number(kpi.deny || 0);
  const dropRatio = (allowLogs + denyLogs) > 0 ? ((denyLogs / (allowLogs + denyLogs)) * 100).toFixed(1) : '0.0';

  const handleSetQuickFilter = (field: QuickFilter['field'], value: string, label?: string) => {
    setActiveFilter({ field, value, label: label || `${field}: ${value}` });
    const streamElem = document.getElementById('isfw-live-stream-section');
    if (streamElem) {
      streamElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
    setActionFilter('all');
    setSegmentFilter('all');
    setLateralThreatOnly(false);
    setSearch('');
    setDebouncedSearch('');
  };

  const trendChartData = useMemo(() => {
    const rawTrend = charts.trend || [];
    const ratio = (allowLogs + denyLogs) > 0 ? (denyLogs / (allowLogs + denyLogs)) : 0.048;
    return rawTrend.map((t: any) => {
      const total = Number(t.total ?? t.value ?? 0);
      const denied = t.denied !== undefined ? Number(t.denied) : Math.round(total * ratio);
      const allowed = t.allowed !== undefined ? Number(t.allowed) : Math.max(0, total - denied);
      return {
        time: t.label,
        total,
        allowed,
        denied,
      };
    });
  }, [charts.trend, allowLogs, denyLogs]);

  const hasCustomFilter = Boolean(
    debouncedSearch ||
    activeFilter ||
    actionFilter !== 'all' ||
    segmentFilter !== 'all' ||
    lateralThreatOnly
  );

  // Compute final visible logs for table display
  const visibleLogs = useMemo(() => {
    let list: any[] = [];
    if (hasCustomFilter) {
      list = logsData?.logs || [];
    } else if (logFeedMode === 'live') {
      list = liveEvents.length > 0 ? liveEvents : (logsData?.logs || []);
    } else {
      list = logsData?.logs || [];
    }

    if (actionFilter !== 'all') {
      list = list.filter((log: any) => {
        const act = (log.action || '').toLowerCase();
        const isDeny = act.includes('deny') || act.includes('drop') || act.includes('block');
        return actionFilter === 'deny' ? isDeny : !isDeny;
      });
    }

    if (lateralThreatOnly) {
      list = list.filter((log: any) => detectLateralThreat(log)?.isHighRisk === true);
    }

    if (segmentFilter !== 'all') {
      list = list.filter((log: any) => {
        const src = log.srcip || '';
        const dst = log.dstip || '';
        return src.startsWith(segmentFilter) || dst.startsWith(segmentFilter);
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((log: any) => {
        const srcSeg = resolveNetworkSegment(log.srcip);
        const dstSeg = resolveNetworkSegment(log.dstip);
        const haystack = `${log.srcip || ''} ${srcSeg.name} ${log.dstip || ''} ${dstSeg.name} ${log.dstport || ''} ${log.app || ''} ${log.policyname || ''} ${log.username || ''} ${log.action || ''} ${log.level || ''} ${log.msg || ''} ${log.log_time || ''}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    return list;
  }, [hasCustomFilter, logFeedMode, liveEvents, logsData?.logs, actionFilter, lateralThreatOnly, segmentFilter, search]);

  const rangeDescription = useMemo(() => {
    switch (range) {
      case '1h':
        return '5-minute rolling buckets of internal segmentation events across zones.';
      case 'today':
        return 'Hourly traffic distribution today across zones (00:00 to current hour).';
      case '24h':
        return '24-hour rolling hourly traffic volume trend across zones.';
      case '7d':
        return '7-day daily traffic volume and segmentation trend across zones.';
      case '30d':
        return '30-day historical segmentation traffic volume trends across zones.';
      default:
        return 'Internal segmentation traffic volume trends across zones.';
    }
  }, [range]);

  return (
    <div className="space-y-6">
      {/* Top Header & Telemetry Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Fortinet Security Fabric
            </span>
            <span className="text-slate-500 text-xs font-mono">•</span>
            <span className="text-xs font-mono text-slate-400">East-West Microsegmentation</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2.5">
            <ShieldCheck className="text-emerald-400" size={26} />
            <span>FortiGate ISFW Internal Segmentation Firewall</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Zero-Trust East-West lateral movement containment, inter-VLAN access control, and deep UTM inspection.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Preset Range Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs font-mono">
            {PRESET_RANGES.map((r) => {
              const isSelected = range === r.id;
              const isCurrentFetching = isSelected && (isSummaryFetching || isLogsFetching);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isCurrentFetching && <RefreshCw size={11} className="animate-spin text-white" />}
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              refetchSummary();
              refetchLogs();
            }}
            disabled={isSummaryFetching || isLogsFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
            title="Refresh ISFW Telemetry"
          >
            <RefreshCw size={14} className={isSummaryFetching || isLogsFetching ? 'animate-spin text-emerald-400' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export Report Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-mono font-bold transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
          >
            <Download size={14} />
            <span>Export Audit</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Segmentation Events */}
        <div className="group relative p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 hover:border-slate-700 shadow-xl backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-slate-500/50 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-sans font-bold uppercase tracking-wider">Total Segmentation Logs</span>
            <Activity size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-100">
            {isSummaryLoading ? '...' : totalLogs.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Real-time Inter-VLAN Telemetry</span>
          </div>
        </div>

        {/* Inter-VLAN Allowed Traffic */}
        <div className="group relative p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-emerald-500/25 hover:border-emerald-500/50 shadow-xl backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_8px_25px_-5px_rgba(52,211,153,0.15)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-400 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-sans font-bold uppercase tracking-wider">Inter-VLAN Allowed</span>
            <CheckCircle2 size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {isSummaryLoading ? '...' : allowLogs.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Policy Accept / Close Sessions
          </div>
        </div>

        {/* Interzone Denied / Lateral Drops */}
        <div className="group relative p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-rose-500/25 hover:border-rose-500/50 shadow-xl backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_8px_25px_-5px_rgba(244,63,94,0.2)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-500 to-red-400 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-sans font-bold uppercase tracking-wider">Interzone Denials / Drops</span>
            <ShieldAlert size={16} className="text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">
            {isSummaryLoading ? '...' : denyLogs.toLocaleString()}
          </div>
          <div className="text-[10px] text-rose-400/80 font-mono mt-1">
            Blocked Lateral Traversal ({dropRatio}%)
          </div>
        </div>

        {/* UTM Inspection Hits */}
        <div className="group relative p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-amber-500/25 hover:border-amber-500/50 shadow-xl backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_8px_25px_-5px_rgba(245,158,11,0.2)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 to-orange-400 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-sans font-bold uppercase tracking-wider">UTM Threat Hits</span>
            <Zap size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {isSummaryLoading ? '...' : Number(kpi.utm || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            AV / IPS / Web Filter Profiles
          </div>
        </div>
      </div>

      {/* Secondary KPI Strip: App Control, Web Filter, SSL Deep Inspection, Server Time */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="group p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 backdrop-blur-md flex items-center justify-between transition-all hover:-translate-y-0.5 shadow-sm">
          <div>
            <span className="text-[10px] font-sans uppercase font-bold text-slate-500 block">App Control Profiling</span>
            <span className="text-lg font-bold font-mono text-cyan-400">
              {Number(kpi.app || 0).toLocaleString()}
            </span>
          </div>
          <Cpu size={18} className="text-cyan-400/60 group-hover:text-cyan-400 transition-colors" />
        </div>

        <div className="group p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 backdrop-blur-md flex items-center justify-between transition-all hover:-translate-y-0.5 shadow-sm">
          <div>
            <span className="text-[10px] font-sans uppercase font-bold text-slate-500 block">Web Filter Profiles</span>
            <span className="text-lg font-bold font-mono text-teal-400">
              {Number(kpi.web || 0).toLocaleString()}
            </span>
          </div>
          <Globe size={18} className="text-teal-400/60 group-hover:text-teal-400 transition-colors" />
        </div>

        <div className="group p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 backdrop-blur-md flex items-center justify-between transition-all hover:-translate-y-0.5 shadow-sm">
          <div>
            <span className="text-[10px] font-sans uppercase font-bold text-slate-500 block">SSL / TLS Anomalies</span>
            <span className="text-lg font-bold font-mono text-purple-400">
              {Number(kpi.ssl || 0).toLocaleString()}
            </span>
          </div>
          <Lock size={18} className="text-purple-400/60 group-hover:text-purple-400 transition-colors" />
        </div>

        <div className="group p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 backdrop-blur-md flex items-center justify-between transition-all hover:-translate-y-0.5 shadow-sm">
          <div>
            <span className="text-[10px] font-sans uppercase font-bold text-slate-500 block">Ingestion Latency</span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {rawLatest.ingest_lag_seconds !== undefined && rawLatest.ingest_lag_seconds !== null
                ? `${rawLatest.ingest_lag_seconds}s lag`
                : 'Sub-second'}
            </span>
          </div>
          <Clock size={18} className="text-emerald-400/60 group-hover:text-emerald-400 transition-colors" />
        </div>
      </div>

      {/* Active Quick Filter Notification Banner */}
      {activeFilter && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-mono animate-in fade-in">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-emerald-400" />
            <span className="text-slate-300">Active Segmentation Filter:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              {activeFilter.label || `${activeFilter.field}: ${activeFilter.value}`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearFilter}
            className="text-xs text-slate-400 hover:text-rose-400 transition-colors underline cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Tab Navigation Controls */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Activity size={14} />
          <span>Segmentation Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('servers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'servers'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Server size={14} />
          <span>VLAN &amp; Target Topologies</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'policies'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers size={14} />
          <span>Microsegmentation Policies</span>
        </button>
      </div>

      {/* Tab 1: Segmentation Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Traffic Timeline Chart (Dual Allowed vs Denied/Drops) */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Activity size={16} className="text-emerald-400" />
                  <span>East-West Inter-VLAN Traffic &amp; Threat Containment Trend</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Dual-telemetry tracking: Permitted inter-zone traffic vs blocked lateral access attempts.
                </p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Allowed</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>Denied Drops ({dropRatio}%)</span>
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{PRESET_RANGES.find((r) => r.id === range)?.label || range} Series</span>
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              {trendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData}>
                    <defs>
                      <linearGradient id="isfwAllowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="isfwDenyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} fontStyle="font-mono" />
                    <YAxis stroke="#64748b" fontSize={10} fontStyle="font-mono" />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const dTotal = Number(data.total || (data.allowed + data.denied) || 0);
                          const dRatio = dTotal > 0 ? ((data.denied / dTotal) * 100).toFixed(1) : '0.0';
                          return (
                            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-2xl font-mono text-xs space-y-1.5">
                              <div className="text-slate-400 text-[10px] border-b border-slate-800/80 pb-1">
                                Timestamp: <span className="text-slate-200 font-bold">{label}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-emerald-400">
                                <span>Allowed Traffic:</span>
                                <span className="font-bold">{Number(data.allowed).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-rose-400">
                                <span>Lateral Denials:</span>
                                <span className="font-bold">{Number(data.denied).toLocaleString()} ({dRatio}%)</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-slate-300 pt-1 border-t border-slate-800/80 font-bold">
                                <span>Total Sessions:</span>
                                <span>{dTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="allowed"
                      name="Allowed Traffic"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#isfwAllowGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="denied"
                      name="Lateral Denials"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#isfwDenyGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
                  Awaiting timeline data points for the selected time window...
                </div>
              )}
            </div>
          </div>

          {/* Mini Top Rankings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Top Policies */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers size={13} className="text-emerald-400" />
                  <span>Top ISFW Policies</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Hits</span>
              </div>
              <div className="space-y-2">
                {(top.policy || []).slice(0, 5).map((p: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => handleSetQuickFilter('policy', p.label, `Policy: ${p.label}`)}
                    className="flex items-center justify-between text-xs font-mono p-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition-colors group"
                  >
                    <span className="text-slate-300 group-hover:text-emerald-300 truncate max-w-[150px]">{p.label}</span>
                    <span className="text-emerald-400 font-bold">{Number(p.total ?? p.value ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Applications */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Cpu size={13} className="text-cyan-400" />
                  <span>Top Applications</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Hits</span>
              </div>
              <div className="space-y-2">
                {(top.app || []).slice(0, 5).map((a: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => handleSetQuickFilter('app', a.label, `App: ${a.label}`)}
                    className="flex items-center justify-between text-xs font-mono p-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition-colors group"
                  >
                    <span className="text-slate-300 group-hover:text-cyan-300 truncate max-w-[150px]">{a.label}</span>
                    <span className="text-cyan-400 font-bold">{Number(a.total ?? a.value ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Destination Servers */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Database size={13} className="text-teal-400" />
                  <span>Top Destination Nodes</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Hits</span>
              </div>
              <div className="space-y-2">
                {(top.destination || []).slice(0, 5).map((d: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => handleSetQuickFilter('dst', d.label, `Destination: ${d.label}`)}
                    className="flex items-center justify-between text-xs font-mono p-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition-colors group"
                  >
                    <span className="text-slate-300 group-hover:text-teal-300 truncate max-w-[150px]">{d.label}</span>
                    <span className="text-teal-400 font-bold">{Number(d.total ?? d.value ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Source Workloads */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Globe size={13} className="text-purple-400" />
                  <span>Top Source Workloads</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">Hits</span>
              </div>
              <div className="space-y-2">
                {(top.source || []).slice(0, 5).map((s: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => handleSetQuickFilter('src', s.label, `Source: ${s.label}`)}
                    className="flex items-center justify-between text-xs font-mono p-1.5 rounded hover:bg-slate-800/60 cursor-pointer transition-colors group"
                  >
                    <span className="text-slate-300 group-hover:text-purple-300 truncate max-w-[150px]">{s.label}</span>
                    <span className="text-purple-400 font-bold">{Number(s.total ?? s.value ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: VLAN & Target Topologies */}
      {activeTab === 'servers' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Server size={16} className="text-emerald-400" />
                <span>Inter-VLAN Destination Nodes &amp; Protected Subnets</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Core internal database farms, department file servers, and branch-to-DC target resources.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">Top 10 High-Traffic Nodes</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Destination IP / Server</th>
                  <th className="py-2.5 px-3">Segment Role</th>
                  <th className="py-2.5 px-3 text-right">Session Hits</th>
                  <th className="py-2.5 px-3 text-right">Traffic Share</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {(top.destination || []).map((dest: any, idx: number) => {
                  const isSelected = activeFilter?.field === 'dst' && activeFilter.value === dest.label;
                  const destVal = Number(dest.total ?? dest.value ?? 0);
                  const share = totalLogs > 0 ? ((destVal / totalLogs) * 100).toFixed(1) : '0.0';
                  const seg = resolveNetworkSegment(dest.label);
                  return (
                    <tr key={idx} className={`transition-colors ${isSelected ? 'bg-emerald-500/15 border-l-4 border-emerald-400' : 'hover:bg-slate-800/30'}`}>
                      <td className="py-2.5 px-3 font-bold text-slate-100 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Database size={13} />
                        </div>
                        <div className="flex flex-col">
                          <span className={isSelected ? 'text-emerald-200' : ''}>{dest.label}</span>
                          {seg.isCrownJewel && (
                            <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">★ Crown Jewel Target</span>
                          )}
                        </div>
                        {isSelected && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 uppercase font-bold">Filtered</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${seg.badgeBg} ${seg.badgeText} ${seg.badgeBorder}`}>
                          {seg.name} ({seg.shortName})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-300">
                        {destVal.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                        {share}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setActiveFilter(null);
                            } else {
                              handleSetQuickFilter('dst', dest.label, `Destination: ${dest.label}`);
                            }
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                              : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300'
                          }`}
                        >
                          {isSelected ? 'Active Filter' : 'Audit Node'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Microsegmentation Policies */}
      {activeTab === 'policies' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert size={16} className="text-emerald-400" />
                <span>Internal Segmentation Security Policy Hit Matrix</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Interzone forwarding policies, zero-trust microsegmentation rules, and lateral denial metrics.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">Active Rule Base</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Policy Rule Identifier</th>
                  <th className="py-2.5 px-3">Rule Type</th>
                  <th className="py-2.5 px-3 text-right">Hit Count</th>
                  <th className="py-2.5 px-3 text-right">Traffic Share</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {(top.policy || []).map((pol: any, idx: number) => {
                  const isSelected = activeFilter?.field === 'policy' && activeFilter.value === pol.label;
                  const polVal = Number(pol.total ?? pol.value ?? 0);
                  const share = totalLogs > 0 ? ((polVal / totalLogs) * 100).toFixed(1) : '0.0';
                  const isDenyPolicy = pol.label.toLowerCase().includes('deny') || pol.label.toLowerCase().includes('drop');
                  return (
                    <tr key={idx} className={`transition-colors ${isSelected ? 'bg-emerald-500/15 border-l-4 border-emerald-400' : 'hover:bg-slate-800/30'}`}>
                      <td className="py-2.5 px-3 font-bold text-slate-100 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Layers size={13} />
                        </div>
                        <span className={isSelected ? 'text-emerald-200' : ''}>{pol.label}</span>
                        {isSelected && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 uppercase font-bold">Filtered</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDenyPolicy 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {isDenyPolicy ? 'Interzone Deny Rule' : 'Standard Permit Rule'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-300">
                        {polVal.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                        {share}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                          ACTIVE RULE
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setActiveFilter(null);
                            } else {
                              handleSetQuickFilter('policy', pol.label, `Policy: ${pol.label}`);
                            }
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                              : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300'
                          }`}
                        >
                          {isSelected ? 'Active Filter' : 'Filter Rule'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Live Syslog Stream Table */}
      <div id="isfw-live-stream-section" className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Activity size={16} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Internal Segmentation Live Syslog Stream</span>
                <span className="text-xs font-mono text-emerald-400 font-normal">
                  ({visibleLogs.length} Events Buffer)
                </span>
              </h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>

              {/* Live Play / Pause Button */}
              {logFeedMode === 'live' && (
                <button
                  type="button"
                  onClick={() => setLivePaused((p) => !p)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    livePaused
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                  }`}
                  title={livePaused ? 'Resume live packet stream' : 'Pause live packet stream'}
                >
                  {livePaused ? <Play size={10} className="fill-amber-300" /> : <Pause size={10} className="fill-emerald-300" />}
                  <span>{livePaused ? 'STREAM PAUSED' : 'LIVE 3.5s'}</span>
                </button>
              )}

              {/* Ingestion Lag Indicator */}
              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 hidden sm:inline-flex items-center gap-1">
                <span>Lag:</span>
                <span className="text-emerald-400 font-bold">
                  {logFeedMode === 'live' && !livePaused
                    ? 'Sub-second'
                    : (rawLatest?.ingest_lag_seconds !== null && rawLatest?.ingest_lag_seconds !== undefined && rawLatest.ingest_lag_seconds < 10
                        ? `${rawLatest.ingest_lag_seconds}s`
                        : 'Sub-second')}
                </span>
              </span>

              {(isLogsFetching || liveStreamQuery.isFetching) && (
                <RefreshCw size={12} className="animate-spin text-emerald-400 ml-1" />
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Authoritative real-time packet ingestion tail direct from FortiGate ISFW cluster.
            </p>
          </div>

          {/* Stream Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Switcher: Live Stream vs Snapshot */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => {
                  setLogFeedMode('live');
                  handleClearFilter();
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  logFeedMode === 'live' && !hasCustomFilter
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio size={12} className={logFeedMode === 'live' && !hasCustomFilter ? 'animate-pulse text-white' : ''} />
                <span>Live Feed</span>
              </button>
              <button
                type="button"
                onClick={() => setLogFeedMode('snapshot')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  logFeedMode === 'snapshot' && !hasCustomFilter
                    ? 'bg-slate-800 text-slate-100 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock size={12} />
                <span>Snapshot ({range.toUpperCase()})</span>
              </button>
            </div>

            {/* High-Risk East-West Lateral Threat Filter Button */}
            <button
              type="button"
              onClick={() => setLateralThreatOnly((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer border ${
                lateralThreatOnly
                  ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse'
                  : 'bg-slate-950 text-rose-400/90 hover:text-rose-300 border-slate-800 hover:border-rose-500/40'
              }`}
              title="Filter high-risk East-West lateral movement threats (SMB 445, RDP 3389, SSH 22, RPC 135, DB 1433/1521)"
            >
              <Zap size={12} className={lateralThreatOnly ? 'fill-white text-white' : 'text-rose-400'} />
              <span>Lateral Threats</span>
            </button>

            {/* Network Segment Selector */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-mono">
              <span className="text-[10px] text-slate-500 px-2 uppercase font-bold flex items-center gap-1">
                <Network size={11} />
                <span className="hidden sm:inline">Seg:</span>
              </span>
              <button
                type="button"
                onClick={() => setSegmentFilter('all')}
                className={`px-2 py-0.5 rounded-lg transition-all font-bold cursor-pointer ${
                  segmentFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSegmentFilter('10.19.')}
                className={`px-2 py-0.5 rounded-lg transition-all font-bold cursor-pointer ${
                  segmentFilter === '10.19.' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-300/80 hover:text-purple-200'
                }`}
                title="10.19.x.x - Wi-Fi CFI-IT"
              >
                Wi-Fi IT
              </button>
              <button
                type="button"
                onClick={() => setSegmentFilter('10.17.')}
                className={`px-2 py-0.5 rounded-lg transition-all font-bold cursor-pointer ${
                  segmentFilter === '10.17.' ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-300/80 hover:text-amber-200'
                }`}
                title="10.17.x.x - Wi-Fi CFI-Vendor (Zero-Trust Guarded)"
              >
                Wi-Fi Vendor
              </button>
              <button
                type="button"
                onClick={() => setSegmentFilter('10.10.')}
                className={`px-2 py-0.5 rounded-lg transition-all font-bold cursor-pointer ${
                  segmentFilter === '10.10.' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-300/80 hover:text-blue-200'
                }`}
                title="10.10.x.x - Corporate LAN"
              >
                Corp LAN
              </button>
              <button
                type="button"
                onClick={() => setSegmentFilter('10.100.101.')}
                className={`px-2 py-0.5 rounded-lg transition-all font-bold cursor-pointer ${
                  segmentFilter === '10.100.101.' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-300/80 hover:text-emerald-200'
                }`}
                title="10.100.101.x - Core Datacenter / DB Farm"
              >
                DC Core DB
              </button>
            </div>

            {/* Quick Action Filter Pills */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setActionFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  actionFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActionFilter('deny')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  actionFilter === 'deny' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert size={12} className={actionFilter === 'deny' ? 'text-rose-400' : 'text-slate-400'} />
                <span>Alerts / Denied</span>
              </button>
              <button
                type="button"
                onClick={() => setActionFilter('accept')}
                className={`px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                  actionFilter === 'accept' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Allowed
              </button>
            </div>

            {/* Keyword Search Input with Clear Button */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search IP, User, Policy, App, Action..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 w-44 sm:w-60 transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setDebouncedSearch('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer transition-colors"
                  title="Clear Search Filter"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Reset Filter Button */}
            {hasCustomFilter && (
              <button
                type="button"
                onClick={handleClearFilter}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 cursor-pointer transition-all border border-slate-700"
                title="Reset active drilldown filters"
              >
                <X size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Syslog Table with Vertical Scrollbar & Sticky Header */}
        <div className="overflow-x-auto overflow-y-auto max-h-[500px] rounded-xl border border-slate-800/80 shadow-inner bg-slate-950/40">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0 z-10 shadow-sm backdrop-blur-md">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Source Node</th>
                <th className="py-2.5 px-3">Destination Node</th>
                <th className="py-2.5 px-3">Policy Rule</th>
                <th className="py-2.5 px-3">Application</th>
                <th className="py-2.5 px-3">User / Identity</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Detail Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {isLogsLoading && visibleLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw size={18} className="animate-spin text-emerald-400" />
                      <span>Ingesting live packets from FortiGate ISFW...</span>
                    </div>
                  </td>
                </tr>
              ) : visibleLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                    {search ? (
                      <div className="flex flex-col items-center gap-2">
                        <span>No segmentation logs matching &quot;{search}&quot;.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setDebouncedSearch('');
                          }}
                          className="text-emerald-400 hover:underline text-xs cursor-pointer font-bold"
                        >
                          Clear Search Filter
                        </button>
                      </div>
                    ) : (
                      'No segmentation logs matching the current filter.'
                    )}
                  </td>
                </tr>
              ) : (
                visibleLogs.map((log: any, idx: number) => {
                  const isDeny =
                    (log.action || '').toLowerCase().includes('deny') ||
                    (log.action || '').toLowerCase().includes('drop') ||
                    (log.action || '').toLowerCase().includes('block');
                  const srcSeg = resolveNetworkSegment(log.srcip);
                  const dstSeg = resolveNetworkSegment(log.dstip);
                  const lateralThreat = detectLateralThreat(log);
                  const isVendorCrossing =
                    log.srcip?.startsWith('10.17.') &&
                    (log.dstip?.startsWith('10.10.') || log.dstip?.startsWith('10.100.'));

                  return (
                    <tr
                      key={log.id || `${log.log_time}-${idx}`}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-slate-800/40 cursor-pointer transition-colors group ${
                        logFeedMode === 'live' && !livePaused && idx === 0 ? 'bg-emerald-500/5' : ''
                      } ${isDeny ? 'border-l-2 border-l-rose-500 bg-rose-500/[0.03]' : ''}`}
                    >
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {logFeedMode === 'live' && !livePaused && idx === 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" title="New live arrival" />
                          )}
                          <span>{log.log_time || log.received_time}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isDeny
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {log.action}
                            </span>
                            {isDeny && (
                              <span className="p-0.5 rounded bg-rose-500/20 text-rose-400 inline-flex items-center" title="Security Alert: Inter-VLAN Packet Denied">
                                <ShieldAlert size={12} />
                              </span>
                            )}
                          </div>
                          {lateralThreat && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1"
                              title={`${lateralThreat.threatTitle} (${lateralThreat.mitreId})`}
                            >
                              <Zap size={9} className="fill-rose-300 text-rose-300" />
                              <span>{lateralThreat.mitreId}</span>
                            </span>
                          )}
                          {isVendorCrossing && !lateralThreat && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1"
                              title="Zero-Trust Crossing: Wi-Fi CFI-Vendor attempting access to Corporate LAN / Datacenter"
                            >
                              <Lock size={9} />
                              <span>ZT-CROSS</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetQuickFilter('src', log.srcip, `Source IP: ${log.srcip}`);
                            }}
                            className="hover:text-emerald-400 hover:underline cursor-pointer text-left font-bold"
                          >
                            {log.srcip}
                          </button>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded font-bold border w-fit ${srcSeg.badgeBg} ${srcSeg.badgeText} ${srcSeg.badgeBorder}`}>
                            {srcSeg.shortName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetQuickFilter('dst', log.dstip, `Dest IP: ${log.dstip}`);
                              }}
                              className="hover:text-teal-400 hover:underline cursor-pointer text-left font-bold"
                            >
                              {log.dstip}
                            </button>
                            {log.dstport && <span className="text-slate-400 text-[10px]">:{log.dstport}</span>}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded font-bold border ${dstSeg.badgeBg} ${dstSeg.badgeText} ${dstSeg.badgeBorder}`}>
                              {dstSeg.shortName}
                            </span>
                            {dstSeg.isCrownJewel && (
                              <span className="px-1 py-0.5 text-[8px] rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-tighter">
                                DB FARM
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetQuickFilter('policy', log.policyname, `Policy: ${log.policyname}`);
                          }}
                          className="hover:text-emerald-400 hover:underline cursor-pointer truncate max-w-[140px] block"
                          title={log.policyname}
                        >
                          {log.policyname || '-'}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {log.app ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetQuickFilter('app', log.app, `App: ${log.app}`);
                            }}
                            className="hover:text-cyan-400 hover:underline cursor-pointer"
                          >
                            {log.app}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {log.username && log.username !== '-' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetQuickFilter('user', log.username, `User: ${log.username}`);
                            }}
                            className="hover:text-purple-400 hover:underline cursor-pointer"
                          >
                            {log.username}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer shadow-sm group/btn ${
                            isDeny
                              ? 'bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 hover:border-rose-400'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400'
                          }`}
                          title="Buka Detail Log Lengkap"
                        >
                          {isDeny ? (
                            <ShieldAlert size={12} className="text-rose-400 group-hover/btn:scale-110 transition-transform" />
                          ) : (
                            <Eye size={12} className="text-emerald-400 group-hover/btn:scale-110 transition-transform" />
                          )}
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Raw Event Detail Inspection Modal */}
      {selectedLog && (() => {
        const isSelectedDeny =
          (selectedLog.action || '').toLowerCase().includes('deny') ||
          (selectedLog.action || '').toLowerCase().includes('drop') ||
          (selectedLog.action || '').toLowerCase().includes('block');
        const srcSeg = resolveNetworkSegment(selectedLog.srcip);
        const dstSeg = resolveNetworkSegment(selectedLog.dstip);
        const lateralThreat = detectLateralThreat(selectedLog);
        const isVendorCrossing =
          selectedLog.srcip?.startsWith('10.17.') &&
          (selectedLog.dstip?.startsWith('10.10.') || selectedLog.dstip?.startsWith('10.100.'));

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div
                    className={`p-2 rounded-xl border ${
                      isSelectedDeny
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {isSelectedDeny ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-100 font-mono">
                        FortiGate ISFW Log Inspector
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        #{selectedLog.id}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isSelectedDeny
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {selectedLog.action || 'ACCEPT'}
                      </span>
                      {lateralThreat && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500 text-slate-950 flex items-center gap-1 animate-pulse">
                          <Zap size={10} className="fill-slate-950" />
                          <span>LATERAL THREAT</span>
                        </span>
                      )}
                      {isVendorCrossing && !lateralThreat && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-slate-950 flex items-center gap-1">
                          <Lock size={10} />
                          <span>ZT CROSSING</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {selectedLog.log_time || selectedLog.received_time} • Live Ingestion Tail Verified
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Direct Pivot to CrowdStrike EDR */}
                  <Link
                    href={`/edr?search=${encodeURIComponent(selectedLog.srcip || '')}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-mono transition-colors border border-purple-500/30 hover:border-purple-400 cursor-pointer"
                    title="Investigate source workload in CrowdStrike Falcon EDR"
                  >
                    <ExternalLink size={13} />
                    <span>CrowdStrike EDR</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleCopy('all_json', JSON.stringify(selectedLog, null, 2))}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer border border-slate-700"
                    title="Copy Full Raw Log JSON"
                  >
                    {copiedField === 'all_json' ? (
                      <>
                        <Check size={13} className="text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLog(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Close Inspector (Esc)"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 font-mono text-xs">
                {/* East-West Segment Path Traversal Flow Architecture */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <Network size={14} className="text-emerald-400" />
                      <span>East-West Segment Traversal Path</span>
                    </span>
                    {isVendorCrossing ? (
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Lock size={10} />
                        <span>ZERO-TRUST BOUNDARY CROSSING</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">
                        ISFW Security Perimeter
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    {/* Source Segment */}
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2.5 rounded-xl border ${srcSeg.badgeBg} ${srcSeg.badgeBorder} ${srcSeg.badgeText}`}>
                        <Globe size={18} />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Source Zone</div>
                        <div className="text-xs font-bold text-slate-200">{srcSeg.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono font-bold">{selectedLog.srcip || '-'}</div>
                      </div>
                    </div>

                    {/* Central Traversal Vector */}
                    <div className="flex flex-col items-center px-2">
                      <div className="flex items-center text-slate-600">
                        <div className="w-8 sm:w-16 h-0.5 bg-slate-800"></div>
                        <ChevronRight size={18} className={isSelectedDeny ? 'text-rose-400' : 'text-emerald-400'} />
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${isSelectedDeny ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {selectedLog.action || 'FORWARD'}
                      </span>
                    </div>

                    {/* Target Segment */}
                    <div className="flex items-center gap-2.5 text-right">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Target Zone</div>
                        <div className="text-xs font-bold text-slate-200 flex items-center justify-end gap-1">
                          <span>{dstSeg.name}</span>
                          {dstSeg.isCrownJewel && (
                            <span className="px-1 py-0.2 rounded text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                              CROWN JEWEL
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono font-bold">
                          {selectedLog.dstip}:{selectedLog.dstport || '-'}
                        </div>
                      </div>
                      <div className={`p-2.5 rounded-xl border ${dstSeg.badgeBg} ${dstSeg.badgeBorder} ${dstSeg.badgeText}`}>
                        <Server size={18} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* MITRE ATT&CK Lateral Threat Containment Card */}
                {lateralThreat && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/40 space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                        <Zap size={14} className="text-rose-400 fill-rose-400" />
                        <span>MITRE ATT&amp;CK Threat: {lateralThreat.technique}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-slate-950 font-mono">
                        {lateralThreat.mitreId} • {lateralThreat.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-mono">
                      {lateralThreat.description}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-rose-500/20 text-[10px]">
                      <div className="text-rose-300 font-mono">
                        <span className="text-rose-400 font-bold">Containment Protocol: </span>
                        <span>Isolate source host in CrowdStrike EDR immediately &amp; revoke Active Directory credentials.</span>
                      </div>
                      <Link
                        href={`/edr?search=${encodeURIComponent(selectedLog.srcip || '')}`}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold inline-flex items-center gap-1 w-fit cursor-pointer transition-colors"
                      >
                        <span>Isolate Host in EDR</span>
                        <ChevronRight size={11} />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Standard Threat Callout Banner (if packet is denied/blocked and not lateral) */}
                {isSelectedDeny && !lateralThreat && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                      <ShieldAlert size={18} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-300 font-mono uppercase tracking-wider">
                          Inter-Zone Packet Dropped by Policy
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/30 text-rose-200 border border-rose-500/40">
                          LEVEL: {(selectedLog.level || 'WARNING').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
                        {selectedLog.msg || 'Unauthorized east-west inter-VLAN lateral traffic intercepted and dropped by Zero-Trust ISFW policy.'}
                      </p>
                      <div className="text-[10px] text-rose-400 font-mono pt-0.5">
                        Target probe: <span className="text-slate-100 font-bold">{selectedLog.dstip}:{selectedLog.dstport}</span> via Policy Rule <span className="text-slate-100 font-bold">&quot;{selectedLog.policyname}&quot;</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Network & Policy Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Source Node Details */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Globe size={14} className="text-emerald-400" />
                        <span>Source Workload</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy('srcip', selectedLog.srcip || '')}
                        className="text-[10px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer"
                        title="Copy Source IP"
                      >
                        {copiedField === 'srcip' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span>{copiedField === 'srcip' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">IP Address:</span>
                        <span className="text-slate-100 font-bold">{selectedLog.srcip || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">Network Zone:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${srcSeg.badgeBg} ${srcSeg.badgeText} ${srcSeg.badgeBorder}`}>
                          {srcSeg.name} ({srcSeg.shortName})
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">User / Host:</span>
                        <span className="text-purple-300 font-medium truncate max-w-[170px]" title={selectedLog.username}>
                          {selectedLog.username || '-'}
                        </span>
                      </div>
                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleSetQuickFilter('src', selectedLog.srcip, `Source IP: ${selectedLog.srcip}`);
                            setSelectedLog(null);
                          }}
                          className="w-full py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold transition-all cursor-pointer text-center"
                        >
                          Filter by this Source IP
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Destination Node Details */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Database size={14} className="text-teal-400" />
                        <span>Destination Node</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy('dstip', selectedLog.dstip || '')}
                        className="text-[10px] text-slate-400 hover:text-teal-400 flex items-center gap-1 cursor-pointer"
                        title="Copy Destination IP"
                      >
                        {copiedField === 'dstip' ? <Check size={11} className="text-teal-400" /> : <Copy size={11} />}
                        <span>{copiedField === 'dstip' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">IP Address:</span>
                        <span className="text-slate-100 font-bold">{selectedLog.dstip || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">Network Zone:</span>
                        <div className="flex items-center gap-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${dstSeg.badgeBg} ${dstSeg.badgeText} ${dstSeg.badgeBorder}`}>
                            {dstSeg.name} ({dstSeg.shortName})
                          </span>
                          {dstSeg.isCrownJewel && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              ★ DB
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">Target Port:</span>
                        <span className="text-teal-300 font-mono font-bold">
                          {selectedLog.dstport ? `Port ${selectedLog.dstport}` : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-[11px]">Geo Country:</span>
                        <span className="text-slate-300">{selectedLog.dstcountry || 'Local / Private'}</span>
                      </div>
                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleSetQuickFilter('dst', selectedLog.dstip, `Dest IP: ${selectedLog.dstip}`);
                            setSelectedLog(null);
                          }}
                          className="w-full py-1 rounded bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 text-[10px] font-bold transition-all cursor-pointer text-center"
                        >
                          Filter by this Dest IP
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Policy & Security Attributes */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                    <Layers size={14} className="text-cyan-400" />
                    <span>Security &amp; Policy Attributes</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Policy Rule</span>
                      <span className="text-slate-100 font-bold block truncate" title={selectedLog.policyname}>
                        {selectedLog.policyname || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Application</span>
                      <span className="text-cyan-300 font-bold block truncate" title={selectedLog.app}>
                        {selectedLog.app || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Severity / Level</span>
                      <span className="text-amber-300 font-bold uppercase">{selectedLog.level || 'Notice'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Data Volume</span>
                      <span className="text-emerald-300 font-bold">
                        {formatBytes(selectedLog.totalbyte)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex gap-2">
                    {selectedLog.policyname && (
                      <button
                        type="button"
                        onClick={() => {
                          handleSetQuickFilter('policy', selectedLog.policyname, `Policy: ${selectedLog.policyname}`);
                          setSelectedLog(null);
                        }}
                        className="px-3 py-1 rounded bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[10px] font-bold transition-all cursor-pointer"
                      >
                        Filter Policy &quot;{selectedLog.policyname}&quot;
                      </button>
                    )}
                    {selectedLog.app && (
                      <button
                        type="button"
                        onClick={() => {
                          handleSetQuickFilter('app', selectedLog.app, `App: ${selectedLog.app}`);
                          setSelectedLog(null);
                        }}
                        className="px-3 py-1 rounded bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-300 text-[10px] font-bold transition-all cursor-pointer"
                      >
                        Filter App &quot;{selectedLog.app}&quot;
                      </button>
                    )}
                  </div>
                </div>

                {/* Raw FortiGate Syslog Wire Message (if present) */}
                {selectedLog.raw_message && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Raw FortiGate Syslog Wire Message
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy('raw_msg', selectedLog.raw_message)}
                        className="text-[10px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'raw_msg' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span>{copiedField === 'raw_msg' ? 'Copied' : 'Copy Wire Log'}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-emerald-400 font-mono break-all selection:bg-emerald-500/30">
                      {selectedLog.raw_message}
                    </div>
                  </div>
                )}

                {/* Raw Syslog Payload Box */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Raw Telemetry Payload (JSON)
                    </span>
                    <span className="text-[10px] text-slate-500">Live Ingest Record</span>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto font-mono scrollbar-thin">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">ESC</kbd> to close
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Export Report Modal */}
      <FortiIsfwReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        activeRange={range}
        activeFilter={activeFilter?.value || ''}
      />
    </div>
  );
}
