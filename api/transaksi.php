<?php
/**
 * REST API Endpoint: Manajemen Transaksi Penjualan & Pengeluaran
 * Aplikasi: Salam Water - Depot Air Minum Isi Ulang
 * File: api/transaksi.php
 */

require_once __DIR__ . '/../config/database.php';

$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];
$type = isset($_GET['type']) ? trim($_GET['type']) : 'penjualan';

// Router berdasarkan tipe transaksi
switch ($type) {
    case 'kategori':
        handle_kategori($pdo, $method);
        break;

    case 'penjualan':
        handle_penjualan($pdo, $method);
        break;

    case 'pengeluaran':
        handle_pengeluaran($pdo, $method);
        break;

    default:
        json_response(false, null, 'Tipe transaksi tidak valid. Pilihan: penjualan, pengeluaran, kategori.', 400);
        break;
}

// ==========================================================
// HANDLER: KATEGORI PENGELUARAN
// ==========================================================
function handle_kategori($pdo, $method) {
    if ($method === 'GET') {
        try {
            $stmt = $pdo->query("SELECT id, nama_kategori, keterangan FROM kategori_pengeluaran ORDER BY id ASC");
            $kategori = $stmt->fetchAll();
            json_response(true, $kategori, 'Daftar kategori berhasil diambil.');
        } catch (PDOException $e) {
            json_response(false, null, 'Gagal mengambil kategori: ' . $e->getMessage(), 500);
        }
    } else {
        json_response(false, null, 'Metode HTTP tidak didukung untuk kategori.', 405);
    }
}

// ==========================================================
// HANDLER: TRANSAKSI PENJUALAN
// ==========================================================
function handle_penjualan($pdo, $method) {
    switch ($method) {
        case 'GET':
            try {
                $conditions = [];
                $params = [];

                if (!empty($_GET['start_date'])) {
                    $conditions[] = "tanggal >= :start_date";
                    $params[':start_date'] = $_GET['start_date'];
                }
                if (!empty($_GET['end_date'])) {
                    $conditions[] = "tanggal <= :end_date";
                    $params[':end_date'] = $_GET['end_date'];
                }
                if (!empty($_GET['jenis_transaksi']) && in_array($_GET['jenis_transaksi'], ['isi_ulang', 'galon_baru'])) {
                    $conditions[] = "jenis_transaksi = :jenis_transaksi";
                    $params[':jenis_transaksi'] = $_GET['jenis_transaksi'];
                }
                if (!empty($_GET['metode_pembayaran']) && in_array($_GET['metode_pembayaran'], ['tunai', 'transfer', 'qris'])) {
                    $conditions[] = "metode_pembayaran = :metode_pembayaran";
                    $params[':metode_pembayaran'] = $_GET['metode_pembayaran'];
                }

                $sql = "SELECT id, tanggal, jenis_transaksi, jumlah_galon, harga_satuan, total, metode_pembayaran, catatan, created_at 
                        FROM transaksi_penjualan";

                if (!empty($conditions)) {
                    $sql .= " WHERE " . implode(" AND ", $conditions);
                }

                $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
                $sql .= " ORDER BY tanggal DESC, id DESC LIMIT {$limit}";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $data = $stmt->fetchAll();

                json_response(true, $data, 'Data penjualan berhasil dimuat.');
            } catch (PDOException $e) {
                json_response(false, null, 'Gagal mengambil data penjualan: ' . $e->getMessage(), 500);
            }
            break;

        case 'POST':
            $input = get_json_input();

            $tanggal = !empty($input['tanggal']) ? trim($input['tanggal']) : date('Y-m-d');
            $jenis_transaksi = !empty($input['jenis_transaksi']) ? trim($input['jenis_transaksi']) : 'isi_ulang';
            $jumlah_galon = isset($input['jumlah_galon']) ? (int)$input['jumlah_galon'] : 0;
            $harga_satuan = isset($input['harga_satuan']) ? (float)$input['harga_satuan'] : 0.00;
            $metode_pembayaran = !empty($input['metode_pembayaran']) ? trim($input['metode_pembayaran']) : 'tunai';
            $catatan = !empty($input['catatan']) ? trim($input['catatan']) : null;

            // Validasi Input
            if (!in_array($jenis_transaksi, ['isi_ulang', 'galon_baru'])) {
                json_response(false, null, 'Jenis transaksi harus isi_ulang atau galon_baru.', 422);
            }
            if ($jumlah_galon <= 0) {
                json_response(false, null, 'Jumlah galon harus lebih dari 0.', 422);
            }
            if ($harga_satuan < 0) {
                json_response(false, null, 'Harga satuan tidak boleh negatif.', 422);
            }
            if (!in_array($metode_pembayaran, ['tunai', 'transfer', 'qris'])) {
                json_response(false, null, 'Metode pembayaran tidak valid.', 422);
            }

            // Hitung total otomatis di server untuk memastikan integritas data
            $total = (float)($jumlah_galon * $harga_satuan);

            try {
                $stmt = $pdo->prepare("
                    INSERT INTO transaksi_penjualan (tanggal, jenis_transaksi, jumlah_galon, harga_satuan, total, metode_pembayaran, catatan)
                    VALUES (:tanggal, :jenis, :jumlah, :harga, :total, :metode, :catatan)
                ");

                $stmt->execute([
                    ':tanggal' => $tanggal,
                    ':jenis'   => $jenis_transaksi,
                    ':jumlah'  => $jumlah_galon,
                    ':harga'   => $harga_satuan,
                    ':total'   => $total,
                    ':metode'  => $metode_pembayaran,
                    ':catatan' => $catatan
                ]);

                $new_id = $pdo->lastInsertId();

                json_response(true, [
                    'id' => $new_id,
                    'tanggal' => $tanggal,
                    'jenis_transaksi' => $jenis_transaksi,
                    'jumlah_galon' => $jumlah_galon,
                    'harga_satuan' => $harga_satuan,
                    'total' => $total,
                    'metode_pembayaran' => $metode_pembayaran,
                    'catatan' => $catatan
                ], 'Transaksi penjualan berhasil disimpan.', 201);
            } catch (PDOException $e) {
                json_response(false, null, 'Gagal menyimpan transaksi: ' . $e->getMessage(), 500);
            }
            break;

        case 'DELETE':
            $input = get_json_input();
            $id = isset($_GET['id']) ? (int)$_GET['id'] : (isset($input['id']) ? (int)$input['id'] : 0);

            if ($id <= 0) {
                json_response(false, null, 'ID transaksi penjualan tidak valid.', 422);
            }

            try {
                $stmt = $pdo->prepare("DELETE FROM transaksi_penjualan WHERE id = :id");
                $stmt->execute([':id' => $id]);

                if ($stmt->rowCount() > 0) {
                    json_response(true, ['id' => $id], 'Transaksi penjualan berhasil dihapus.');
                } else {
                    json_response(false, null, 'Data transaksi tidak ditemukan atau sudah dihapus.', 404);
                }
            } catch (PDOException $e) {
                json_response(false, null, 'Gagal menghapus data: ' . $e->getMessage(), 500);
            }
            break;

        default:
            json_response(false, null, 'Metode HTTP tidak didukung.', 405);
            break;
    }
}

// ==========================================================
// HANDLER: PENGELUARAN OPERASIONAL
// ==========================================================
function handle_pengeluaran($pdo, $method) {
    switch ($method) {
        case 'GET':
            try {
                $conditions = [];
                $params = [];

                if (!empty($_GET['start_date'])) {
                    $conditions[] = "p.tanggal >= :start_date";
                    $params[':start_date'] = $_GET['start_date'];
                }
                if (!empty($_GET['end_date'])) {
                    $conditions[] = "p.tanggal <= :end_date";
                    $params[':end_date'] = $_GET['end_date'];
                }
                if (!empty($_GET['id_kategori'])) {
                    $conditions[] = "p.id_kategori = :id_kategori";
                    $params[':id_kategori'] = (int)$_GET['id_kategori'];
                }

                $sql = "SELECT p.id, p.tanggal, p.id_kategori, k.nama_kategori, p.nominal, p.catatan, p.created_at 
                        FROM pengeluaran p
                        JOIN kategori_pengeluaran k ON p.id_kategori = k.id";

                if (!empty($conditions)) {
                    $sql .= " WHERE " . implode(" AND ", $conditions);
                }

                $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
                $sql .= " ORDER BY p.tanggal DESC, p.id DESC LIMIT {$limit}";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $data = $stmt->fetchAll();

                json_response(true, $data, 'Data pengeluaran berhasil dimuat.');
            } catch (PDOException $e) {
                json_response(false, null, 'Gagal mengambil data pengeluaran: ' . $e->getMessage(), 500);
            }
            break;

        case 'POST':
            $input = get_json_input();

            $tanggal = !empty($input['tanggal']) ? trim($input['tanggal']) : date('Y-m-d');
            $id_kategori = isset($input['id_kategori']) ? (int)$input['id_kategori'] : 0;
            $nominal = isset($input['nominal']) ? (float)$input['nominal'] : 0.00;
            $catatan = !empty($input['catatan']) ? trim($input['catatan']) : null;

            // Validasi Input
            if ($id_kategori <= 0) {
                json_response(false, null, 'Kategori pengeluaran wajib dipilih.', 422);
            }
            if ($nominal <= 0) {
                json_response(false, null, 'Nominal pengeluaran harus lebih dari 0.', 422);
            }

            // Pastikan kategori ada di tabel kategori_pengeluaran
            $chk = $pdo->prepare("SELECT id, nama_kategori FROM kategori_pengeluaran WHERE id = :id");
            $chk->execute([':id' => $id_kategori]);
            $kategori_row = $chk->fetch();

            if (!$kategori_row) {
                json_response(false, null, 'Kategori pengeluaran tidak ditemukan.', 404);
            }

            try {
                $stmt = $pdo->prepare("
                    INSERT INTO pengeluaran (tanggal, id_kategori, nominal, catatan)
                    VALUES (:tanggal, :id_kategori, :nominal, :catatan)
                ");

                $stmt->execute([
                    ':tanggal'     => $tanggal,
                    ':id_kategori' => $id_kategori,
                    ':nominal'     => $nominal,
                    ':catatan'     => $catatan
                ]);

                $new_id = $pdo->lastInsertId();

                json_response(true, [
                    'id' => $new_id,
                    'tanggal' => $tanggal,
                    'id_kategori' => $id_kategori,
                    'nama_kategori' => $kategori_row['nama_kategori'],
                    'nominal' => $nominal,
                    'catatan' => $catatan
                ], 'Data pengeluaran operasional berhasil disimpan.', 201);
            } catch (PDOException $e) {
                json_response(false, null, 'Gagal menyimpan pengeluaran: ' . $e->getMessage(), 500);
            }
            break;

        case 'DELETE':
            $input = get_json_input();
            $id = isset($_GET['id']) ? (int)$_GET['id'] : (isset($input['id']) ? (int)$input['id'] : 0);

            if ($id <= 0) {
                json_response(false, null, 'ID pengeluaran tidak valid.', 422);
            }

            try {
                $stmt = $pdo->prepare("DELETE FROM pengeluaran WHERE id = :id");
                $stmt->execute([':id' => $id]);

                if ($stmt->rowCount() > 0) {
                    json_response(true, ['id' => $id], 'Data pengeluaran berhasil dihapus.');
                } else {
                    json_response(false, null, 'Data pengeluaran tidak ditemukan atau sudah dihapus.', 404);
                }
            } catch (PDOException $e) {
                json_response(false, null, 'Gagal menghapus data pengeluaran: ' . $e->getMessage(), 500);
            }
            break;

        default:
            json_response(false, null, 'Metode HTTP tidak didukung.', 405);
            break;
    }
}
