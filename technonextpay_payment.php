<?php
/**
 * TechnonextPay Payment Handler
 * Modified to work with Payment SDK (returns JSON with payment_url)
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

// If not JSON, try POST data
if (!$data) {
    $data = $_POST;
}

// Log received data for debugging
error_log('Payment request received: ' . json_encode($data));

// Validate required fields
$required = ['customer_name', 'contact_number', 'payable_amount'];
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

// Sanitize and prepare data
$paymentData = [
    // Order Info
    'order_id' => $data['order_id'] ?? ('ORD-' . time()),
    
    // Payment Info
    'currency_code' => sanitize($data['currency_code'] ?? 'BDT'),
    'payable_amount' => floatval($data['payable_amount']),
    'product_amount' => floatval($data['product_amount'] ?? $data['payable_amount']),
    'preferred_channel' => sanitize($data['preferred_channel'] ?? 'VISA'),
    'discount_amount' => floatval($data['discount_amount'] ?? 0),
    'disc_percent' => floatval($data['disc_percent'] ?? 0),
    'allowed_bin' => sanitize($data['allowed_bin'] ?? ''),
    
    // Customer Info
    'customer_name' => sanitize($data['customer_name']),
    'contact_number' => sanitize($data['contact_number']),
    'customer_email' => sanitize($data['customer_email'] ?? ''),
    'customer_primaryAddress' => sanitize($data['customer_primaryAddress'] ?? 'Dhaka'),
    'customer_secondaryAddress' => sanitize($data['customer_secondaryAddress'] ?? ''),
    'customer_city' => sanitize($data['customer_city'] ?? 'Dhaka'),
    'customer_state' => sanitize($data['customer_state'] ?? 'Dhaka'),
    'customer_postcode' => sanitize($data['customer_postcode'] ?? '1207'),
    'customer_country' => sanitize($data['customer_country'] ?? 'Bangladesh'),
    
    // Shipping Info
    'shipping_address' => sanitize($data['shipping_address'] ?? $data['customer_primaryAddress'] ?? 'Dhaka'),
    'shipping_city' => sanitize($data['shipping_city'] ?? $data['customer_city'] ?? 'Dhaka'),
    'shipping_country' => sanitize($data['shipping_country'] ?? $data['customer_country'] ?? 'Bangladesh'),
    'received_person_name' => sanitize($data['received_person_name'] ?? $data['customer_name']),
    'shipping_phone_number' => sanitize($data['shipping_phone_number'] ?? $data['contact_number']),
    
    // MDF Values
    'mdf1' => sanitize($data['mdf1'] ?? ''),
    'mdf2' => sanitize($data['mdf2'] ?? ''),
    'mdf3' => sanitize($data['mdf3'] ?? ''),
    'mdf4' => sanitize($data['mdf4'] ?? ''),
];

// Validate email if provided
if (!empty($paymentData['customer_email'])) {
    if (!filter_var($paymentData['customer_email'], FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid email address'
        ]);
        exit;
    }
}

// Validate amount
if ($paymentData['payable_amount'] <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid amount'
    ]);
    exit;
}

try {
    // Save order to database (if you have one)
    // saveOrderToDatabase($paymentData);
    
    // Create payment session with your gateway
    $paymentUrl = createPaymentSession($paymentData);
    
    // Return success response with payment URL
    echo json_encode([
        'success' => true,
        'payment_url' => $paymentUrl,
        'order_id' => $paymentData['order_id'],
        'amount' => $paymentData['payable_amount']
    ]);
    
} catch (Exception $e) {
    error_log('Payment creation error: ' . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to create payment session: ' . $e->getMessage()
    ]);
}

/**
 * Create payment session with gateway
 * REPLACE THIS WITH YOUR ACTUAL GATEWAY INTEGRATION
 */
function createPaymentSession($paymentData) {
    // TODO: Replace with your actual gateway credentials and endpoint
    
    // EXAMPLE: SSLCommerz Integration
    $storeId = 'YOUR_STORE_ID';
    $storePassword = 'YOUR_STORE_PASSWORD';
    $gatewayUrl = 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'; // Sandbox
    // $gatewayUrl = 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'; // Live
    
    $siteUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'];
    
    $postData = [
        'store_id' => $storeId,
        'store_passwd' => $storePassword,
        'total_amount' => $paymentData['payable_amount'],
        'currency' => $paymentData['currency_code'],
        'tran_id' => $paymentData['order_id'],
        
        // Callback URLs
        'success_url' => $siteUrl . '/payment-success.php',
        'fail_url' => $siteUrl . '/payment-fail.php',
        'cancel_url' => $siteUrl . '/payment-cancel.php',
        'ipn_url' => $siteUrl . '/payment-ipn.php',
        
        // Customer info
        'cus_name' => $paymentData['customer_name'],
        'cus_email' => $paymentData['customer_email'] ?: 'customer@example.com',
        'cus_add1' => $paymentData['customer_primaryAddress'],
        'cus_add2' => $paymentData['customer_secondaryAddress'],
        'cus_city' => $paymentData['customer_city'],
        'cus_state' => $paymentData['customer_state'],
        'cus_postcode' => $paymentData['customer_postcode'],
        'cus_country' => $paymentData['customer_country'],
        'cus_phone' => $paymentData['contact_number'],
        
        // Shipping info
        'shipping_method' => 'YES',
        'ship_name' => $paymentData['received_person_name'],
        'ship_add1' => $paymentData['shipping_address'],
        'ship_city' => $paymentData['shipping_city'],
        'ship_country' => $paymentData['shipping_country'],
        'ship_postcode' => $paymentData['customer_postcode'],
        
        // Product info
        'product_name' => 'Order ' . $paymentData['order_id'],
        'product_category' => 'General',
        'product_profile' => 'general',
        'num_of_item' => 1,
        
        // Value added fields
        'value_a' => $paymentData['mdf1'],
        'value_b' => $paymentData['mdf2'],
        'value_c' => $paymentData['mdf3'],
        'value_d' => $paymentData['mdf4'],
    ];
    
    // Add optional fields if provided
    if (!empty($paymentData['allowed_bin'])) {
        $postData['allowed_bin'] = $paymentData['allowed_bin'];
    }
    
    if (!empty($paymentData['discount_amount'])) {
        $postData['discount_amount'] = $paymentData['discount_amount'];
    }
    
    if (!empty($paymentData['disc_percent'])) {
        $postData['disc_percent'] = $paymentData['disc_percent'];
    }
    
    // Call gateway API
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $gatewayUrl);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Remove in production
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception('Gateway connection error: ' . $error);
    }
    
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception('Gateway API error: HTTP ' . $httpCode);
    }
    
    $result = json_decode($response, true);
    
    if (!$result) {
        throw new Exception('Invalid gateway response');
    }
    
    error_log('Gateway response: ' . json_encode($result));
    
    if ($result['status'] !== 'SUCCESS') {
        throw new Exception('Gateway error: ' . ($result['failedreason'] ?? 'Unknown error'));
    }
    
    // Return payment URL
    return $result['GatewayPageURL'];
}

/**
 * Save order to database (optional)
 */
function saveOrderToDatabase($paymentData) {
    // TODO: Implement database save
    /*
    $pdo = new PDO('mysql:host=localhost;dbname=yourdb', 'username', 'password');
    
    $stmt = $pdo->prepare("
        INSERT INTO orders (
            order_id, amount, currency, customer_name, customer_email, 
            customer_phone, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
    ");
    
    $stmt->execute([
        $paymentData['order_id'],
        $paymentData['payable_amount'],
        $paymentData['currency_code'],
        $paymentData['customer_name'],
        $paymentData['customer_email'],
        $paymentData['contact_number']
    ]);
    */
    
    error_log('Order saved: ' . $paymentData['order_id']);
}

/**
 * Sanitize input
 */
function sanitize($value) {
    return htmlspecialchars(strip_tags(trim($value)), ENT_QUOTES, 'UTF-8');
}
