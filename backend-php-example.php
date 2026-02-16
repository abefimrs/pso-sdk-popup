<?php
/**
 * Backend API - Create Payment Session
 * File: api/create-payment.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Get request body
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Validate required fields
$required = ['customer_name', 'customer_email', 'customer_phone', 'amount', 'order_id'];
foreach ($required as $field) {
    if (empty($data[$field])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => "Missing required field: $field"
        ]);
        exit;
    }
}

// Sanitize inputs
$orderData = [
    'order_id' => sanitize($data['order_id']),
    'customer_name' => sanitize($data['customer_name']),
    'customer_email' => filter_var($data['customer_email'], FILTER_SANITIZE_EMAIL),
    'customer_phone' => sanitize($data['customer_phone']),
    'amount' => floatval($data['amount']),
    'product_name' => sanitize($data['product_name'] ?? 'Product'),
];

// Validate email
if (!filter_var($orderData['customer_email'], FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid email address'
    ]);
    exit;
}

// Validate amount
if ($orderData['amount'] <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid amount'
    ]);
    exit;
}

try {
    // Save order to database
    saveOrder($orderData);
    
    // Create payment session with your gateway
    $paymentUrl = createPaymentSession($orderData);
    
    // Return payment URL
    echo json_encode([
        'success' => true,
        'payment_url' => $paymentUrl,
        'order_id' => $orderData['order_id']
    ]);
    
} catch (Exception $e) {
    error_log('Payment creation error: ' . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create payment session'
    ]);
}

/**
 * Create payment session with gateway
 */
function createPaymentSession($orderData) {
    // EXAMPLE: SSLCommerz Integration
    // Replace with your actual payment gateway
    
    $storeId = 'YOUR_STORE_ID';
    $storePassword = 'YOUR_STORE_PASSWORD';
    $gatewayUrl = 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'; // Sandbox
    // $gatewayUrl = 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'; // Live
    
    $postData = [
        'store_id' => $storeId,
        'store_passwd' => $storePassword,
        'total_amount' => $orderData['amount'],
        'currency' => 'BDT',
        'tran_id' => $orderData['order_id'],
        'success_url' => 'https://yoursite.com/api/payment-success.php',
        'fail_url' => 'https://yoursite.com/api/payment-fail.php',
        'cancel_url' => 'https://yoursite.com/api/payment-cancel.php',
        'ipn_url' => 'https://yoursite.com/api/payment-ipn.php',
        
        // Customer info
        'cus_name' => $orderData['customer_name'],
        'cus_email' => $orderData['customer_email'],
        'cus_phone' => $orderData['customer_phone'],
        'cus_add1' => 'Dhaka',
        'cus_city' => 'Dhaka',
        'cus_country' => 'Bangladesh',
        
        // Product info
        'product_name' => $orderData['product_name'],
        'product_category' => 'General',
        'product_profile' => 'general',
        
        // Shipping info
        'shipping_method' => 'NO',
        'num_of_item' => 1,
    ];
    
    // Call gateway API
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $gatewayUrl);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception('Gateway API error: HTTP ' . $httpCode);
    }
    
    $result = json_decode($response, true);
    
    if ($result['status'] !== 'SUCCESS') {
        throw new Exception('Gateway error: ' . ($result['failedreason'] ?? 'Unknown'));
    }
    
    // Return payment URL
    return $result['GatewayPageURL'];
}

/**
 * Save order to database
 */
function saveOrder($orderData) {
    // TODO: Save to your database
    // Example:
    /*
    $pdo = new PDO('mysql:host=localhost;dbname=yourdb', 'username', 'password');
    
    $stmt = $pdo->prepare("
        INSERT INTO orders (order_id, customer_name, customer_email, customer_phone, amount, product_name, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
    ");
    
    $stmt->execute([
        $orderData['order_id'],
        $orderData['customer_name'],
        $orderData['customer_email'],
        $orderData['customer_phone'],
        $orderData['amount'],
        $orderData['product_name']
    ]);
    */
    
    // For now, just log to file
    error_log('Order saved: ' . json_encode($orderData));
}

/**
 * Sanitize input
 */
function sanitize($value) {
    return htmlspecialchars(strip_tags(trim($value)), ENT_QUOTES, 'UTF-8');
}
