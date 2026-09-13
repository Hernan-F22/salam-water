<?php
/**
 * REST API Endpoint: Pemesanan Galon Online (Publik/Tamu & Manajemen Admin)
 * File: api/pesanan.php
 */

require_once __DIR__ . '/../config/database.php';

$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

if ($action === 'update_status') {
    handle_update_status($pdo, $method);
} elseif ($action === 'delete') {
    handle_delete_pesanan($pdo, $method);
} else {
    switch ($method) {
        case 'GET':
            handle_get_pesanan($pdo);
            break;

        case 'POST':
            handle_create_pesanan($pdo);
            break;

        case 'DELETE':
            handle_delete_pesanan($pdo, $method);
            break;

        default:
            json_response(false, null, 'Metode HTTP tidak didukung.', 405);
            break;
    }
}

/**
 * Handle Pembuatan Pesanan Baru (Publik / Tamu Tanpa Login)
 */
function handle_create_pesanan($pdo) {
    $input = get_json_input();

    $nama = isset($input['nama_pelanggan']) ? trim($input['nama_pelanggan']) : '';
    $no_hp = isset($input['no_hp']) ? trim($input['no_hp']) : '';
    $alamat = isset($input['alamat']) ? trim($input['alamat']) : '';
    $jenis_galon = isset($input['jenis_galon']) ? trim($input['jenis_galon']) : 'isi_ulang';
    $harga_satuan = isset($input['harga_satuan']) ? (float)$input['harga_satuan'] : 5000.00;
    $jumlah_galon = isset($input['jumlah_galon']) ? (int)$input['jumlah_galon'] : 1;
    $metode_pembayaran = isset($input['metode_pembayaran']) ? trim($input['metode_pembayaran']) : 'tunai';
    $catatan = isset($input['catatan']) ? trim($input['catatan']) : null;

    // Validasi input pemesan
    if (empty($nama)) {
        json_response(false, null, 'Nama pemesan wajib diisi.', 422);
    }
    if (empty($no_hp)) {
        json_response(false, null, 'Nomor WhatsApp / HP wajib diisi agar pesanan dapat diproses.', 422);
    }
    if (empty($alamat)) {
        if ((float)$harga_satuan == 5000.00) {
            $alamat = 'Ambil Sendiri di Depot';
        } else {
            json_response(false, null, 'Alamat pengantaran galon wajib diisi untuk layanan pesan antar.', 422);
        }
    }
    if (!in_array($jenis_galon, ['isi_ulang', 'galon_baru'])) {
        json_response(false, null, 'Pilihan jenis galon tidak valid.', 422);
    }
    if ($jumlah_galon <= 0) {
        json_response(false, null, 'Jumlah galon harus minimal 1.', 422);
    }
    if ($harga_satuan <= 0) {
        json_response(false, null, 'Harga satuan tidak valid.', 422);
    }
    if (!in_array($metode_pembayaran, ['tunai', 'transfer', 'qris'])) {
        $metode_pembayaran = 'tunai';
    }

    $total = (float)($jumlah_galon * $harga_satuan);
    $tanggal = date('Y-m-d');
    
    // Generate nomor pesanan unik misal: ORD-20260913-A1B2
    $nomor_pesanan = 'ORD-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));

    try {
        $stmt = $pdo->prepare("
            INSERT INTO pesanan (
                nomor_pesanan, tanggal, nama_pelanggan, no_hp, alamat, 
                jenis_galon, harga_satuan, jumlah_galon, total, 
                metode_pembayaran, status, catatan
            ) VALUES (
                :nomor, :tanggal, :nama, :nohp, :alamat,
                :jenis, :harga, :jumlah, :total,
                :metode, 'menunggu', :catatan
            )
        ");

        $stmt->execute([
            ':nomor'   => $nomor_pesanan,
            ':tanggal' => $tanggal,
            ':nama'    => $nama,
            ':nohp'    => $no_hp,
            ':alamat'  => $alamat,
            ':jenis'   => $jenis_galon,
            ':harga'   => $harga_satuan,
            ':jumlah'  => $jumlah_galon,
            ':total'   => $total,
            ':metode'  => $metode_pembayaran,
            ':catatan' => $catatan
        ]);

        $order_id = $pdo->lastInsertId();

        // Siapkan link pesan WhatsApp konfirmasi
        $layanan_label = ((float)$harga_satuan == 5000.00) ? '🏪 Ambil Sendiri di Depot' : '🚚 Pesan Antar ke Alamat';
        $jenis_label = $jenis_galon === 'isi_ulang' ? 'Isi Ulang Air' : 'Galon Baru';
        $wa_text = "Halo Salam Water, saya mau konfirmasi pesanan:\n"
                 . "No Pesanan: *{$nomor_pesanan}*\n"
                 . "Nama: *{$nama}*\n"
                 . "Layanan: *{$layanan_label}*\n"
                 . "Pesanan: {$jumlah_galon}x {$jenis_label} (@ Rp " . number_format($harga_satuan, 0, ',', '.') . ")\n"
                 . "Total: Rp " . number_format($total, 0, ',', '.') . "\n"
                 . ((float)$harga_satuan == 5000.00 ? "Info Ambil: {$alamat}\n" : "Alamat Antar: {$alamat}\n")
                 . "Metode Bayar: " . strtoupper($metode_pembayaran) . " (CASH)";

        $wa_url_1 = "https://wa.me/6287879996392?text=" . rawurlencode($wa_text);
        $wa_url_2 = "https://wa.me/6285659719922?text=" . rawurlencode($wa_text);

        json_response(true, [
            'id'            => $order_id,
            'nomor_pesanan' => $nomor_pesanan,
            'tanggal'       => $tanggal,
            'nama'          => $nama,
            'no_hp'         => $no_hp,
            'alamat'        => $alamat,
            'jenis_galon'   => $jenis_galon,
            'jumlah_galon'  => $jumlah_galon,
            'harga_satuan'  => $harga_satuan,
            'total'         => $total,
            'metode'        => $metode_pembayaran,
            'status'        => 'menunggu',
            'catatan'       => $catatan,
            'wa_text'       => $wa_text,
            'wa_url_1'      => $wa_url_1,
            'wa_url_2'      => $wa_url_2
        ], 'Pesanan Anda berhasil dikirim! Depot Salam Water akan segera memproses.', 201);

    } catch (PDOException $e) {
        json_response(false, null, 'Gagal membuat pesanan: ' . $e->getMessage(), 500);
    }
}

/**
 * Handle Mengambil Pesanan (Bisa Lacak oleh Tamu atau Daftar Semua oleh Admin)
 */
function handle_get_pesanan($pdo) {
    // 1. Jika ada parameter no_hp -> Publik melacak pesanannya sendiri
    if (!empty($_GET['no_hp'])) {
        $no_hp = trim($_GET['no_hp']);
        try {
            $stmt = $pdo->prepare("
                SELECT id, nomor_pesanan, tanggal, nama_pelanggan, no_hp, alamat, 
                       jenis_galon, harga_satuan, jumlah_galon, total, 
                       metode_pembayaran, status, catatan, created_at
                FROM pesanan 
                WHERE no_hp = :nohp OR nomor_pesanan = :nomor
                ORDER BY id DESC LIMIT 20
            ");
            $stmt->execute([':nohp' => $no_hp, ':nomor' => $no_hp]);
            $orders = $stmt->fetchAll();
            json_response(true, $orders, 'Data riwayat pesanan berhasil ditemukan.');
        } catch (PDOException $e) {
            json_response(false, null, 'Gagal melacak pesanan: ' . $e->getMessage(), 500);
        }
        return;
    }

    // 2. Jika tidak ada no_hp -> Wajib Admin Auth untuk melihat semua pesanan
    require_admin_auth();

    try {
        $conditions = [];
        $params = [];

        if (!empty($_GET['status']) && in_array($_GET['status'], ['menunggu', 'diproses', 'selesai', 'dibatalkan'])) {
            $conditions[] = "status = :status";
            $params[':status'] = $_GET['status'];
        }

        $sql = "SELECT id, nomor_pesanan, tanggal, nama_pelanggan, no_hp, alamat, 
                       jenis_galon, harga_satuan, jumlah_galon, total, 
                       metode_pembayaran, status, catatan, id_transaksi_penjualan, created_at
                FROM pesanan";

        if (!empty($conditions)) {
            $sql .= " WHERE " . implode(" AND ", $conditions);
        }

        $sql .= " ORDER BY CASE status 
                    WHEN 'menunggu' THEN 1 
                    WHEN 'diproses' THEN 2 
                    WHEN 'selesai' THEN 3 
                    WHEN 'dibatalkan' THEN 4 
                  END ASC, id DESC LIMIT 100";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll();

        // Hitung statistik pesanan menunggu
        $count_stmt = $pdo->query("SELECT 
            COUNT(id) AS total_order,
            SUM(CASE WHEN status = 'menunggu' THEN 1 ELSE 0 END) AS pending_count,
            SUM(CASE WHEN status = 'diproses' THEN 1 ELSE 0 END) AS proses_count,
            SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS selesai_count
        FROM pesanan");
        $stats = $count_stmt->fetch();

        json_response(true, [
            'orders' => $orders,
            'stats'  => $stats
        ], 'Daftar seluruh pesanan berhasil dimuat.');

    } catch (PDOException $e) {
        json_response(false, null, 'Gagal mengambil data pesanan: ' . $e->getMessage(), 500);
    }
}

/**
 * Handle Update Status Pesanan (Khusus Admin)
 */
function handle_update_status($pdo, $method) {
    if ($method !== 'POST') {
        json_response(false, null, 'Metode HTTP harus POST untuk memperbarui status.', 405);
    }

    require_admin_auth();
    $input = get_json_input();

    $id = isset($input['id']) ? (int)$input['id'] : 0;
    $status_baru = isset($input['status']) ? trim($input['status']) : '';

    if ($id <= 0) {
        json_response(false, null, 'ID pesanan tidak valid.', 422);
    }
    if (!in_array($status_baru, ['menunggu', 'diproses', 'selesai', 'dibatalkan'])) {
        json_response(false, null, 'Status pesanan tidak valid.', 422);
    }

    try {
        // Ambil data pesanan saat ini
        $chk = $pdo->prepare("SELECT * FROM pesanan WHERE id = :id");
        $chk->execute([':id' => $id]);
        $order = $chk->fetch();

        if (!$order) {
            json_response(false, null, 'Pesanan tidak ditemukan.', 404);
        }

        $id_transaksi_penjualan = $order['id_transaksi_penjualan'];

        // Jika status diubah ke 'selesai' dan belum pernah dimasukkan ke transaksi_penjualan:
        if ($status_baru === 'selesai' && empty($id_transaksi_penjualan)) {
            $catatan_penjualan = "Pesanan Online #{$order['nomor_pesanan']} ({$order['nama_pelanggan']} - {$order['no_hp']})";
            if (!empty($order['catatan'])) {
                $catatan_penjualan .= " - " . $order['catatan'];
            }

            $stmt_sales = $pdo->prepare("
                INSERT INTO transaksi_penjualan (
                    tanggal, jenis_transaksi, jumlah_galon, harga_satuan, 
                    total, metode_pembayaran, catatan
                ) VALUES (
                    :tanggal, :jenis, :jumlah, :harga,
                    :total, :metode, :catatan
                )
            ");

            $stmt_sales->execute([
                ':tanggal' => date('Y-m-d'),
                ':jenis'   => $order['jenis_galon'],
                ':jumlah'  => $order['jumlah_galon'],
                ':harga'   => $order['harga_satuan'],
                ':total'   => $order['total'],
                ':metode'  => $order['metode_pembayaran'],
                ':catatan' => $catatan_penjualan
            ]);

            $id_transaksi_penjualan = $pdo->lastInsertId();
        }

        // Perbarui status pesanan
        $stmt_up = $pdo->prepare("
            UPDATE pesanan 
            SET status = :status, id_transaksi_penjualan = :id_sales 
            WHERE id = :id
        ");
        $stmt_up->execute([
            ':status'   => $status_baru,
            ':id_sales' => $id_transaksi_penjualan,
            ':id'       => $id
        ]);

        json_response(true, [
            'id'                     => $id,
            'status'                 => $status_baru,
            'id_transaksi_penjualan' => $id_transaksi_penjualan
        ], "Status pesanan #{$order['nomor_pesanan']} berhasil diubah menjadi " . strtoupper($status_baru));

    } catch (PDOException $e) {
        json_response(false, null, 'Gagal memperbarui status pesanan: ' . $e->getMessage(), 500);
    }
}

/**
 * Handle Hapus Pesanan (Khusus Admin)
 */
function handle_delete_pesanan($pdo, $method) {
    if (!in_array($method, ['POST', 'DELETE'])) {
        json_response(false, null, 'Metode HTTP harus POST atau DELETE untuk menghapus pesanan.', 405);
    }

    require_admin_auth();
    $input = get_json_input();

    $id = isset($input['id']) ? (int)$input['id'] : (isset($_GET['id']) ? (int)$_GET['id'] : 0);

    if ($id <= 0) {
        json_response(false, null, 'ID pesanan tidak valid.', 422);
    }

    try {
        $chk = $pdo->prepare("SELECT id, nomor_pesanan, id_transaksi_penjualan FROM pesanan WHERE id = :id");
        $chk->execute([':id' => $id]);
        $order = $chk->fetch();

        if (!$order) {
            json_response(false, null, 'Pesanan tidak ditemukan atau sudah dihapus.', 404);
        }

        $pdo->beginTransaction();

        // Jika pesanan ini memiliki transaksi penjualan di buku kas, hapus juga agar sinkron
        if (!empty($order['id_transaksi_penjualan'])) {
            $del_sales = $pdo->prepare("DELETE FROM transaksi_penjualan WHERE id = :sales_id");
            $del_sales->execute([':sales_id' => $order['id_transaksi_penjualan']]);
        }

        // Hapus pesanan dari tabel pesanan
        $del_order = $pdo->prepare("DELETE FROM pesanan WHERE id = :id");
        $del_order->execute([':id' => $id]);

        $pdo->commit();

        json_response(true, ['id' => $id], "Pesanan #{$order['nomor_pesanan']} berhasil dihapus.");

    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_response(false, null, 'Gagal menghapus pesanan: ' . $e->getMessage(), 500);
    }
}

