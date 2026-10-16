/**
 * Threat-intel pivot helpers for SOC quick actions.
 */

export function isIPv4(value?: string | null): boolean {
  if (!value) return false;
  return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value.trim());
}

/** RFC1918 / loopback / link-local / CGNAT – external TI lookups are meaningless for these. */
export function isPrivateIp(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

export interface IntelLink {
  name: string;
  url: string;
  color: string;
}

export function ipIntelLinks(ip: string): IntelLink[] {
  const v = encodeURIComponent(ip.trim());
  return [
    { name: 'VirusTotal', url: `https://www.virustotal.com/gui/ip-address/${v}`, color: 'sky' },
    { name: 'AbuseIPDB', url: `https://www.abuseipdb.com/check/${v}`, color: 'rose' },
    { name: 'Shodan', url: `https://www.shodan.io/host/${v}`, color: 'orange' },
    { name: 'GreyNoise', url: `https://viz.greynoise.io/ip/${v}`, color: 'emerald' },
    { name: 'AlienVault OTX', url: `https://otx.alienvault.com/indicator/ip/${v}`, color: 'violet' },
  ];
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function cveLink(cve: string): string {
  return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve.trim())}`;
}

export function mitreTechniqueLink(techniqueId: string): string {
  const cleanId = techniqueId.trim().replace('.', '/');
  return `https://attack.mitre.org/techniques/${cleanId}/`;
}

export function mitreTacticLink(tacticId: string): string {
  return `https://attack.mitre.org/tactics/${encodeURIComponent(tacticId.trim())}/`;
}

