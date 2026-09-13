# 💧 Salam Water - Aplikasi Laporan Keuangan Depot Air Minum Isi Ulang

Aplikasi web modern, responsif, dan serverless-ready untuk manajemen keuangan dan laporan arus kas depot air minum isi ulang **"Salam Water"**.

---

## 🚀 Ringkasan Fitur

1. **Dashboard Ringkasan Real-Time**:
   - Total omzet/pemasukan hari ini, bulan ini, dan tahun ini.
   - Akumulasi penjualan galon (breakdown isi ulang biasa vs galon baru).
   - Total pengeluaran operasional (tutup galon, tisu, air tangki sumber, token listrik, dll).
   - Kalkulasi otomatis laba bersih (`Pemasukan - Pengeluaran`).
   - Grafik persentase pengeluaran per kategori & persebaran metode pembayaran (Tunai, QRIS, Transfer).

2. **Manajemen Transaksi**:
   - Pencatatan transaksi penjualan dengan kalkulasi subtotal instan.
   - Preset tombol cepat untuk kuantitas (+1, +5, +10) dan harga satuan (Rp 5.000, Rp 6.000, Rp 22.000, Rp 65.000).
   - Pencatatan pengeluaran operasional terhubung dengan kategori database.
   - Riwayat data tabel lengkap dengan fitur hapus transaksi.

3. **Laporan Keuangan & Buku Kas (Print Ready)**:
   - Filter periode fleksibel (Hari Ini, 7 Hari Terakhir, Bulan Ini, Bulan Lalu, atau Kustom Tanggal).
   - Rekapitulasi buku kas kronologis dengan saldo berjalan (running balance).
   - Mode Cetak / Export PDF (`@media print`) yang otomatis memformat laporan resmi dengan kop surat depot dan kolom tanda tangan penanggung jawab.

---

## 📁 Struktur Direktori

```text
web_water/
├── api/
│   ├── transaksi.php         # Endpoint REST API: CRUD penjualan, pengeluaran & kategori
│   └── laporan.php           # Endpoint REST API: Agregasi ringkasan dashboard & buku kas
├── assets/
│   ├── style.css             # Desain dashboard responsif modern & Print CSS (@media print)
│   └── app.js               # Frontend controller Vanilla JS (AJAX Fetch API, kalkulasi realtime)
├── config/
│   └── database.php          # Koneksi database MySQL PDO berbasis Environment Variables
├── schema.sql                # Skema DDL tabel MySQL + data awal kategori & contoh transaksi
├── vercel.json               # Konfigurasi deployment serverless PHP untuk Vercel
├── index.html                # Tampilan UI Dashboard utama (Static Single Page Frontend)
└── README.md                 # Dokumentasi proyek & panduan deployment
```

---

## 💻 Panduan Menjalankan di Localhost (XAMPP)

1. **Pastikan Apache & MySQL di XAMPP Aktif**.
2. **Import Skema Database**:
   - Buka browser ke `http://localhost/phpmyadmin`.
   - Buat database baru bernama `salam_water` (atau biarkan script membuatnya otomatis).
   - Klik tab **Import**, pilih file `schema.sql` dari folder proyek, lalu klik **Import**.
3. **Buka Aplikasi**:
   - Akses via browser: `http://localhost/web_water/`
   - Aplikasi otomatis membaca konfigurasi default XAMPP (`localhost`, user: `root`, password kosong, db: `salam_water`).

---

## ☁️ Panduan Setup Database Cloud Gratis & Deploy ke Vercel

Untuk mendeploy backend PHP ke Vercel, kita membutuhkan database MySQL berbasis cloud eksternal karena Vercel beroperasi secara stateless / serverless.

### Langkah 1: Buat Database MySQL Cloud Gratis

Rekomendasi penyedia cloud gratis terbaik & 100% kompatibel dengan MySQL:

#### Pilihan A: TiDB Cloud Serverless (Sangat Direkomendasikan)
1. Kunjungi [https://tidbcloud.com/](https://tidbcloud.com/) dan buat akun gratis.
2. Buat cluster baru -> Pilih **Serverless (Free Tier)** (Gratis 5 GB selamanya).
3. Setelah cluster siap, klik tombol **Connect**:
   - Pilih tab **General**.
   - Catat detail koneksi:
     - **Host**: (contoh: `gateway01.ap-southeast-1.prod.aws.tidbcloud.com`)
     - **Port**: `4000`
     - **User**: (contoh: `xxxxxx.root`)
     - **Password**: Password yang Anda buat.
     - **Database**: `salam_water` (buat database via Web SQL Editor TiDB).
4. Masuk ke menu **SQL Editor** di TiDB Cloud, salin isi file `schema.sql`, lalu jalankan (**Run**) untuk membuat tabel dan data awal.

#### Pilihan B: Aiven for MySQL atau Clever Cloud
- Anda juga dapat menggunakan Aiven (Free Tier) atau Clever Cloud MySQL add-on untuk mendapatkan credentials MySQL gratis.

---

### Langkah 2: Konfigurasi Environment Variables di Vercel

1. Buka [https://vercel.com/](https://vercel.com/) dan login ke dashboard Anda.
2. Buat proyek baru dengan mengimpor repositori Git proyek ini, atau gunakan **Vercel CLI**.
3. Sebelum mengklik tombol **Deploy**, buka bagian **Environment Variables** dan tambahkan variabel berikut:

| Nama Variabel | Contoh Nilai (Sesuaikan dengan Cloud DB Anda) | Keterangan |
| :--- | :--- | :--- |
| `DB_HOST` | `gateway01.ap-southeast-1.prod.aws.tidbcloud.com` | Host endpoint database cloud |
| `DB_USER` | `xxxxxx.root` | Username database |
| `DB_PASS` | `password_rahasia_anda` | Password database |
| `DB_NAME` | `salam_water` | Nama database |
| `DB_PORT` | `4000` (atau `3306` jika MySQL standar) | Port koneksi database |

> **Catatan**: Jika menggunakan TiDB Cloud, port default adalah `4000`. Jika menggunakan MySQL standar seperti Clever Cloud / Aiven, port biasanya `3306`.

---

### Langkah 3: Deploy Aplikasi ke Vercel

#### Cara 1: Menggunakan Git / GitHub (Otomatis)
1. Inisialisasi git dan push source code ke repository GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit Salam Water"
   git branch -M main
   git remote add origin <URL_REPOSITORY_GITHUB_ANDA>
   git push -u origin main
   ```
2. Di dashboard Vercel, pilih **Add New Project** -> Pilih repositori Anda -> Atur Environment Variables -> Klik **Deploy**.

#### Cara 2: Menggunakan Vercel CLI
1. Pastikan Anda telah menginstal Vercel CLI:
   ```bash
   npm install -g vercel
   ```
2. Jalankan perintah deploy di folder proyek:
   ```bash
   vercel
   ```
3. Ikuti petunjuk di terminal, lalu jalankan perintah produksi:
   ```bash
   vercel --prod
   ```

Aplikasi web **Salam Water** akan langsung aktif di domain Vercel Anda (contoh: `https://salam-water.vercel.app`)!

---

## 🖨️ Panduan Cetak Laporan / Export ke PDF

1. Klik tab menu **Laporan & Buku Kas**.
2. Tentukan periode tanggal transaksi yang diinginkan (misal: "Bulan Ini" atau pilih tanggal kustom).
3. Klik tombol hijau **🖨️ Cetak Laporan / Simpan PDF**.
4. Pada jendela cetak browser:
   - Pilih printer tujuan atau pilih **Save as PDF** / **Simpan sebagai PDF**.
   - Tampilan akan otomatis bersih, tombol dan navigasi disembunyikan, serta dilengkapi kop surat resmi depot dan kolom tanda tangan.
