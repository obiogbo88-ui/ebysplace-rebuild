<?php
declare(strict_types=1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}

$apiKey = getenv('OPENAI_API_KEY');
if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error.']);
    exit;
}

$prompt = isset($_POST['prompt']) ? trim((string) $_POST['prompt']) : '';
if ($prompt === '') {
    http_response_code(422);
    echo json_encode(['error' => 'A prompt is required.']);
    exit;
}

if (!isset($_FILES['image']['tmp_name']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
    http_response_code(422);
    echo json_encode(['error' => 'Uploaded portrait image is required.']);
    exit;
}

if (!isset($_FILES['mask']['tmp_name']) || !is_uploaded_file($_FILES['mask']['tmp_name'])) {
    http_response_code(422);
    echo json_encode(['error' => 'Hair edit mask is required.']);
    exit;
}

$imageFile = new CURLFile(
    $_FILES['image']['tmp_name'],
    $_FILES['image']['type'] ?: 'image/png',
    $_FILES['image']['name'] ?: 'portrait.png'
);
$maskFile = new CURLFile(
    $_FILES['mask']['tmp_name'],
    $_FILES['mask']['type'] ?: 'image/png',
    $_FILES['mask']['name'] ?: 'hair-mask.png'
);

$ch = curl_init('https://api.openai.com/v1/images/edits');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 90);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $apiKey,
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, [
    'model' => 'gpt-image-1',
    'image' => $imageFile,
    'mask' => $maskFile,
    'prompt' => $prompt,
    'size' => '1024x1024',
    'response_format' => 'b64_json',
]);

$rawResponse = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($rawResponse === false || $curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'Generation service unavailable.']);
    exit;
}

$data = json_decode($rawResponse, true);
if ($status >= 400) {
    $message = 'Image generation failed.';
    if (is_array($data) && isset($data['error']['message']) && is_string($data['error']['message'])) {
        $message = $data['error']['message'];
    }
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

$base64Image = $data['data'][0]['b64_json'] ?? null;
if (!is_string($base64Image) || $base64Image === '') {
    http_response_code(502);
    echo json_encode(['error' => 'Invalid image response from generation service.']);
    exit;
}

echo json_encode([
    'generatedImageUrl' => 'data:image/png;base64,' . $base64Image,
]);
