<?php
/**
 * REST API Endpoint: Laporan Keuangan & Ringkasan Dashboard
 * Aplikasi: Salam Water - Depot Air Minum Isi Ulang
 * File: api/laporan.php
 */

require_once __DIR__ . '/../config/database.php';

// Lindungi endpoint laporan finansial hanya untuk admin
require_admin_auth();

$pdo = get_db_connection();
$action = isset($_GET['action']) ? trim($_GET['action']) : 'dashboard';

switch ($action) {
    case 'dashboard':
        get_dashboard_summary($pdo);
        break;

    case 'laporan':
        get_financial_report($pdo);
        break;

    default:
        json_response(false, null, 'Aksi laporan tidak valid. Pilihan: dashboard, laporan.', 400);
        break;
}

/**
 * Ringkasan Statistik untuk Dashboard
 */
function get_dashboard_summary($pdo) {
    try {
        $today = date('Y-m-d');
        $first_day_month = date('Y-m-01');
        $last_day_month = date('Y-m-t');
        $first_day_year = date('Y-01-01');

        // Helper fungsi query agregasi penjualan
        $get_sales_agg = function($start_date, $end_date) use ($pdo) {
            $stmt = $pdo->prepare("
                SELECT 
                    COALESCE(SUM(total), 0) AS total_omzet,
                    COALESCE(SUM(jumlah_galon), 0) AS total_galon,
                    COALESCE(SUM(CASE WHEN jenis_transaksi = 'isi_ulang' THEN jumlah_galon ELSE 0 END), 0) AS galon_isi_ulang,
                    COALESCE(SUM(CASE WHEN jenis_transaksi = 'galon_baru' THEN jumlah_galon ELSE 0 END), 0) AS galon_baru,
                    COALESCE(SUM(CASE WHEN jenis_transaksi = 'isi_ulang' THEN total ELSE 0 END), 0) AS omzet_isi_ulang,
                    COALESCE(SUM(CASE WHEN jenis_transaksi = 'galon_baru' THEN total ELSE 0 END), 0) AS omzet_galon_baru,
                    COUNT(id) AS jumlah_transaksi
                FROM transaksi_penjualan
                WHERE tanggal BETWEEN :start_date AND :end_date
            ");
            $stmt->execute([':start_date' => $start_date, ':end_date' => $end_date]);
            return $stmt->fetch();
        };

        // Helper fungsi query agregasi pengeluaran
        $get_expense_agg = function($start_date, $end_date) use ($pdo) {
            $stmt = $pdo->prepare("
                SELECT 
                    COALESCE(SUM(nominal), 0) AS total_pengeluaran,
                    COUNT(id) AS jumlah_transaksi
                FROM pengeluaran
                WHERE tanggal BETWEEN :start_date AND :end_date
            ");
            $stmt->execute([':start_date' => $start_date, ':end_date' => $end_date]);
            return $stmt->fetch();
        };

        // 1. Data Hari Ini
        $sales_today = $get_sales_agg($today, $today);
        $expense_today = $get_expense_agg($today, $today);

        // 2. Data Bulan Ini
        $sales_month = $get_sales_agg($first_day_month, $last_day_month);
        $expense_month = $get_expense_agg($first_day_month, $last_day_month);

        // 3. Data Tahun Ini
        $sales_year = $get_sales_agg($first_day_year, $today);
        $expense_year = $get_expense_agg($first_day_year, $today);

        // 4. Breakdown Pengeluaran per Kategori (Bulan Ini)
        $stmt_cat = $pdo->prepare("
            SELECT 
                k.id,
                k.nama_kategori,
                COALESCE(SUM(p.nominal), 0) AS total_nominal,
                COUNT(p.id) AS frekuensi
            FROM kategori_pengeluaran k
            LEFT JOIN pengeluaran p ON k.id = p.id_kategori AND p.tanggal BETWEEN :start_date AND :end_date
            GROUP BY k.id, k.nama_kategori
            ORDER BY total_nominal DESC
        ");
        $stmt_cat->execute([':start_date' => $first_day_month, ':end_date' => $last_day_month]);
        $kategori_breakdown = $stmt_cat->fetchAll();

        // 5. Breakdown Metode Pembayaran (Bulan Ini)
        $stmt_pay = $pdo->prepare("
            SELECT 
                metode_pembayaran,
                COALESCE(SUM(total), 0) AS total_nominal,
                COUNT(id) AS jumlah_transaksi
            FROM transaksi_penjualan
            WHERE tanggal BETWEEN :start_date AND :end_date
            GROUP BY metode_pembayaran
        ");
        $stmt_pay->execute([':start_date' => $first_day_month, ':end_date' => $last_day_month]);
        $metode_pembayaran_list = $stmt_pay->fetchAll();

        // 6. Transaksi Terbaru (5 penjualan terakhir & 5 pengeluaran terakhir)
        $recent_sales = $pdo->query("
            SELECT 'penjualan' AS tipe, id, tanggal, jenis_transaksi, jumlah_galon, total, metode_pembayaran, catatan, created_at 
            FROM transaksi_penjualan 
            ORDER BY tanggal DESC, id DESC LIMIT 5
        ")->fetchAll();

        $recent_expenses = $pdo->query("
            SELECT 'pengeluaran' AS tipe, p.id, p.tanggal, k.nama_kategori, p.nominal, p.catatan, p.created_at 
            FROM pengeluaran p 
            JOIN kategori_pengeluaran k ON p.id_kategori = k.id 
            ORDER BY p.tanggal DESC, p.id DESC LIMIT 5
        ")->fetchAll();

        // Susun payload hasil ringkasan
        $result = [
            'hari_ini' => [
                'omzet'           => (float)$sales_today['total_omzet'],
                'pengeluaran'     => (float)$expense_today['total_pengeluaran'],
                'laba_bersih'     => (float)($sales_today['total_omzet'] - $expense_today['total_pengeluaran']),
                'galon_terjual'   => (int)$sales_today['total_galon'],
                'galon_isi_ulang' => (int)$sales_today['galon_isi_ulang'],
                'galon_baru'      => (int)$sales_today['galon_baru']
            ],
            'bulan_ini' => [
                'periode'         => date('F Y'),
                'omzet'           => (float)$sales_month['total_omzet'],
                'pengeluaran'     => (float)$expense_month['total_pengeluaran'],
                'laba_bersih'     => (float)($sales_month['total_omzet'] - $expense_month['total_pengeluaran']),
                'galon_terjual'   => (int)$sales_month['total_galon'],
                'galon_isi_ulang' => (int)$sales_month['galon_isi_ulang'],
                'galon_baru'      => (int)$sales_month['galon_baru'],
                'omzet_isi_ulang' => (float)$sales_month['omzet_isi_ulang'],
                'omzet_galon_baru'=> (float)$sales_month['omzet_galon_baru']
            ],
            'tahun_ini' => [
                'tahun'           => date('Y'),
                'omzet'           => (float)$sales_year['total_omzet'],
                'pengeluaran'     => (float)$expense_year['total_pengeluaran'],
                'laba_bersih'     => (float)($sales_year['total_omzet'] - $expense_year['total_pengeluaran']),
                'galon_terjual'   => (int)$sales_year['total_galon']
            ],
            'kategori_pengeluaran_bulan_ini' => $kategori_breakdown,
            'metode_pembayaran_bulan_ini'    => $metode_pembayaran_list,
            'aktivitas_terkini' => [
                'penjualan'   => $recent_sales,
                'pengeluaran' => $recent_expenses
            ]
        ];

        json_response(true, $result, 'Ringkasan dashboard berhasil dimuat.');
    } catch (PDOException $e) {
        json_response(false, null, 'Gagal memuat dashboard: ' . $e->getMessage(), 500);
    }
}

/**
 * Laporan Arus Kas & Laba Rugi Buku Kas
 */
function get_financial_report($pdo) {
    try {
        // Tentukan rentang tanggal
        $start_date = !empty($_GET['start_date']) ? $_GET['start_date'] : date('Y-m-01');
        $end_date   = !empty($_GET['end_date']) ? $_GET['end_date'] : date('Y-m-d');

        // Validasi format tanggal YYYY-MM-DD
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start_date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end_date)) {
            json_response(false, null, 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.', 422);
        }

        // 1. Ambil transaksi penjualan pada periode
        $stmt_penjualan = $pdo->prepare("
            SELECT 
                id, 
                tanggal, 
                'masuk' AS arus,
                CONCAT(
                    CASE WHEN jenis_transaksi = 'isi_ulang' THEN 'Penjualan Isi Ulang (' ELSE 'Penjualan Galon Baru (' END,
                    jumlah_galon, ' galon @ Rp ', FORMAT(harga_satuan, 0, 'id_ID'), ')'
                ) AS deskripsi,
                jenis_transaksi,
                jumlah_galon,
                harga_satuan,
                metode_pembayaran,
                total AS nominal_masuk,
                0.00 AS nominal_keluar,
                catatan,
                created_at
            FROM transaksi_penjualan
            WHERE tanggal BETWEEN :start_date AND :end_date
        ");
        $stmt_penjualan->execute([':start_date' => $start_date, ':end_date' => $end_date]);
        $rows_penjualan = $stmt_penjualan->fetchAll();

        // 2. Ambil transaksi pengeluaran pada periode
        $stmt_pengeluaran = $pdo->prepare("
            SELECT 
                p.id, 
                p.tanggal, 
                'keluar' AS arus,
                CONCAT('Pengeluaran: ', k.nama_kategori) AS deskripsi,
                NULL AS jenis_transaksi,
                0 AS jumlah_galon,
                0.00 AS harga_satuan,
                NULL AS metode_pembayaran,
                0.00 AS nominal_masuk,
                p.nominal AS nominal_keluar,
                p.catatan,
                p.created_at
            FROM pengeluaran p
            JOIN kategori_pengeluaran k ON p.id_kategori = k.id
            WHERE p.tanggal BETWEEN :start_date AND :end_date
        ");
        $stmt_pengeluaran->execute([':start_date' => $start_date, ':end_date' => $end_date]);
        $rows_pengeluaran = $stmt_pengeluaran->fetchAll();

        // 3. Gabungkan seluruh data dan urutkan secara kronologis (tanggal ASC, id ASC)
        $gabungan = array_merge($rows_penjualan, $rows_pengeluaran);
        usort($gabungan, function($a, $b) {
            $cmp = strcmp($a['tanggal'], $b['tanggal']);
            if ($cmp === 0) {
                return strcmp($a['created_at'], $b['created_at']);
            }
            return $cmp;
        });

        // 4. Hitung Saldo Berjalan dan Akumulasi Ringkasan
        $running_balance = 0.00;
        $total_pemasukan = 0.00;
        $total_pengeluaran = 0.00;
        $total_galon_isi_ulang = 0;
        $total_galon_baru = 0;

        foreach ($gabungan as &$item) {
            $masuk = (float)$item['nominal_masuk'];
            $keluar = (float)$item['nominal_keluar'];

            $running_balance += ($masuk - $keluar);
            $item['saldo_berjalan'] = $running_balance;

            $total_pemasukan += $masuk;
            $total_pengeluaran += $keluar;

            if ($item['arus'] === 'masuk') {
                if ($item['jenis_transaksi'] === 'isi_ulang') {
                    $total_galon_isi_ulang += (int)$item['jumlah_galon'];
                } elseif ($item['jenis_transaksi'] === 'galon_baru') {
                    $total_galon_baru += (int)$item['jumlah_galon'];
                }
            }
        }
        unset($item);

        $laba_bersih = $total_pemasukan - $total_pengeluaran;

        $response_data = [
            'filter' => [
                'start_date' => $start_date,
                'end_date'   => $end_date
            ],
            'ringkasan' => [
                'total_pemasukan'       => $total_pemasukan,
                'total_pengeluaran'     => $total_pengeluaran,
                'laba_bersih'           => $laba_bersih,
                'total_galon_terjual'   => $total_galon_isi_ulang + $total_galon_baru,
                'total_galon_isi_ulang' => $total_galon_isi_ulang,
                'total_galon_baru'      => $total_galon_baru,
                'status_laba'           => $laba_bersih >= 0 ? 'Surplus (Untung)' : 'Defisit (Rugi)'
            ],
            'buku_kas' => $gabungan
        ];

        json_response(true, $response_data, 'Laporan keuangan berhasil dimuat.');
    } catch (PDOException $e) {
        json_response(false, null, 'Gagal menyusun laporan keuangan: ' . $e->getMessage(), 500);
    }
}
