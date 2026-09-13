-- ==========================================================
-- SKEMA BASIS DATA: SALAM WATER (DEPOT AIR MINUM ISI ULANG)
-- ==========================================================

-- Buat database jika belum ada (opsional untuk server lokal)
CREATE DATABASE IF NOT EXISTS `salam_water` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `salam_water`;

-- 1. TABEL: kategori_pengeluaran
-- Menyimpan kategori pengeluaran operasional depot air minum
CREATE TABLE IF NOT EXISTS `kategori_pengeluaran` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nama_kategori` VARCHAR(100) NOT NULL,
    `keterangan` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TABEL: transaksi_penjualan
-- Menyimpan catatan transaksi penjualan galon air isi ulang maupun galon baru
CREATE TABLE IF NOT EXISTS `transaksi_penjualan` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tanggal` DATE NOT NULL,
    `jenis_transaksi` ENUM('isi_ulang', 'galon_baru') NOT NULL DEFAULT 'isi_ulang',
    `jumlah_galon` INT NOT NULL DEFAULT 1,
    `harga_satuan` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `metode_pembayaran` ENUM('tunai', 'transfer', 'qris') NOT NULL DEFAULT 'tunai',
    `catatan` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_penjualan_tanggal` (`tanggal`),
    INDEX `idx_penjualan_jenis` (`jenis_transaksi`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABEL: pengeluaran
-- Menyimpan catatan pengeluaran operasional depot
CREATE TABLE IF NOT EXISTS `pengeluaran` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tanggal` DATE NOT NULL,
    `id_kategori` INT NOT NULL,
    `nominal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `catatan` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_pengeluaran_tanggal` (`tanggal`),
    CONSTRAINT `fk_pengeluaran_kategori` 
        FOREIGN KEY (`id_kategori`) 
        REFERENCES `kategori_pengeluaran` (`id`) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABEL: pesanan
-- Menyimpan pesanan dari pelanggan online / tamu tanpa login
CREATE TABLE IF NOT EXISTS `pesanan` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nomor_pesanan` VARCHAR(30) NOT NULL UNIQUE,
    `tanggal` DATE NOT NULL,
    `nama_pelanggan` VARCHAR(100) NOT NULL,
    `no_hp` VARCHAR(25) NOT NULL,
    `alamat` TEXT NOT NULL,
    `jenis_galon` ENUM('isi_ulang', 'galon_baru') NOT NULL DEFAULT 'isi_ulang',
    `harga_satuan` DECIMAL(12, 2) NOT NULL DEFAULT 5000.00,
    `jumlah_galon` INT NOT NULL DEFAULT 1,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 5000.00,
    `metode_pembayaran` ENUM('tunai', 'transfer', 'qris') NOT NULL DEFAULT 'tunai',
    `status` ENUM('menunggu', 'diproses', 'selesai', 'dibatalkan') NOT NULL DEFAULT 'menunggu',
    `catatan` VARCHAR(255) NULL,
    `id_transaksi_penjualan` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_pesanan_nomor` (`nomor_pesanan`),
    INDEX `idx_pesanan_nohp` (`no_hp`),
    INDEX `idx_pesanan_status` (`status`),
    INDEX `idx_pesanan_tanggal` (`tanggal`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================
-- SEED DATA AWAL: Kategori Pengeluaran Standar Depot Air
-- ==========================================================
INSERT INTO `kategori_pengeluaran` (`id`, `nama_kategori`, `keterangan`) VALUES
(1, 'Tutup & Tisu Galon', 'Pengadaan tutup segel galon, tisu basah pembersih, dan segel panas'),
(2, 'Air Tangki / Sumber Mata Air', 'Pembelian pasokan air baku tangki (5000L - 8000L)'),
(3, 'Token Listrik & PDAM', 'Tagihan listrik pompa RO/UV dan air operasional depot'),
(4, 'Filter & Perawatan Mesin', 'Penggantian filter spun sedimen, CTO/GAC karbon aktif, lampu UV/Ozon'),
(5, 'Galon Kosong Baru', 'Stok galon kosong baru untuk pelanggan baru/tukar tambah'),
(6, 'Transportasi & Bensin', 'Bahan bakar motor roda tiga / mobil pengantaran galon'),
(7, 'Gaji Karyawan', 'Gaji dan bonus kasir / operator depot'),
(8, 'Operasional Lainnya', 'Perlengkapan sabun, alat kebersihan, ATK, plastik, dll')
ON DUPLICATE KEY UPDATE `nama_kategori` = VALUES(`nama_kategori`);

-- ==========================================================
-- SAMPLE DATA (Data Transaksi Awal untuk Memudahkan Review)
-- ==========================================================
INSERT INTO `transaksi_penjualan` (`tanggal`, `jenis_transaksi`, `jumlah_galon`, `harga_satuan`, `total`, `metode_pembayaran`, `catatan`) VALUES
(CURRENT_DATE(), 'isi_ulang', 35, 5000.00, 175000.00, 'tunai', 'Pelanggan langsung perumahan (Isi Ulang 5rb)'),
(CURRENT_DATE(), 'isi_ulang', 15, 6000.00, 90000.00, 'qris', 'Antar warung makan Bu Siti (Isi Ulang 6rb)'),
(CURRENT_DATE(), 'galon_baru', 2, 22000.00, 44000.00, 'transfer', 'Tukar galon / galon kosong (22rb)'),
(DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY), 'galon_baru', 1, 65000.00, 65000.00, 'qris', 'Pembelian galon baru komplit (65rb)'),
(DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY), 'isi_ulang', 48, 5000.00, 240000.00, 'tunai', 'Penjualan depot reguler'),
(DATE_SUB(CURRENT_DATE(), INTERVAL 2 DAY), 'isi_ulang', 52, 5000.00, 260000.00, 'tunai', 'Penjualan depot reguler');

INSERT INTO `pengeluaran` (`tanggal`, `id_kategori`, `nominal`, `catatan`) VALUES
(CURRENT_DATE(), 1, 65000.00, 'Beli 1 dus tutup galon biru & tisu antiseptik'),
(DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY), 6, 25000.00, 'Bensin motor antar galon'),
(DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY), 2, 350000.00, 'Isi air tangki gunung 7.000 liter');
