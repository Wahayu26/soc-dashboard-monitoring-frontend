'use client';

import { useState, useMemo } from 'react';
import { 
  Globe, 
  ShieldAlert, 
  MapPin, 
  Zap, 
  RotateCcw, 
  Layers, 
  Crosshair, 
  Radio, 
  Info,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

export interface GeoPoint {
  source_ip?: string;
  ip?: string;
  country?: string;
  lat: number;
  lng: number;
  value?: number;
  hits?: number;
  action?: string;
  application_name?: string;
  rule_name?: string;
  filter?: string;
  is_vpn?: boolean;
  ip_type?: 'vpn_pool' | 'internal_lan' | 'external_wan' | string;
}

interface ThreatGeoMapProps {
  geoPoints: GeoPoint[];
  vpnSegmentStats?: {
    isolated_vpn_drops?: number;
    isolated_subnets?: string[];
    non_vpn_suspicious_hits?: number;
  };
  onSelectFilter?: (filter: string) => void;
  activeFilter?: string;
}

// Equirectangular projection convert Lat/Lng to SVG 1000x500 coordinates
function projectLatLng(lat: number, lng: number, width = 1000, height = 500) {
  // Clamp boundaries
  const clampedLat = Math.max(-85, Math.min(85, lat));
  const clampedLng = Math.max(-180, Math.min(180, lng));

  const x = ((clampedLng + 180) / 360) * width;
  const y = ((90 - clampedLat) / 180) * height;
  return { x, y };
}

// Enterprise DC / HQ target in Jakarta
const HQ_COORDS = { lat: -6.2088, lng: 106.8456 };
const HQ_PROJ = projectLatLng(HQ_COORDS.lat, HQ_COORDS.lng);

export function ThreatGeoMap({ geoPoints, vpnSegmentStats, onSelectFilter, activeFilter }: ThreatGeoMapProps) {
  const [hoveredPoint, setHoveredPoint] = useState<GeoPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [actionFilter, setActionFilter] = useState<'all' | 'drop' | 'threat' | 'allow'>('all');
  const [excludeVpnPools, setExcludeVpnPools] = useState<boolean>(true);

  // Filter out authorized GlobalProtect VPN subnets (10.20.40.* & 10.20.30.*) when in perimeter threat focus mode
  const visiblePoints = useMemo(() => {
    if (!geoPoints || !Array.isArray(geoPoints)) return [];
    return geoPoints.filter((p) => {
      const ip = (p.source_ip || p.ip || '').trim();
      const isVpn = p.is_vpn || p.ip_type === 'vpn_pool' || ip.startsWith('10.20.40.') || ip.startsWith('10.20.30.');
      if (excludeVpnPools && isVpn) {
        return false;
      }
      return true;
    });
  }, [geoPoints, excludeVpnPools]);

  // Filter geo points based on selected action
  const filteredPoints = useMemo(() => {
    return visiblePoints.filter((p) => {
      if (actionFilter === 'all') return true;
      const act = (p.action || '').toLowerCase();
      if (actionFilter === 'drop') return act === 'drop' || act === 'deny' || act === 'reset';
      if (actionFilter === 'threat') return act === 'threat';
      if (actionFilter === 'allow') return act === 'allow';
      return true;
    });
  }, [visiblePoints, actionFilter]);

  // Aggregate top countries from visible points
  const topCountries = useMemo(() => {
    const counts: Record<string, number> = {};
    visiblePoints.forEach((p) => {
      const c = p.country || 'Unknown';
      counts[c] = (counts[c] || 0) + (p.hits || p.value || 1);
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [visiblePoints]);

  const totalHits = useMemo(() => {
    return filteredPoints.reduce((acc, p) => acc + (p.hits || p.value || 1), 0);
  }, [filteredPoints]);

  return (
    <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden backdrop-blur-md">
      {/* Background glowing cyber radial gradient */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-rose-500/5 blur-[120px] pointer-events-none" />

      {/* Header toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
            <Globe size={22} className="animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Interactive World Threat &amp; Geo Access Map
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1 animate-pulse">
                <Radio size={10} />
                <span>LIVE TELEMETRY</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Geographic origin telemetry of perimeter NGFW threat packets &amp; connections.
            </p>
          </div>
        </div>

        {/* Action filter pill & Zoom controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* VPN Segment Focus Toggle */}
          <button
            type="button"
            onClick={() => setExcludeVpnPools((v) => !v)}
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              excludeVpnPools
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={
              excludeVpnPools
                ? 'Focusing on perimeter/WAN threats and suspicious non-VPN hosts (excluding 10.20.40.* & 10.20.30.*)'
                : 'Showing all vectors including internal VPN client pools'
            }
          >
            <ShieldAlert size={12} className={excludeVpnPools ? 'text-cyan-400' : 'text-slate-500'} />
            <span>{excludeVpnPools ? 'Perimeter Threats (Excl. VPN Pools)' : 'All Vectors (Incl. VPN)'}</span>
            {excludeVpnPools && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </button>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-mono">
            {(['all', 'drop', 'threat', 'allow'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setActionFilter(mode)}
                className={`px-2.5 py-1 rounded-lg transition-all capitalize font-bold cursor-pointer ${
                  actionFilter === mode
                    ? mode === 'drop'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : mode === 'threat'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : mode === 'allow'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'all' ? 'All Vectors' : mode}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-slate-400">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
              className="p-1.5 hover:text-cyan-300 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.25))}
              className="p-1.5 hover:text-cyan-300 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            {zoomLevel !== 1 && (
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="p-1.5 hover:text-amber-300 transition-colors cursor-pointer"
                title="Reset Zoom"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div className="relative rounded-2xl bg-slate-950 border border-slate-800/80 overflow-hidden shadow-inner aspect-[2/1] min-h-[360px] max-h-[520px]">
        {/* SVG World Map */}
        <div 
          className="w-full h-full transition-transform duration-300 ease-out origin-center"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <svg
            viewBox="0 0 1000 500"
            className="w-full h-full select-none"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Radial glow for DC HQ */}
              <radialGradient id="hqGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
                <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
              </radialGradient>

              {/* Red Attack Arc Gradient */}
              <linearGradient id="attackGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                <stop offset="70%" stopColor="#fb7185" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.8" />
              </linearGradient>

              {/* Amber Threat Arc Gradient */}
              <linearGradient id="threatGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                <stop offset="80%" stopColor="#fbbf24" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.8" />
              </linearGradient>

              {/* Cyan Allow Gradient */}
              <linearGradient id="allowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
              </linearGradient>

              {/* Subtle Grid Pattern */}
              <pattern id="cyberGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.6" />
              </pattern>
            </defs>

            {/* Background Cyber Grid */}
            <rect width="1000" height="500" fill="url(#cyberGrid)" />

            {/* Latitude / Longitude Equator & Prime Meridian Guide Lines */}
            <line x1="0" y1="250" x2="1000" y2="250" stroke="#334155" strokeWidth="0.8" strokeDasharray="3 3" strokeOpacity="0.4" />
            <line x1="500" y1="0" x2="500" y2="500" stroke="#334155" strokeWidth="0.8" strokeDasharray="3 3" strokeOpacity="0.4" />

            {/* SVG Continents Outline (Sleek stylized geometric vector world landmass) */}
            <g fill="#0f172a" stroke="#1e293b" strokeWidth="1" strokeLinejoin="round" opacity="0.85">
              {/* North America */}
              <path d="M 120 70 L 260 70 L 280 130 L 250 170 L 220 180 L 190 230 L 160 210 L 140 160 L 100 130 Z" />
              {/* South America */}
              <path d="M 230 250 L 310 270 L 330 350 L 290 440 L 260 440 L 240 330 Z" />
              {/* Europe */}
              <path d="M 460 70 L 560 70 L 580 130 L 540 170 L 480 170 L 450 120 Z" />
              {/* Africa */}
              <path d="M 460 180 L 570 180 L 600 270 L 560 380 L 510 380 L 470 270 Z" />
              {/* Asia & Russia */}
              <path d="M 560 50 L 890 50 L 880 180 L 800 230 L 730 210 L 670 250 L 600 200 L 570 120 Z" />
              {/* Australia */}
              <path d="M 780 320 L 880 320 L 890 390 L 820 410 L 770 370 Z" />
              {/* Indonesia & SE Asia (Highlighted Archipelago) */}
              <g fill="#1e293b" stroke="#06b6d4" strokeWidth="1" opacity="0.9">
                <path d="M 700 250 L 750 250 L 740 280 L 690 270 Z" />
                <path d="M 750 260 L 810 265 L 790 290 L 740 280 Z" />
                <path d="M 720 285 L 780 290 L 770 305 L 710 300 Z" fill="#0891b2" />
              </g>
            </g>

            {/* HQ / Enterprise Data Center Destination Beacon (Jakarta) */}
            <g className="cursor-pointer" transform={`translate(${HQ_PROJ.x}, ${HQ_PROJ.y})`}>
              {/* Pulsing outer rings */}
              <circle r="22" fill="none" stroke="#22d3ee" strokeWidth="1" strokeOpacity="0.3" className="animate-ping" style={{ animationDuration: '3s' }} />
              <circle r="14" fill="url(#hqGlow)" />
              <circle r="5" fill="#22d3ee" stroke="#0f172a" strokeWidth="1.5" />
              {/* HQ Marker Label */}
              <text
                x="8"
                y="-8"
                fill="#22d3ee"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
              >
                DC JAKARTA (HQ)
              </text>
            </g>

            {/* Attack Trajectory Arcs from Remote Attackers to HQ */}
            <g>
              {filteredPoints.slice(0, 35).map((point, idx) => {
                const { x, y } = projectLatLng(point.lat, point.lng);
                // Only draw arcs for points outside the immediate local vicinity
                const dist = Math.hypot(x - HQ_PROJ.x, y - HQ_PROJ.y);
                if (dist < 40) return null;

                // Bezier quadratic control point lifted upwards
                const midX = (x + HQ_PROJ.x) / 2;
                const midY = Math.min(y, HQ_PROJ.y) - Math.min(60, dist * 0.25);
                const isThreat = (point.action || '').toLowerCase() === 'threat';
                const isAllow = (point.action || '').toLowerCase() === 'allow';
                const grad = isAllow ? 'url(#allowGradient)' : isThreat ? 'url(#threatGradient)' : 'url(#attackGradient)';

                return (
                  <path
                    key={`arc-${idx}`}
                    d={`M ${x} ${y} Q ${midX} ${midY} ${HQ_PROJ.x} ${HQ_PROJ.y}`}
                    fill="none"
                    stroke={grad}
                    strokeWidth={isThreat ? 1.5 : 1}
                    strokeDasharray="4 3"
                    strokeOpacity={hoveredPoint?.source_ip === point.source_ip ? 0.9 : 0.35}
                    className="transition-all"
                  />
                );
              })}
            </g>

            {/* Threat Origin Points (Pulsing Radar Markers) */}
            <g>
              {filteredPoints.map((point, idx) => {
                const { x, y } = projectLatLng(point.lat, point.lng);
                const hits = point.hits || point.value || 1;
                const radius = Math.min(10, Math.max(3.5, Math.log10(hits + 1) * 3));
                const action = (point.action || '').toLowerCase();
                const isDrop = action === 'drop' || action === 'deny' || action === 'reset';
                const isThreat = action === 'threat';
                const color = isThreat ? '#f59e0b' : isDrop ? '#f43f5e' : '#10b981';
                const isHovered = hoveredPoint?.source_ip === (point.source_ip || point.ip);

                return (
                  <g
                    key={`point-${idx}`}
                    transform={`translate(${x}, ${y})`}
                    className="cursor-pointer group"
                    onMouseEnter={(e) => {
                      setHoveredPoint(point);
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipPos({ x: rect.left, y: rect.top });
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => {
                      if (onSelectFilter && point.filter) {
                        onSelectFilter(point.filter);
                      } else if (onSelectFilter && (point.source_ip || point.ip)) {
                        onSelectFilter(`source_ip:${point.source_ip || point.ip}`);
                      }
                    }}
                  >
                    {/* Pulsing ring for high-volume attackers */}
                    {hits > 100 && (
                      <circle
                        r={radius * 2}
                        fill="none"
                        stroke={color}
                        strokeWidth="1"
                        strokeOpacity="0.4"
                        className="animate-ping"
                        style={{ animationDuration: '2.5s' }}
                      />
                    )}

                    <circle
                      r={isHovered ? radius + 3 : radius}
                      fill={color}
                      fillOpacity={isHovered ? 1 : 0.8}
                      stroke="#0f172a"
                      strokeWidth={1.5}
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute bottom-4 left-4 z-20 p-3.5 rounded-xl bg-slate-900/95 border border-cyan-500/40 shadow-2xl backdrop-blur-md max-w-xs animate-in fade-in zoom-in-95 duration-150 text-xs space-y-1.5 font-mono">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
              <span className="text-cyan-300 font-bold truncate">
                {hoveredPoint.source_ip || hoveredPoint.ip || 'Unknown IP'}
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                hoveredPoint.action === 'allow'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : hoveredPoint.action === 'threat'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {hoveredPoint.action || 'DROP'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
              <span className="text-slate-500">Country / Origin:</span>
              <span className="font-semibold text-slate-200">{hoveredPoint.country || 'Unknown'}</span>

              <span className="text-slate-500">Classification:</span>
              <span className={`font-semibold ${
                hoveredPoint.is_vpn || hoveredPoint.ip_type === 'vpn_pool'
                  ? 'text-blue-300'
                  : hoveredPoint.ip_type === 'internal_lan' || (hoveredPoint.country || '').includes('Internal')
                  ? 'text-purple-300'
                  : 'text-rose-400'
              }`}>
                {hoveredPoint.is_vpn || hoveredPoint.ip_type === 'vpn_pool'
                  ? 'VPN Client (10.20.30/40.x)'
                  : hoveredPoint.ip_type === 'internal_lan' || (hoveredPoint.country || '').includes('Internal')
                  ? 'Internal Core Host'
                  : 'Perimeter Threat IP'}
              </span>

              <span className="text-slate-500">Hits / Packets:</span>
              <span className="font-bold text-amber-300">
                {(hoveredPoint.hits || hoveredPoint.value || 1).toLocaleString()}
              </span>

              {hoveredPoint.application_name && (
                <>
                  <span className="text-slate-500">Application:</span>
                  <span className="truncate text-cyan-300">{hoveredPoint.application_name}</span>
                </>
              )}

              {hoveredPoint.rule_name && (
                <>
                  <span className="text-slate-500">Security Rule:</span>
                  <span className="truncate text-slate-200">{hoveredPoint.rule_name}</span>
                </>
              )}
            </div>

            <p className="text-[10px] text-cyan-400/80 font-sans pt-1 border-t border-slate-800/80 flex items-center gap-1">
              <span>👉</span> Click point to filter log investigation for this IP
            </p>
          </div>
        )}

        {/* Live Attack Density HUD Overlay on top right */}
        <div className="absolute top-3 right-3 z-10 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/90 backdrop-blur-md text-[11px] font-mono space-y-1 shadow-lg">
          <div className="flex items-center justify-between gap-3 text-slate-400">
            <span>Threat Points:</span>
            <span className="font-bold text-cyan-300">{filteredPoints.length}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-400">
            <span>Filtered Hits:</span>
            <span className="font-bold text-rose-400">{totalHits.toLocaleString()}</span>
          </div>
          {excludeVpnPools && (vpnSegmentStats?.isolated_vpn_drops ?? 0) > 0 && (
            <div className="flex items-center justify-between gap-3 text-slate-500 text-[10px] pt-1 border-t border-slate-800/80">
              <span className="text-cyan-400/90">VPN Drops Isolated:</span>
              <span className="text-cyan-300 font-bold">{(vpnSegmentStats?.isolated_vpn_drops || 0).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Country Distribution Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-500 font-mono text-[11px] uppercase tracking-wider font-bold">
            Top Attacking Origins:
          </span>
          {topCountries.map(([country, count], idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectFilter && onSelectFilter(`country:${country}`)}
              className="px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 font-mono text-[11px] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <MapPin size={10} className="text-rose-400" />
              <span>{country}</span>
              <span className="text-slate-500 text-[10px]">({count.toLocaleString()})</span>
            </button>
          ))}
        </div>

        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 shrink-0">
          <Info size={12} className="text-slate-400" />
          <span>Coordinates extracted from IP intelligence feed &amp; geocoding telemetry</span>
        </div>
      </div>
    </div>
  );
}
