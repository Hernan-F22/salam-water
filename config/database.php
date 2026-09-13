<?php
/**
 * Konfigurasi Koneksi Database MySQL (PDO)
 * Kompatibel dengan Local XAMPP dan Serverless Vercel (Cloud DB)
 * Aplikasi: Salam Water - Laporan Keuangan Depot Air Minum
 */

// Aktifkan reporting error untuk debugging terkontrol
error_reporting(E_ALL);
ini_set('display_errors', '0'); // Tetap matikan display error agar tidak merusak output JSON

// Mengambil variabel environment dengan fallback ke konfigurasi lokal XAMPP
$db_host = getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? '127.0.0.1');
$db_user = getenv('DB_USER') ?: ($_ENV['DB_USER'] ?? 'root');
$db_pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : ($_ENV['DB_PASS'] ?? '');
$db_name = getenv('DB_NAME') ?: ($_ENV['DB_NAME'] ?? 'salam_water');
$db_port = getenv('DB_PORT') ?: ($_ENV['DB_PORT'] ?? '3306');

/**
 * Mendapatkan instance koneksi PDO MySQL
 * @return PDO
 */
function get_db_connection() {
    global $db_host, $db_user, $db_pass, $db_name, $db_port;
    static $pdo = null;

    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset=utf8mb4";
    
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ];

    try {
        $pdo = new PDO($dsn, $db_user, $db_pass, $options);
        return $pdo;
    } catch (PDOException $e) {
        // Jika koneksi gagal, kembalikan respons JSON yang informatif
        json_response(false, null, 'Gagal terhubung ke database: ' . $e->getMessage(), 500);
        exit;
    }
}

/**
 * Helper Standar Output JSON
 * @param bool $success Status sukses atau gagal
 * @param mixed $data Data payload
 * @param string $message Pesan respons
 * @param int $http_code HTTP status code
 */
function json_response($success, $data = null, $message = '', $http_code = 200) {
    if (!headers_sent()) {
        http_response_code($http_code);
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    }

    echo json_encode([
        'success' => (bool)$success,
        'message' => $message,
        'data'    => $data,
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * Helper untuk membaca input request JSON (POST/PUT/DELETE)
 * @return array
 */
function get_json_input() {
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return $_POST ?: [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * Handle preflight OPTIONS request untuk CORS
 */
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    http_response_code(200);
    exit;
}
