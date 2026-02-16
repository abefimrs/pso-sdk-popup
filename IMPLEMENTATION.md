# Complete Implementation Guide

## 🏗️ Architecture Overview

```
Frontend (HTML Form)
        ↓
    JavaScript
        ↓
    POST to Backend
        ↓
Backend validates & calls Payment Gateway API
        ↓
Gateway returns payment URL
        ↓
Backend returns URL to Frontend
        ↓
SDK opens URL in modal (iframe)
        ↓
User completes payment
        ↓
Gateway sends postMessage + IPN callback
        ↓
Frontend verifies with Backend
        ↓
Success Page
```

---

## 📁 File Structure

```
project/
├── public/
│   ├── index.html              # Your checkout form (example.html)
│   ├── payment-sdk.js          # Payment modal SDK
│   ├── success.html            # Success page
│   └── css/
│       └── styles.css
├── api/
│   ├── create-payment.php      # Create payment session
│   ├── verify-payment.php      # Verify payment
│   ├── payment-success.php     # IPN success callback
│   ├── payment-fail.php        # IPN fail callback
│   └── payment-cancel.php      # IPN cancel callback
├── config/
│   ├── database.php            # DB configuration
│   └── gateway.php             # Gateway credentials
└── database/
    └── schema.sql              # Database structure
```

---

## 🚀 Step-by-Step Implementation

### **Step 1: Setup Database**

```bash
# Create database
mysql -u root -p

CREATE DATABASE payment_system;
USE payment_system;

# Import schema
SOURCE database-schema.sql;
```

### **Step 2: Configure Gateway Credentials**

Create `config/gateway.php`:

```php
<?php
return [
    'sslcommerz' => [
        'store_id' => 'YOUR_STORE_ID',
        'store_password' => 'YOUR_STORE_PASSWORD',
        'sandbox' => true, // Set false for live
    ],
    'site_url' => 'https://yoursite.com'
];
```

### **Step 3: Setup Backend**

#### Option A: PHP

1. Copy `backend-php-example.php` to `api/create-payment.php`
2. Copy `backend-php-verify.php` to `api/verify-payment.php`
3. Update credentials in both files

#### Option B: Node.js

```bash
# Install dependencies
npm install express cors axios

# Run server
node backend-nodejs-example.js
```

### **Step 4: Setup Frontend**

1. Copy `example.html` to your public directory
2. Copy `payment-sdk.js` to same directory
3. Update `BACKEND_URL` in example.html to your API endpoint

```javascript
const BACKEND_URL = '/api/create-payment.php'; // or http://localhost:3000/api/create-payment
```

### **Step 5: Create IPN Callback Pages**

Create `api/payment-success.php`:

```php
<?php
// Log the callback
file_put_contents('logs/ipn-success.log', date('Y-m-d H:i:s') . ' - ' . json_encode($_POST) . PHP_EOL, FILE_APPEND);

// Get transaction ID
$tran_id = $_POST['tran_id'] ?? '';
$status = $_POST['status'] ?? '';

// Update database
if ($status === 'VALID') {
    // Update order status to completed
    // See backend-php-verify.php for example
}

// Send postMessage to parent window (SDK)
?>
<!DOCTYPE html>
<html>
<head><title>Payment Success</title></head>
<body>
    <h2>✅ Payment Successful!</h2>
    <p>Processing your order...</p>
    <script>
        // Send message to SDK
        if (window.parent !== window) {
            window.parent.postMessage({
                status: 'success',
                event: 'payment_success',
                transaction_id: '<?php echo $tran_id; ?>',
                order_id: '<?php echo $tran_id; ?>'
            }, '*');
        }
        
        // Also redirect
        setTimeout(() => {
            if (window.parent === window) {
                window.location.href = '/success.html?order=<?php echo $tran_id; ?>';
            }
        }, 2000);
    </script>
</body>
</html>
```

Create similar pages for `payment-fail.php` and `payment-cancel.php`.

### **Step 6: Create Success Page**

Create `success.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Payment Success</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
        }
        .success-icon {
            font-size: 80px;
            color: #28a745;
        }
        h1 { color: #333; }
        .order-id {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 20px auto;
            max-width: 400px;
        }
    </style>
</head>
<body>
    <div class="success-icon">✓</div>
    <h1>Payment Successful!</h1>
    <p>Thank you for your payment.</p>
    <div class="order-id">
        <strong>Order ID:</strong> <span id="orderId"></span>
    </div>
    <a href="/" style="color: #007bff;">Return to Home</a>
    
    <script>
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('order');
        document.getElementById('orderId').textContent = orderId || 'N/A';
    </script>
</body>
</html>
```

---

## 🔒 Security Checklist

### Backend Security

✅ **Validate all inputs**
```php
// Sanitize and validate
$email = filter_var($_POST['email'], FILTER_VALIDATE_EMAIL);
$amount = floatval($_POST['amount']);

if (!$email || $amount <= 0) {
    die(json_encode(['success' => false, 'message' => 'Invalid input']));
}
```

✅ **Use prepared statements**
```php
$stmt = $pdo->prepare("INSERT INTO orders (order_id, amount) VALUES (?, ?)");
$stmt->execute([$orderId, $amount]);
```

✅ **Verify payment with gateway**
```php
// NEVER trust client-side payment confirmation
// Always verify with gateway API
$verification = verifyWithGateway($transactionId);
if ($verification['status'] !== 'VALID') {
    // Payment is fake!
    die('Invalid payment');
}
```

✅ **Use HTTPS**
```php
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') {
    header('Location: https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']);
    exit;
}
```

✅ **Add CSRF protection**
```javascript
// Frontend
const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

fetch('/api/create-payment', {
    headers: {
        'X-CSRF-TOKEN': csrfToken
    }
});
```

### SDK Security

✅ **Validate postMessage origin**

Update `payment-sdk.js` line 190:

```javascript
_handleMessage(event) {
    // Only accept messages from your payment gateway
    const allowedOrigins = [
        'https://sandbox.sslcommerz.com',
        'https://securepay.sslcommerz.com',
        'https://yoursite.com'
    ];
    
    if (!allowedOrigins.includes(event.origin)) {
        console.warn('Message from unauthorized origin:', event.origin);
        return;
    }
    
    // ... rest of code
}
```

---

## 🧪 Testing

### Test Payment (SSLCommerz Sandbox)

**Test Cards:**
- **VISA:** `4111111111111111`
- **MasterCard:** `5500000000000004`
- **AMEX:** `340000000000009`

**CVV:** Any 3 digits  
**Expiry:** Any future date

### Test Flow

1. Fill checkout form
2. Click "Proceed to Payment"
3. Modal opens with gateway page
4. Enter test card details
5. Complete payment
6. Verify success callback
7. Check database for order status

---

## 📊 Database Queries

### Check order status
```sql
SELECT * FROM orders WHERE order_id = 'ORD-1234';
```

### Get today's revenue
```sql
SELECT SUM(amount) as revenue 
FROM orders 
WHERE status = 'completed' 
  AND DATE(created_at) = CURDATE();
```

### Failed payments report
```sql
SELECT * FROM orders 
WHERE status = 'failed' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🐛 Troubleshooting

### Payment modal not opening

Check browser console for errors:
```javascript
// Enable debug mode
const payment = new PaymentSDK({ debug: true });
```

### Backend not receiving data

Check CORS headers:
```php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
```

### Payment verification failing

Enable logging:
```php
error_log('Verification response: ' . json_encode($result));
```

### IPN callbacks not working

1. Check callback URLs are publicly accessible
2. Verify gateway has correct callback URLs
3. Check server logs for incoming requests

---

## 🚀 Going Live

1. **Get Production Credentials**
   - Register with payment gateway
   - Get live store ID and password

2. **Update URLs**
   ```php
   $gatewayUrl = 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';
   ```

3. **Enable HTTPS**
   - Install SSL certificate
   - Force HTTPS redirect

4. **Test thoroughly**
   - Test with small real amounts
   - Verify IPN callbacks work
   - Check database updates

5. **Monitor**
   - Set up error logging
   - Monitor failed payments
   - Track success rates

---

## 📞 Support

- **SSLCommerz Docs:** https://developer.sslcommerz.com/
- **Sandbox:** https://sandbox.sslcommerz.com/
- **Support:** support@sslcommerz.com
