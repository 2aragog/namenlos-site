<?php
// Audio upload endpoint for namenlos.black admin
// Deploy to amkostiuk.de root via SFTP
// Usage: POST multipart form with file + key fields
// Returns JSON: {"url":"https://amkostiuk.de/namenlos-audio/filename.mp3"}

header('Access-Control-Allow-Origin: https://namenlos.black');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$UPLOAD_KEY = 'nm-audio-2026-x4k'; // change this
$UPLOAD_DIR = __DIR__ . '/namenlos-audio/';
$MAX_SIZE = 30 * 1024 * 1024; // 30MB
$ALLOWED = ['mp3','wav','ogg','m4a','flac','aac'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST only']);
    exit;
}

if (($_POST['key'] ?? '') !== $UPLOAD_KEY) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid key']);
    exit;
}

if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No file']);
    exit;
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Upload error: ' . $file['error']]);
    exit;
}

if ($file['size'] > $MAX_SIZE) {
    http_response_code(400);
    echo json_encode(['error' => 'File too large (max 30MB)']);
    exit;
}

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $ALLOWED)) {
    http_response_code(400);
    echo json_encode(['error' => 'Not allowed: .' . $ext]);
    exit;
}

if (!is_dir($UPLOAD_DIR)) {
    mkdir($UPLOAD_DIR, 0755, true);
}

// Sanitize filename
$name = preg_replace('/[^a-zA-Z0-9_\-]/', '', pathinfo($file['name'], PATHINFO_FILENAME));
$name = $name ?: 'audio_' . time();
$dest = $name . '.' . $ext;

// Don't overwrite
$i = 1;
while (file_exists($UPLOAD_DIR . $dest)) {
    $dest = $name . '_' . $i . '.' . $ext;
    $i++;
}

if (move_uploaded_file($file['tmp_name'], $UPLOAD_DIR . $dest)) {
    $url = 'https://amkostiuk.de/namenlos-audio/' . $dest;
    echo json_encode(['url' => $url, 'name' => $dest, 'size' => $file['size']]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Move failed']);
}
