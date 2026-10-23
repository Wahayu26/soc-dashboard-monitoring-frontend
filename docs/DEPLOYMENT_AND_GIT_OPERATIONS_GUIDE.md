# Sentinel SOC - Deployment, Git Operations & Rollback Guide
**Panduan Resmi Deployment, Perintah Git, dan Prosedur Rollback Server Produksi**  
*Clipan Finance Indonesia (CFI) - Security Operations Center Platform*

---

## 1. Arsitektur Lingkungan & Profil Server

| Informasi | Detail Konfigurasi |
| :--- | :--- |
| **Hostname Server** | `dc-uat-dwilab-app-001` |
| **IP Address Server** | `10.100.108.250` |
| **Domain Resmi (Public/LAN)** | `https://soc.clipan.co.id/` |
| **Web Server / Reverse Proxy** | Apache HTTPD (`httpd`) dengan SSL Termination |
| **Path Root Proyek di Server** | `/var/www/html/soc-dashboard-finale/` |
| **Path Frontend di Server** | `/var/www/html/soc-dashboard-finale/soc-dashboard-frontend/` |
| **Path Backend di Server** | `/var/www/html/soc-dashboard-finale/soc-dashboard-backend/` |
| **Path Portal di Server** | `/var/www/html/portal/` |
| **Daftar Container Docker** | `soc-frontend` (Port 3000), `soc-backend` (Port 8000), `soc-reverb` (Port 8080), `soc-queue`, `soc-scheduler`, `soc-redis` |

---

## 2. Alur Branching & Git Workflow

Platform Sentinel SOC menggunakan strategi 2 cabang utama (*two-branch flow*):

```
[Local / Workspace] (dev) 
        │
        ├──> git push origin dev (Testing & Staging)
        │
        └──> git merge dev -> main
                │
                └──> git push origin main (Production Release)
                        │
                        v
         [Server: dc-uat-dwilab-app-001]
         git pull origin main -> docker compose up -d --build
```

- **Branch `dev`**: Digunakan untuk pengerjaan fitur baru, bug fixing, dan pengujian internal.
- **Branch `main`**: Cabang stabil (*production-ready*). Server produksi **hanya** menarik (*pull*) dari branch `main`.

---

## 3. Perintah Git dari Komputer Developer / Lokal

### A. Alur Standar: Commit dan Push ke GitHub

Jalankan perintah berikut di terminal komputer developer (PowerShell / Bash):

```bash
# 1. Pastikan berada di repositori yang tepat (misal frontend)
cd "d:\DATA AJI\Projects Aji\SOC-Dashboard-New\soc-dashboard-frontend"

# 2. Periksa status berkas yang dimodifikasi
git status

# 3. Stage seluruh perubahan berkas
git add .

# 4. Buat commit dengan pesan deskriptif
git commit -m "feat(isfw): implement priority enhancements and update docs"

# 5. Push commit ke branch dev di GitHub
git push origin dev

# 6. Pindah ke branch main dan merge pembaruan dari dev
git checkout main
git merge dev

# 7. Push pembaruan ke branch main di GitHub
git push origin main

# 8. Kembalikan branch aktif ke dev untuk melanjutkan development
git checkout dev
```

> **Catatan untuk Backend:**
> Jika perubahan ada di backend, lakukan hal yang sama pada direktori `soc-dashboard-backend`.

---

## 4. Prosedur Deployment di Server Produksi (`dc-uat-dwilab-app-001`)

Login ke server melalui SSH:
```bash
ssh user@10.100.108.250
```

---

### Skenario A: Deployment Pembaruan Frontend Saja (Next.js)
Gunakan skenario ini jika Anda hanya mengubah UI, komponen dashboard, grafik, atau teks halaman:

```bash
# 1. Pindah ke direktori frontend di server
cd /var/www/html/soc-dashboard-finale/soc-dashboard-frontend

# 2. Tarik commit terbaru dari branch main
git checkout main
git pull origin main

# 3. Rebuild dan restart container soc-frontend
docker compose up -d --build soc-frontend

# 4. Verifikasi container berjalan normal (STATUS: Up)
docker compose ps soc-frontend

# 5. Pantau log container untuk memastikan Next.js berhasil running
docker compose logs -f --tail=30 soc-frontend
```
*(Tekan `Ctrl + C` untuk keluar dari pemantauan log).*

---

### Skenario B: Deployment Pembaruan Backend Saja (Laravel API)
Gunakan skenario ini jika Anda mengubah controller, service, collector, atau model database:

```bash
# 1. Pindah ke direktori backend di server
cd /var/www/html/soc-dashboard-finale/soc-dashboard-backend

# 2. Tarik commit terbaru dari branch main
git checkout main
git pull origin main

# 3. Jalankan migration database (jika ada penambahan tabel/kolom baru)
docker exec -it soc-backend php artisan migrate --force

# 4. Bersihkan dan perbarui cache aplikasi Laravel
docker exec -it soc-backend php artisan optimize:clear
docker exec -it soc-backend php artisan config:cache
docker exec -it soc-backend php artisan route:cache

# 5. Restart container backend, worker antrean, dan WebSocket server
docker restart soc-backend soc-queue soc-reverb soc-scheduler

# 6. Pantau log backend untuk memastikan tidak ada error 500
docker logs -f --tail=30 soc-backend
```

---

### Skenario C: Deployment Penuh Melalui Script Otomatis (Full-Stack)
Tersedia skrip pembaruan otomatis satu-klik di root direktori proyek:

```bash
cd /var/www/html/soc-dashboard-finale/
chmod +x deploy_portal_soc_fix.sh
./deploy_portal_soc_fix.sh
```

Skrip ini akan secara otomatis:
1. Memperbarui Portal Dashboard Clipan (Port 8090).
2. Memperbarui Next.js Sentinel SOC Frontend (Port 3000).
3. Melakukan tes konfigurasi Apache (`httpd -t`) dan me-reload web server (`systemctl reload httpd`).

---

## 5. Prosedur Rollback Cepat & Aman (Emergency Rollback)

Jika setelah deployment terjadi *critical bug*, tampilan blank, atau service backend crash, lakukan rollback dengan salah satu metode berikut:

---

### Metode 1: Rollback Menggunakan Git Commit ID (Sangat Cepat & Direkomendasikan)

#### Langkah Rollback Frontend:
```bash
cd /var/www/html/soc-dashboard-finale/soc-dashboard-frontend

# 1. Lihat daftar riwayat commit terakhir
git log --oneline -n 5
# Contoh output:
# 76c2b09 (HEAD -> main) feat: recent update yang bermasalah
# a4f67b3 feat: commit sebelumnya yang stabil dan berjalan baik

# 2. Checkout kembali ke commit ID yang stabil
git checkout a4f67b3

# 3. Rebuild container menggunakan kode dari commit stabil
docker compose up -d --build soc-frontend

# 4. Verifikasi bahwa dashboard kembali normal di browser
docker compose ps
```

#### Langkah Rollback Backend:
```bash
cd /var/www/html/soc-dashboard-finale/soc-dashboard-backend

# 1. Rollback migrasi database jika perubahan terakhir mengubah skema DB
docker exec -it soc-backend php artisan migrate:rollback --step=1

# 2. Checkout ke commit ID yang stabil
git checkout <COMMIT_ID_STABIL>

# 3. Bersihkan cache aplikasi
docker exec -it soc-backend php artisan optimize:clear

# 4. Restart container backend
docker restart soc-backend soc-queue soc-reverb soc-scheduler
```

---

### Metode 2: Rollback Permanen di Git (Revert Commit)
Gunakan metode ini dari komputer lokal jika ingin membatalkan perubahan dan menyinkronkannya kembali ke GitHub:

```bash
# 1. Revert commit terakhir yang bermasalah
git revert HEAD --no-edit

# 2. Push commit pembatalan ke dev dan main
git push origin dev
git checkout main
git merge dev
git push origin main
git checkout dev

# 3. Di server produksi, cukup jalankan git pull biasa:
cd /var/www/html/soc-dashboard-finale/soc-dashboard-frontend
git pull origin main
docker compose up -d --build soc-frontend
```

---

### Metode 3: Rollback Instan Menggunakan Tag Image Docker
Sebagai praktik terbaik sebelum melakukan rilis besar di server, Anda dapat memberi tag backup pada image Docker yang sedang berjalan:

```bash
# SEBELUM DEPLOYMENT: Buat tag backup image yang stabil
docker tag soc-dashboard-frontend:latest soc-dashboard-frontend:backup-stable

# JIKA DEPLOYMENT GAGAL: Kembalikan image backup dalam hitungan detik
docker stop soc-frontend
docker rm soc-frontend
docker run -d \
  --name soc-frontend \
  --restart unless-stopped \
  -p 3000:3000 \
  soc-dashboard-frontend:backup-stable
```

---

## 6. Cheatsheet Perintah Git Sehari-hari (Quick Reference)

| Perintah Git | Deskripsi & Skenario Penggunaan |
| :--- | :--- |
| `git status` | Mengetahui status berkas yang berubah, baru, atau terhapus. |
| `git diff` | Melihat detail baris kode apa saja yang baru dimodifikasi. |
| `git log -n 5 --oneline` | Menampilkan 5 commit terakhir dalam format ringkas 1 baris. |
| `git stash` | Menyimpan sementara pekerjaan yang belum selesai jika ingin berpindah branch. |
| `git stash pop` | Mengembalikan kembali perubahan yang disimpan oleh `git stash`. |
| `git checkout -b <nama-branch>` | Membuat branch baru sekaligus berpindah ke branch tersebut. |
| `git branch -a` | Menampilkan seluruh branch yang ada di lokal maupun di remote GitHub. |
| `git fetch origin` | Mengambil informasi commit terbaru dari GitHub tanpa langsung menggabungkannya. |
| `git reset --hard HEAD` | **Hati-hati**: Membatalkan seluruh perubahan lokal dan kembali ke commit terakhir. |
| `git clean -fd` | Menghapus seluruh berkas dan folder baru yang belum di-track oleh Git. |

---

## 7. Verifikasi Pasca-Deployment & Pemeriksaan Kesehatan (Health Checks)

Setelah selesai melakukan deployment atau rollback, wajib lakukan verifikasi berikut di server:

### 1. Periksa Status Seluruh Container
```bash
docker compose ps
```
*Pastikan kolom `STATUS` untuk seluruh service bernilai `Up (healthy)` atau `Up X minutes`.*

### 2. Uji Respon API Backend
```bash
curl -I http://localhost:8000/api/health
# Harus mengembalikan HTTP/1.1 200 OK
```

### 3. Uji Akses Frontend Next.js
```bash
curl -I http://localhost:3000/
# Harus mengembalikan HTTP/1.1 200 OK atau 307 Temporary Redirect ke login
```

### 4. Periksa Port Listener Server
```bash
ss -tuln | grep -E '3000|8000|8080|8090'
# Memastikan port 3000 (frontend), 8000 (backend), 8080 (reverb), dan 8090 (portal) dalam status LISTEN
```

### 5. Periksa Status Web Server Apache
```bash
systemctl status httpd
```
*Pastikan service dalam kondisi `active (running)`.*
