<?php

/**
 * SALAM WATER - API PINJAM GALON
 * Fitur: Pencatatan, Pelacakan & Rekap Pengembalian Pinjam Galon Pelanggan
 * File: api/pinjam_galon.php
 */

require_once __DIR__ . '/../config/database.php';

$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

// Seluruh endpoint pinjam galon mewajibkan autentikasi admin
require_admin_auth();

switch ($method) {
    case 'GET':
        handle_get_pinjam($pdo);
        break;

    case 'POST':
        if ($action === 'create') {
            handle_create_pinjam($pdo);
        } elseif ($action === 'return') {
            handle_return_pinjam($pdo);
        } elseif ($action === 'delete') {
            handle_delete_pinjam($pdo);
        } else {
            json_response(false, null, 'Action POST pinjam galon tidak valid.', 400);
        }
        break;

    default:
        json_response(false, null, 'Metode HTTP tidak didukung.', 405);
        break;
}

/**
 * Mengambil daftar data pinjam galon & statistik
 */
function handle_get_pinjam($pdo)
{
    try {
        $conditions = [];
        $params = [];

        if (!empty($_GET['status']) && in_array($_GET['status'], ['dipinjam', 'dikembalikan'])) {
            $conditions[] = "status = :status";
            $params[':status'] = $_GET['status'];
        }

        if (!empty($_GET['q'])) {
            $q = '%' . trim($_GET['q']) . '%';
            $conditions[] = "(nama_peminjam LIKE :q1 OR no_hp LIKE :q2 OR alamat LIKE :q3 OR nomor_pinjam LIKE :q4)";
            $params[':q1'] = $q;
            $params[':q2'] = $q;
            $params[':q3'] = $q;
            $params[':q4'] = $q;
        }

        $sql = "SELECT id, nomor_pinjam, tanggal_pinjam, nama_peminjam, no_hp, alamat, maps_url,
                       jumlah_galon, uang_jaminan, status, tanggal_kembali, catatan, created_at
                FROM pinjam_galon";

        if (!empty($conditions)) {
            $sql .= " WHERE " . implode(" AND ", $conditions);
        }

        $sql .= " ORDER BY CASE status WHEN 'dipinjam' THEN 1 ELSE 2 END ASC, tanggal_pinjam DESC, id DESC LIMIT 200";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        // Statistik pinjam galon
        $stats_stmt = $pdo->query("SELECT 
            COALESCE(SUM(CASE WHEN status = 'dipinjam' THEN jumlah_galon ELSE 0 END), 0) AS total_galon_dipinjam,
            COALESCE(SUM(CASE WHEN status = 'dipinjam' THEN 1 ELSE 0 END), 0) AS total_orang_meminjam,
            COALESCE(SUM(CASE WHEN status = 'dipinjam' THEN uang_jaminan ELSE 0 END), 0) AS total_uang_jaminan,
            COALESCE(SUM(CASE WHEN status = 'dikembalikan' THEN jumlah_galon ELSE 0 END), 0) AS total_galon_kembali
        FROM pinjam_galon");
        $stats = $stats_stmt->fetch();

        json_response(true, [
            'items' => $items,
            'stats' => $stats
        ], 'Data peminjaman galon berhasil dimuat.');
    } catch (PDOException $e) {
        json_response(false, null, 'Gagal mengambil data pinjam galon: ' . $e->getMessage(), 500);
    }
}

/**
 * Mencatat pinjam galon baru
 */
function handle_create_pinjam($pdo)
{
    $input = get_json_input();

    $nama = isset($input['nama_peminjam']) ? trim($input['nama_peminjam']) : '';
    $no_hp = isset($input['no_hp']) ? trim($input['no_hp']) : '';
    $alamat = isset($input['alamat']) ? trim($input['alamat']) : '';
    $maps_url = !empty($input['maps_url']) ? trim($input['maps_url']) : null;
    $jumlah_galon = isset($input['jumlah_galon']) ? (int)$input['jumlah_galon'] : 1;
    $uang_jaminan = isset($input['uang_jaminan']) ? (float)$input['uang_jaminan'] : 0.00;
    $catatan = isset($input['catatan']) ? trim($input['catatan']) : null;
    $tanggal_pinjam = !empty($input['tanggal_pinjam']) ? trim($input['tanggal_pinjam']) : date('Y-m-d');

    if (empty($nama)) {
        json_response(false, null, 'Nama peminjam wajib diisi.', 422);
    }
    if (empty($no_hp)) {
        json_response(false, null, 'Nomor WhatsApp / telepon peminjam wajib diisi.', 422);
    }
    if (empty($alamat)) {
        json_response(false, null, 'Alamat peminjam galon wajib diisi.', 422);
    }
    if ($jumlah_galon <= 0) {
        json_response(false, null, 'Jumlah galon yang dipinjam minimal 1.', 422);
    }

    $nomor_pinjam = 'PJM-' . date('Ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));

    try {
        $stmt = $pdo->prepare("
            INSERT INTO pinjam_galon (
                nomor_pinjam, tanggal_pinjam, nama_peminjam, no_hp, alamat, maps_url,
                jumlah_galon, uang_jaminan, status, catatan
            ) VALUES (
                :nomor, :tgl, :nama, :nohp, :alamat, :maps,
                :jumlah, :jaminan, 'dipinjam', :catatan
            )
        ");

        $stmt->execute([
            ':nomor'   => $nomor_pinjam,
            ':tgl'     => $tanggal_pinjam,
            ':nama'    => $nama,
            ':nohp'    => $no_hp,
            ':alamat'  => $alamat,
            ':maps'    => $maps_url,
            ':jumlah'  => $jumlah_galon,
            ':jaminan' => $uang_jaminan,
            ':catatan' => $catatan
        ]);

        $id = $pdo->lastInsertId();

        json_response(true, [
            'id'           => $id,
            'nomor_pinjam' => $nomor_pinjam,
            'nama_peminjam'=> $nama,
            'jumlah_galon' => $jumlah_galon
        ], 'Data peminjaman galon berhasil dicatat.', 201);
    } catch (PDOException $e) {
        json_response(false, null, 'Gagal mencatat peminjaman galon: ' . $e->getMessage(), 500);
    }
}

/**
 * Menandai galon telah dikembalikan
 */
function handle_return_pinjam($pdo)
{
    $input = get_json_input();
    $id = isset($input['id']) ? (int)$input['id'] : 0;
    $tgl_kembali = !empty($input['tanggal_kembali']) ? trim($input['tanggal_kembali']) : date('Y-m-d');

    if ($id <= 0) {
        json_response(false, null, 'ID peminjaman tidak valid.', 422);
    }

    try {
        $stmt = $pdo->prepare("UPDATE pinjam_galon SET status = 'dikembalikan', tanggal_kembali = :tgl WHERE id = :id");
        $stmt->execute([':tgl' => $tgl_kembali, ':id' => $id]);

        json_response(true, null, 'Peminjaman galon berhasil ditandai telah dikembalikan!');
    } catch (PDOException $e) {
        json_response(false, null, 'Gagal mengubah status pengembalian: ' . $e->getMessage(), 500);
    }
}

/**
 * Menghapus data pinjam galon
 */
function handle_delete_pinjam($pdo)
{
    $input = get_json_input();
    $id = isset($_GET['id']) ? (int)$_GET['id'] : (isset($input['id']) ? (int)$input['id'] : 0);

    if ($id <= 0) {
        json_response(false, null, 'ID peminjaman tidak valid.', 422);
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM pinjam_galon WHERE id = :id");
        $stmt->execute([':id' => $id]);

        json_response(true, null, 'Catatan peminjaman galon berhasil dihapus.');
    } catch (PDOException $e) {
        json_response(false, null, 'Gagal menghapus data pinjam galon: ' . $e->getMessage(), 500);
    }
}
