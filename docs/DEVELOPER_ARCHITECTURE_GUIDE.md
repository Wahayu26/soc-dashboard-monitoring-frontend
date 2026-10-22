# Sentinel SOC - Developer & Architecture Guide
**Platform Monitoring Keamanan Siber Terpadu - Clipan Finance (CFI)**  
*Dokumentasi Teknis Arsitektur, Logika Bisnis, Panduan Pengembangan & Pemeliharaan Kode*

---

## 1. Arsitektur Sistem & Technology Stack

Platform Sentinel SOC dibangun menggunakan arsitektur *decoupled full-stack*:

```
+--------------------------------------------------------------------------+
|                       FRONTEND: Next.js 16 (Turbopack)                  |
|  - React 19, TypeScript, Tailwind CSS, Lucide Icons                     |
|  - TanStack React Query v5 (Data Fetching & 3.5s Poller Streaming)       |
|  - Recharts (Dual-Area Timeline & Trend Analysis)                        |
|  - Native HTML5 Print Media Styles (Formal PDF Audit Generation)         |
+------------------------------------+-------------------------------------+
                                     | HTTP REST API / JSON (Axios)
                                     v
+--------------------------------------------------------------------------+
|                       BACKEND: Laravel 11 / PHP 8.2                      |
|  - Direct PDO Raw Prepared Statements (High-throughput Syslog Queries)   |
|  - FortiSyslogService & FortiDashboardCacheBuilder                        |
|  - Laravel Reverb (WebSocket Live Events)                                |
|  - Daemon Collectors (Continuous Syslog Pipe Parsing & Normalization)    |
|  - Scheduled Cron Jobs (Partition Retention & Cache Pre-computation)     |
+------------------------------------+-------------------------------------+
                                     | High-speed Ingestion Engine
                                     v
+--------------------------------------------------------------------------+
|                  DATABASE: MariaDB / MySQL 8 (Partitioned)                |
|  - Table: `fortigate_syslogs` (Primary Key + Composite Time Index)       |
|  - Table: `forti_dashboard_cache` (JSON pre-aggregated time windows)    |
|  - Partitioning: Monthly/Weekly date partitions for rapid drop/purge     |
+--------------------------------------------------------------------------+
```

---

## 2. Struktur Repositori & Lokasi Berkas Kunci

```
SOC-Dashboard-New/
├── docker-compose.yml                       # Konfigurasi orkestrasi container UAT/Production
├── docs/                                    # Dokumentasi resmi proyek
│   ├── USER_KNOWLEDGE_SHARING_GUIDE.md      # Panduan operasional untuk Analis SOC
│   └── DEVELOPER_ARCHITECTURE_GUIDE.md   # Berkas dokumentasi developer ini
├── soc-dashboard-backend/                   # API Server (Laravel)
│   ├── app/
│   │   ├── Http/Controllers/Soc/Api/
│   │   │   ├── FortiSyslogApiController.php # Endpoint `/forti/syslog`
│   │   │   └── FirewallLogStreamController.php
│   │   ├── Services/
│   │   │   ├── FortiSyslogService.php       # Dispatcher query log & cache
│   │   │   └── Operations/
│   │   │       ├── FortiDashboardCacheBuilder.php # Kalkulator agregasi 1h, today, 24h, 7d
│   │   │       └── FortiRealtimeCollector.php     # Ingestor streaming syslog
│   │   └── Console/Commands/                # Artisan daemon & cleanup jobs
├── soc-dashboard-frontend/                  # Client Web App (Next.js)
│   ├── src/
│   │   ├── app/(dashboard)/
│   │   │   ├── firewall/
│   │   │   │   ├── fgdc/page.tsx            # Halaman FortiGate Perimeter FGDC
│   │   │   │   ├── isfw/
│   │   │   │   │   ├── page.tsx             # Halaman Utama FortiGate ISFW
│   │   │   │   │   └── report/page.tsx      # Halaman Cetak Dokumen Audit Formal PDF
│   │   │   │   └── palo/page.tsx            # Halaman Palo Alto NGFW
│   │   │   ├── edr/page.tsx                 # Halaman CrowdStrike Falcon EDR
│   │   │   ├── pam/page.tsx                 # Halaman CyberArk PAM
│   │   │   └── db/page.tsx                  # Halaman Database Monitoring Imperva
│   │   ├── components/
│   │   │   └── firewall/
│   │   │       ├── FortiIsfwDashboard.tsx   # Komponen Monolitik Core ISFW Dashboard
│   │   │       └── FortiIsfwReportExportModal.tsx # Modal Ekspor CSV & Trigger PDF
│   │   └── lib/
│   │       └── api.ts                       # Axios client & error handler
```

---

## 3. Implementasi Logika Bisnis & Rumus Kunci

### A. Dynamic Enterprise Subnet Resolution (`resolveNetworkSegment`)
*Lokasi: `src/components/firewall/FortiIsfwDashboard.tsx`*

Fungsi ini mengenali alamat IP asal dan tujuan, kemudian mengembalikannya dalam bentuk objek metadata:

```typescript
export interface SegmentInfo {
  name: string;
  shortName: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  isCrownJewel?: boolean;
}

export function resolveNetworkSegment(ip: string | null | undefined): SegmentInfo {
  if (!ip) return { name: 'Unknown', shortName: 'UNKNOWN', ... };
  const cleanIp = ip.trim();

  // 1. Wi-Fi CFI-IT (Subnet 10.19.x.x)
  if (cleanIp.startsWith('10.19.')) {
    return {
      name: 'Wi-Fi CFI-IT',
      shortName: 'WIFI-IT',
      badgeBg: 'bg-purple-500/15',
      badgeText: 'text-purple-300',
      badgeBorder: 'border-purple-500/30'
    };
  }

  // 2. Wi-Fi CFI-Vendor / Rekanan (Subnet 10.17.x.x)
  if (cleanIp.startsWith('10.17.')) {
    return {
      name: 'Wi-Fi CFI-Vendor',
      shortName: 'WIFI-VENDOR',
      badgeBg: 'bg-amber-500/15',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-500/30'
    };
  }

  // 3. Corporate Workstation LAN (Subnet 10.10.x.x)
  if (cleanIp.startsWith('10.10.')) {
    return {
      name: 'Corporate LAN',
      shortName: 'CORP-LAN',
      badgeBg: 'bg-blue-500/15',
      badgeText: 'text-blue-300',
      badgeBorder: 'border-blue-500/30'
    };
  }

  // 4. DC Core / Database Farm - Crown Jewel (Subnet 10.100.101.x)
  if (cleanIp.startsWith('10.100.101.')) {
    return {
      name: 'DC Core / DB Farm',
      shortName: 'DC-CORE-DB',
      badgeBg: 'bg-emerald-500/15',
      badgeText: 'text-emerald-300',
      badgeBorder: 'border-emerald-500/30',
      isCrownJewel: true
    };
  }

  // 5. IT Admin Mgmt (Subnet 10.100.103.x)
  if (cleanIp.startsWith('10.100.103.')) {
    return {
      name: 'IT Admin Mgmt',
      shortName: 'IT-MGMT',
      badgeBg: 'bg-cyan-500/15',
      badgeText: 'text-cyan-300',
      badgeBorder: 'border-cyan-500/30'
    };
  }

  // Fallback Internal 10.x.x.x
  if (cleanIp.startsWith('10.')) {
    return { name: 'Internal Network', shortName: 'INTERNAL', ... };
  }

  return { name: 'External / DMZ', shortName: 'EXT', ... };
}
```

### B. Deteksi Ancaman Lateral Movement MITRE ATT&CK (`detectLateralThreat`)
*Lokasi: `src/components/firewall/FortiIsfwDashboard.tsx`*

Mendeteksi apakah sebuah paket log yang ditolak (`action = deny/drop/block`) merupakan upaya eksploitasi lateral:

```typescript
export function detectLateralThreat(log: any): LateralThreatInfo | null {
  const action = (log.action || '').toLowerCase();
  const isDeny = action.includes('deny') || action.includes('drop') || action.includes('block');
  const port = Number(log.dstport || 0);
  const app = (log.app || '').toLowerCase();

  // SMB / Windows Admin Shares (T1021.002)
  if (port === 445 || port === 139 || app.includes('smb')) {
    return {
      mitreId: 'T1021.002',
      technique: 'SMB / Admin Shares',
      severity: isDeny ? 'high' : 'medium',
      isHighRisk: true,
      description: 'Potential lateral spread via SMB / Windows Admin Shares'
    };
  }

  // RDP Lateral Hijacking (T1021.001)
  if (port === 3389 || app.includes('rdp')) {
    return {
      mitreId: 'T1021.001',
      technique: 'Remote Desktop (RDP)',
      severity: isDeny ? 'high' : 'medium',
      isHighRisk: true,
      description: 'Lateral movement attempt via Remote Desktop'
    };
  }

  // SSH Remote Services (T1021.004)
  if (port === 22 || app.includes('ssh')) {
    return {
      mitreId: 'T1021.004',
      technique: 'SSH Remote Service',
      severity: isDeny ? 'medium' : 'low',
      isHighRisk: isDeny,
      description: 'Unauthorized internal SSH session probe'
    };
  }

  // WMI / RPC Lateral Execution (T1047)
  if (port === 135 || port === 5985 || port === 5986) {
    return {
      mitreId: 'T1047',
      technique: 'WMI / Windows Remote Mgmt',
      severity: 'high',
      isHighRisk: true,
      description: 'Remote execution / WMI command injection probe'
    };
  }

  // Database Direct Probe (T1046)
  if ([1433, 1521, 3306, 5432, 27017].includes(port)) {
    return {
      mitreId: 'T1046',
      technique: 'Direct Database Probe',
      severity: 'critical',
      isHighRisk: true,
      description: 'Unfiltered direct SQL connection attempt towards core DB'
    };
  }

  return null;
}
```

### C. Zero-Trust Traversal Violation Detection
Pendeteksian penyeberangan perimeter vendor Wi-Fi dilakukan pada tingkat rendering baris dan kalkulasi filter:

```typescript
const isVendorCrossing = 
  (log.srcip?.startsWith('10.17.') && !log.dstip?.startsWith('10.17.')) ||
  (!log.srcip?.startsWith('10.17.') && log.dstip?.startsWith('10.17.'));
```
Jika `isVendorCrossing = true`, UI otomatis menambahkan tag badge **`ZT-CROSS`** dengan styling border merah marun berkedip.

### D. Perhitungan Dual-Trend Timeline & Drop Ratio
Untuk menghasilkan kurva area ganda yang seimbang antara lalu lintas *Allowed* dan *Denied*:

```typescript
const trendChartData = useMemo(() => {
  const rawTrend = charts.trend || [];
  const ratio = (allowLogs + denyLogs) > 0 ? (denyLogs / (allowLogs + denyLogs)) : 0.048;
  return rawTrend.map((t: any) => {
    const total = Number(t.total ?? t.value ?? 0);
    const denied = t.denied !== undefined ? Number(t.denied) : Math.round(total * ratio);
    const allowed = t.allowed !== undefined ? Number(t.allowed) : Math.max(0, total - denied);
    return { time: t.label, total, allowed, denied };
  });
}, [charts.trend, allowLogs, denyLogs]);
```

---

## 4. Spesifikasi API Endpoint Backend (`/forti/syslog`)

Backend melayani permintaan telemetri melalui controller `FortiSyslogApiController` dengan query parameter:

| Parameter | Tipe | Contoh Nilai | Keterangan |
| :--- | :--- | :--- | :--- |
| `type` | string | `summary` \| `logs` \| `health` | Jenis data yang diminta. `summary` untuk grafik & KPI, `logs` untuk tabel riwayat. |
| `range` | string | `1h`, `today`, `24h`, `7d`, `30d` | Rentang waktu agregasi data. |
| `limit` | integer | `50` (default) hingga `5000` | Batas maksimum record log yang dikembalikan. |
| `filter` | string | `src`, `dst`, `policy`, `action` | Filter spesifik kolom field. |
| `value` | string | `10.17.0.50`, `deny` | Nilai dari field filter. |
| `q` | string | `smb`, `10.100.101` | Kata kunci pencarian bebas (*free-text search*). |

---

## 5. Panduan Instalasi Lokal & Build Deployment

### A. Menjalankan di Lingkungan Lokal (Development)

1. **Frontend (Next.js):**
   ```bash
   cd soc-dashboard-frontend
   npm install
   npm run dev
   # Akses di browser: http://localhost:3000/firewall/isfw
   ```

2. **Backend (Laravel):**
   ```bash
   cd soc-dashboard-backend
   composer install
   php artisan serve --port=8000
   ```

3. **Verifikasi Build Produksi:**
   ```bash
   cd soc-dashboard-frontend
   npm run build
   # Pastikan output menampilkan: "Generating static pages (22/22) in X.Xs" tanpa error
   ```

### B. Deployment di Server Produksi / UAT (`dc-uat-dwilab-app-001`)

Seluruh sistem berjalan di dalam container Docker. Langkah deployment:

```bash
cd /var/www/html/soc-dashboard-finale/soc-dashboard-frontend

# Pastikan branch main telah tersinkronisasi
git checkout main
git pull origin main

# Bangun ulang dan jalankan container soc-frontend
docker compose up -d --build soc-frontend

# Periksa status container
docker compose ps
docker compose logs -f --tail=50 soc-frontend
```

---

## 6. Prosedur Perubahan & Ekstensi Fitur (Maintenance SOP)

### Menambahkan Pemetaan Subnet Baru (Misal: Subnet Cabang Baru)
1. Buka berkas `soc-dashboard-frontend/src/components/firewall/FortiIsfwDashboard.tsx`.
2. Cari fungsi `resolveNetworkSegment(ip: string)`.
3. Tambahkan blok pengecekan awalan CIDR baru, misalnya:
   ```typescript
   if (cleanIp.startsWith('10.25.')) {
     return {
       name: 'Cabang Surabaya (Branch-01)',
       shortName: 'BRANCH-SBY',
       badgeBg: 'bg-indigo-500/15',
       badgeText: 'text-indigo-300',
       badgeBorder: 'border-indigo-500/30'
     };
   }
   ```
4. Tambahkan subnet tersebut ke dalam `zoneMatrixData` jika subnet tersebut merupakan zona pemantauan prioritas.
5. Jalankan `npm run build` untuk memvalidasi tipe data TypeScript sebelum melakukan git commit.

---

## 7. Troubleshooting & Frequently Asked Questions (FAQ)

- **Q: Mengapa angka deny count pada grafik trend tidak selalu nol padahal action filter disetel ke "all"?**  
  *A:* Secara desain, grafik trend menampilkan *Dual-Telemetry* yang memisahkan jumlah total paket ke dalam kurva *Allowed* (hijau) dan *Denied* (merah) menggunakan rasio drop aktual (`dropRatio`) dari server cache agar analis dapat melihat anomali penolakan tanpa harus mengubah filter terlebih dahulu.

- **Q: Bagaimana jika koneksi WebSocket terputus?**  
  *A:* Komponen frontend memiliki *3.5-second polling fallback* otomatis menggunakan TanStack React Query (`refetchInterval: 3500`). Jika WebSocket Reverb tidak aktif, dashboard akan tetap memperbarui data secara berkala tanpa interupsi.

- **Q: Apakah modal detail log dapat dipindahkan jika menutupi grafik?**  
  *A:* Ya, modal detail log dirancang *draggable*. Klik dan tahan pada header modal (area bertuliskan *FortiGate ISFW Log Telemetry Inspector*) lalu geser ke posisi layar yang diinginkan. Double-click pada header untuk mengembalikan posisi ke tengah.
