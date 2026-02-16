<?php
/**
 * Backend API - Verify Payment
 * File: api/verify-payment.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (empty($data['transaction_id'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Transaction ID required'
    ]);
    exit;
}

try {
    // Verify with payment gateway
    $verification = verifyWithGateway($data['transaction_id']);
    
    if ($verification['status'] === 'VALID' || $verification['status'] === 'VALIDATED') {
        // Update order status in database
        updateOrderStatus($data['transaction_id'], 'completed', $verification);
        
        echo json_encode([
            'success' => true,
            'message' => 'Payment verified',
            'order_id' => $data['order_id'],
            'transaction_id' => $data['transaction_id'],
            'amount' => $verification['amount']
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Payment verification failed',
            'status' => $verification['status']
        ]);
    }
    
} catch (Exception $e) {
    error_log('Verification error: ' . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Verification error'
    ]);
}

/**
 * Verify payment with gateway
 */
function verifyWithGateway($transactionId) {
    // EXAMPLE: SSLCommerz Validation
    
    $storeId = 'YOUR_STORE_ID';
    $storePassword = 'YOUR_STORE_PASSWORD';
    $validationUrl = 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
    // $validationUrl = 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'; // Live
    
    $params = [
        'store_id' => $storeId,
        'store_passwd' => $storePassword,
        'val_id' => $transactionId,
        'format' => 'json'
    ];
    
    $url = $validationUrl . '?' . http_build_query($params);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $result = json_decode($response, true);
    
    if (!$result) {
        throw new Exception('Invalid gateway response');
    }
    
    return $result;
}

/**
 * Update order status in database
 */
function updateOrderStatus($transactionId, $status, $gatewayData) {
    // TODO: Update your database
    /*
    $pdo = new PDO('mysql:host=localhost;dbname=yourdb', 'username', 'password');
    
    $stmt = $pdo->prepare("
        UPDATE orders 
        SET status = ?, 
            transaction_id = ?,
            payment_data = ?,
            updated_at = NOW()
        WHERE order_id = ?
    ");
    
    $stmt->execute([
        $status,
        $transactionId,
        json_encode($gatewayData),
        $gatewayData['tran_id']
    ]);
    */
    
    error_log("Order updated: $transactionId -> $status");
}
