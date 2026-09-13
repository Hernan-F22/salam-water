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
$db_ssl  = getenv('DB_SSL') ?: ($_ENV['DB_SSL'] ?? '');

// Dukungan parsing otomatis jika menggunakan format DATABASE_URL (Railway / Aiven / Supabase)
if ($db_url = (getenv('DATABASE_URL') ?: ($_ENV['DATABASE_URL'] ?? ''))) {
    $parsed = parse_url($db_url);
    if ($parsed) {
        $db_host = $parsed['host'] ?? $db_host;
        $db_port = $parsed['port'] ?? $db_port;
        $db_user = $parsed['user'] ?? $db_user;
        $db_pass = $parsed['pass'] ?? $db_pass;
        $db_name = isset($parsed['path']) ? ltrim($parsed['path'], '/') : $db_name;
    }
}

/**
 * Mendapatkan instance koneksi PDO MySQL
 * @return PDO
 */
function get_db_connection()
{
    global $db_host, $db_user, $db_pass, $db_name, $db_port, $db_ssl;
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

    // Aktifkan mode SSL jika menggunakan cloud provider (TiDB, Aiven, dll)
    if ($db_ssl === 'true' || $db_ssl === '1' || (int)$db_port === 4000) {
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
    }

    try {
        $pdo = new PDO($dsn, $db_user, $db_pass, $options);
        return $pdo;
    } catch (PDOException $e) {
        $is_vercel = getenv('VERCEL') || isset($_ENV['VERCEL']);
        $msg = 'Gagal terhubung ke database: ' . $e->getMessage();

        if ($is_vercel && ($db_host === '127.0.0.1' || $db_host === 'localhost')) {
            $msg = 'Database Cloud belum terhubung di Vercel. Harap atur DB_HOST, DB_USER, DB_PASS, DB_NAME di Vercel Environment Variables.';
        }

        json_response(false, null, $msg, 500);
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
function json_response($success, $data = null, $message = '', $http_code = 200)
{
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
function get_json_input()
{
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

// ==========================================================
// KONFIGURASI AUTENTIKASI ADMIN
// ==========================================================
define('ADMIN_USERNAME', 'adminwater');
define('ADMIN_PASSWORD', '22Febuary$');
define('AUTH_SECRET', getenv('APP_SECRET') ?: 'salam_water_secret_key_2026');

/**
 * Generate Signed Token untuk Sesi Admin (Stateless & Serverless Friendly)
 * @param string $username
 * @return string
 */
function generate_admin_token($username) {
    $payload = base64_encode(json_encode([
        'user' => $username,
        'role' => 'admin',
        'time' => time(),
        'exp'  => time() + (86400 * 7) // Berlaku 7 hari
    ]));
    $signature = hash_hmac('sha256', $payload, AUTH_SECRET);
    return $payload . '.' . $signature;
}

/**
 * Verifikasi Token Admin dari Header Authorization
 * @param string|null $token
 * @return array|false
 */
function verify_admin_token($token = null) {
    if ($token === null) {
        $auth_header = '';
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $auth_header = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $auth_header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $auth_header = $headers['Authorization'] ?? ($headers['authorization'] ?? '');
        }
        if (preg_match('/Bearer\s+(.*)$/i', $auth_header, $matches)) {
            $token = trim($matches[1]);
        }
    }

    if (empty($token)) {
        return false;
    }

    $parts = explode('.', $token);
    if (count($parts) !== 2) {
        return false;
    }

    list($payload_b64, $signature) = $parts;
    $expected_sig = hash_hmac('sha256', $payload_b64, AUTH_SECRET);
    if (!hash_equals($expected_sig, $signature)) {
        return false;
    }

    $data = json_decode(base64_decode($payload_b64), true);
    if (!is_array($data) || empty($data['user']) || $data['user'] !== ADMIN_USERNAME) {
        return false;
    }

    if (isset($data['exp']) && time() > $data['exp']) {
        return false;
    }

    return $data;
}

/**
 * Middleware Proteksi Endpoint: Hanya Admin yang Diizinkan
 * @return array
 */
function require_admin_auth() {
    $auth = verify_admin_token();
    if (!$auth) {
        json_response(false, null, 'Akses ditolak. Silakan login sebagai admin untuk mengakses data ini.', 401);
        exit;
    }
    return $auth;
}
