<?php
/**
 * REST API Endpoint: Autentikasi Admin Salam Water
 * File: api/auth.php
 */

require_once __DIR__ . '/../config/database.php';

$action = isset($_GET['action']) ? trim($_GET['action']) : 'check';
$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {
    case 'login':
        handle_login($method);
        break;

    case 'check':
        handle_check();
        break;

    case 'logout':
        handle_logout($method);
        break;

    default:
        json_response(false, null, 'Aksi autentikasi tidak valid. Pilihan: login, check, logout.', 400);
        break;
}

/**
 * Handle Login Admin
 */
function handle_login($method) {
    if ($method !== 'POST') {
        json_response(false, null, 'Metode HTTP harus POST untuk login.', 405);
    }

    $input = get_json_input();
    $username = isset($input['username']) ? trim($input['username']) : '';
    $password = isset($input['password']) ? trim($input['password']) : '';

    if (empty($username) || empty($password)) {
        json_response(false, null, 'Username dan password admin wajib diisi.', 422);
    }

    if ($username === ADMIN_USERNAME && $password === ADMIN_PASSWORD) {
        $token = generate_admin_token($username);
        json_response(true, [
            'token'    => $token,
            'username' => $username,
            'role'     => 'admin',
            'expires'  => date('Y-m-d H:i:s', time() + (86400 * 7))
        ], 'Login admin berhasil! Selamat datang.');
    } else {
        json_response(false, null, 'Username atau password admin salah. Silakan coba lagi.', 401);
    }
}

/**
 * Handle Pemeriksaan Sesi Admin Aktif
 */
function handle_check() {
    $auth = verify_admin_token();
    if ($auth) {
        json_response(true, [
            'is_admin' => true,
            'username' => $auth['user'],
            'role'     => 'admin'
        ], 'Sesi admin aktif.');
    } else {
        json_response(true, [
            'is_admin' => false,
            'role'     => 'guest'
        ], 'Sesi pengguna publik / tamu.');
    }
}

/**
 * Handle Logout Admin
 */
function handle_logout($method) {
    if ($method !== 'POST') {
        json_response(false, null, 'Metode HTTP harus POST untuk logout.', 405);
    }
    json_response(true, null, 'Logout admin berhasil.');
}
