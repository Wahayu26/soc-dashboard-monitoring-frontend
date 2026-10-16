'use client';

import { useState } from 'react';
import { 
  ShieldAlert, 
  ExternalLink, 
  Filter, 
  Search, 
  Crosshair, 
  Terminal, 
  Bug, 
  Layers, 
  AlertTriangle, 
  ChevronRight,
  Target,
  ArrowRight,
  Copy,
  Check
} from 'lucide-react';
import { cveLink, mitreTechniqueLink, mitreTacticLink, copyText, ipIntelLinks } from '@/lib/threatIntel';

export interface ThreatSignature {
  name: string;
  threat_id: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  tactic_id: string;
  tactic_name: string;
  technique_id: string;
  technique_name: string;
  cve?: string | null;
  category: string;
  hits: number;
  latest_source_ip?: string;
  latest_dest_ip?: string;
  latest_app?: string;
  rule_name?: string;
}

export interface MitreTacticItem {
  name: string;
  id: string;
  hits: number;
  severity: string;
  color: string;
}

interface PaloThreatIntelMatrixProps {
  threatSignatures: ThreatSignature[];
  mitreTactics?: MitreTacticItem[];
  totalThreats?: number;
  activeFilter?: string;
  onSelectFilter: (filter: string) => void;
  onInspectPayload?: (item: any) => void;
}

export function PaloThreatIntelMatrix({
  threatSignatures = [],
  mitreTactics = [],
  totalThreats = 0,
  activeFilter = '',
  onSelectFilter,
  onInspectPayload,
}: PaloThreatIntelMatrixProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedTactic, setSelectedTactic] = useState<string | null>(null);

  const handleCopyId = async (id: number) => {
    await copyText(id.toString());
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const getSeverityBadge = (severity: string) => {
    const s = severity.toLowerCase();
    switch (s) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]';
      case 'high':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-[0_0_10px_rgba(249,115,22,0.25)]';
      case 'medium':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }
  };

  const getTacticColor = (color: string) => {
    switch (color) {
      case 'rose':
        return {
          bg: 'bg-rose-500/10 hover:bg-rose-500/15',
          border: 'border-rose-500/30',
          text: 'text-rose-400',
          bar: 'bg-gradient-to-r from-rose-500 to-red-400',
        };
      case 'amber':
        return {
          bg: 'bg-amber-500/10 hover:bg-amber-500/15',
          border: 'border-amber-500/30',
          text: 'text-amber-400',
          bar: 'bg-gradient-to-r from-amber-500 to-yellow-400',
        };
      case 'sky':
        return {
          bg: 'bg-sky-500/10 hover:bg-sky-500/15',
          border: 'border-sky-500/30',
          text: 'text-sky-400',
          bar: 'bg-gradient-to-r from-sky-500 to-cyan-400',
        };
      case 'orange':
        return {
          bg: 'bg-orange-500/10 hover:bg-orange-500/15',
          border: 'border-orange-500/30',
          text: 'text-orange-400',
          bar: 'bg-gradient-to-r from-orange-500 to-amber-500',
        };
      case 'violet':
        return {
          bg: 'bg-violet-500/10 hover:bg-violet-500/15',
          border: 'border-violet-500/30',
          text: 'text-violet-400',
          bar: 'bg-gradient-to-r from-violet-500 to-purple-400',
        };
      default:
        return {
          bg: 'bg-cyan-500/10 hover:bg-cyan-500/15',
          border: 'border-cyan-500/30',
          text: 'text-cyan-400',
          bar: 'bg-gradient-to-r from-cyan-500 to-teal-400',
        };
    }
  };

  const maxHits = Math.max(1, ...threatSignatures.map((s) => s.hits));

  const filteredSignatures = selectedTactic
    ? threatSignatures.filter((s) => s.tactic_name === selectedTactic)
    : threatSignatures;

  return (
    <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Top Threat Signatures & MITRE ATT&CK® Mapping</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                  ENTERPRISE TI
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Correlation of Palo Alto perimeter threat detections mapped to MITRE ATT&CK tactics, techniques, and CVE advisories.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
            Signatures: <b className="text-rose-400">{threatSignatures.length}</b>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
            Threat Hits: <b className="text-emerald-400">{Number(totalThreats || 0).toLocaleString()}</b>
          </span>
          {selectedTactic && (
            <button
              onClick={() => setSelectedTactic(null)}
              className="px-2 py-1 rounded-xl bg-rose-950/60 border border-rose-500/40 text-[10px] text-rose-200 hover:bg-rose-900 transition-colors"
            >
              Reset Tactic Filter
            </button>
          )}
        </div>
      </div>

      {/* MITRE ATT&CK Tactics Matrix Grid */}
      <div>
        <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Layers size={13} className="text-rose-400" />
          <span>MITRE ATT&CK® Tactics Coverage (Kill Chain Phase)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {mitreTactics.map((tactic) => {
            const colors = getTacticColor(tactic.color);
            const isSelected = selectedTactic === tactic.name;
            const tacticHits = tactic.hits || 0;

            return (
              <div
                key={tactic.id}
                onClick={() => setSelectedTactic(isSelected ? null : tactic.name)}
                className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 select-none ${
                  isSelected
                    ? 'ring-2 ring-rose-400 ' + colors.bg + ' ' + colors.border
                    : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                }`}
                title={`Klik untuk filter signature berfase ${tactic.name} (${tactic.id})`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400 font-bold">{tactic.id}</span>
                  <span className={`px-1 rounded text-[9px] font-extrabold uppercase ${getSeverityBadge(tactic.severity)}`}>
                    {tactic.severity}
                  </span>
                </div>

                <div className="font-bold text-xs text-slate-200 truncate">
                  {tactic.name}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">Hits</span>
                    <span className={`font-bold ${colors.text}`}>{tacticHits.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors.bar}`}
                      style={{ width: `${Math.min(100, Math.max(12, (tacticHits / (totalThreats || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Threat Signatures Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Crosshair size={13} className="text-rose-400" />
            <span>High-Fidelity Detected Signatures ({filteredSignatures.length})</span>
          </span>
          <span className="text-[10px] text-slate-500">
            Klik nama atau target untuk investigasi detail
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800/90 bg-slate-950/60 custom-scrollbar">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/90 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Threat Signature & ID</th>
                <th className="py-2.5 px-3">MITRE ATT&CK Technique</th>
                <th className="py-2.5 px-3">CVE Reference</th>
                <th className="py-2.5 px-3">Attacker &bull; Destination</th>
                <th className="py-2.5 px-3 text-right">Hits</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredSignatures.length > 0 ? (
                filteredSignatures.map((sig, idx) => {
                  const percent = Math.round((sig.hits / maxHits) * 100);

                  return (
                    <tr
                      key={`${sig.threat_id}-${idx}`}
                      className="hover:bg-slate-900/60 transition-colors group"
                    >
                      {/* Severity */}
                      <td className="py-3 px-3 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getSeverityBadge(sig.severity)}`}>
                          {sig.severity}
                        </span>
                      </td>

                      {/* Threat Name & ID */}
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-bold text-slate-100 group-hover:text-rose-300 transition-colors truncate">
                          {sig.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                          <span className="text-slate-400 font-mono">ID: {sig.threat_id}</span>
                          <button
                            onClick={() => handleCopyId(sig.threat_id)}
                            className="hover:text-slate-200 transition-colors"
                            title="Salin Threat ID"
                          >
                            {copiedId === sig.threat_id ? (
                              <Check size={11} className="text-emerald-400" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                          <span>&bull;</span>
                          <span className="text-slate-400 truncate">{sig.category}</span>
                        </div>
                      </td>

                      {/* MITRE Technique */}
                      <td className="py-3 px-3">
                        <a
                          href={mitreTechniqueLink(sig.technique_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-cyan-300 hover:text-cyan-200 hover:border-cyan-500/40 transition-all font-mono"
                          title={`Buka definisi MITRE ${sig.technique_id} di attack.mitre.org`}
                        >
                          <span className="font-bold text-slate-400">[{sig.technique_id}]</span>
                          <span className="truncate max-w-[150px]">{sig.technique_name}</span>
                          <ExternalLink size={10} className="shrink-0 text-slate-500" />
                        </a>
                      </td>

                      {/* CVE Reference */}
                      <td className="py-3 px-3">
                        {sig.cve ? (
                          <a
                            href={cveLink(sig.cve)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] font-bold text-rose-300 hover:bg-rose-500/20 transition-all"
                            title={`Buka NVD CVE Entry untuk ${sig.cve}`}
                          >
                            <span>{sig.cve}</span>
                            <ExternalLink size={9} />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">N/A (Heuristic)</span>
                        )}
                      </td>

                      {/* Attacker -> Destination */}
                      <td className="py-3 px-3 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span 
                            onClick={() => onSelectFilter(`source_ip:${sig.latest_source_ip}`)}
                            className="text-rose-400 font-bold hover:underline cursor-pointer"
                            title="Filter log dari Attacker IP ini"
                          >
                            {sig.latest_source_ip || '-'}
                          </span>
                          <ArrowRight size={10} className="text-slate-600 shrink-0" />
                          <span className="text-slate-300 truncate max-w-[110px]">
                            {sig.latest_dest_ip || '-'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          App: <span className="text-amber-400/90">{sig.latest_app || 'any'}</span>
                        </div>
                      </td>

                      {/* Hits Count & Bar */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-slate-200">
                          {sig.hits.toLocaleString()}
                        </div>
                        <div className="w-16 h-1 bg-slate-800 rounded-full ml-auto mt-1 overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full"
                            style={{ width: `${Math.max(8, percent)}%` }}
                          />
                        </div>
                      </td>

                      {/* Filter Action */}
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectFilter(`threat:${sig.name}`)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 transition-all flex items-center gap-1 text-[11px] cursor-pointer ml-auto"
                          title={`Filter all ${sig.name} packets in log explorer`}
                        >
                          <Filter size={10} />
                          <span>Filter</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No signatures matched the selected MITRE ATT&CK tactic filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
