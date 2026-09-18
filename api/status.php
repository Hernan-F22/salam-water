<?php

/**
 * Diagnostic Endpoint: Cek Status Koneksi Database di Vercel / Local
 * File: api/status.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/database.php';

$response = [
    'app'         => 'Salam Water',
    'environment' => get_config_env('VERCEL') ? 'Vercel Serverless' : 'Local / Standalone',
    'php_version' => PHP_VERSION,
    'ca_cert_exists' => file_exists(__DIR__ . '/../config/cacert.pem'),
    'db_config'   => [
        'host' => $db_host,
        'port' => $db_port,
        'name' => $db_name,
        'user' => !empty($db_user) ? substr($db_user, 0, 4) . '***' : '(empty)',
        'pass_set' => !empty($db_pass),
        'ssl'  => $db_ssl ?: 'auto'
    ],
    'connection' => [
        'connected' => false,
        'message'   => '',
        'tables'    => []
    ]
];

try {
    $dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT            => 5
    ];

    $host_lower = strtolower($db_host);
    $is_cloud = ($db_ssl === 'true' || $db_ssl === '1'
        || (int)$db_port === 4000
        || strpos($host_lower, 'tidbcloud.com') !== false
        || strpos($host_lower, 'aivencloud.com') !== false
        || strpos($host_lower, 'rlwy.net') !== false);

    if ($is_cloud) {
        $ca_file = __DIR__ . '/../config/cacert.pem';
        if (file_exists($ca_file)) {
            $options[PDO::MYSQL_ATTR_SSL_CA] = $ca_file;
        }
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
    }

    $test_pdo = new PDO($dsn, $db_user, $db_pass, $options);
    $stmt = $test_pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $response['connection']['connected'] = true;
    $response['connection']['message'] = 'Koneksi database berhasil!';
    $response['connection']['tables'] = $tables;
} catch (Exception $e) {
    $response['connection']['connected'] = false;
    $response['connection']['message'] = $e->getMessage();
}

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
