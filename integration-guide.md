# Payment SDK Integration Guide

## 🚀 Quick Start

### 1. Include the SDK

```html
<script src="payment-sdk.js"></script>
```

### 2. Initialize

```javascript
const payment = new PaymentSDK({
    title: 'Complete Payment',
    onSuccess: (data) => {
        console.log('Payment successful!', data);
        // Verify and update order
    },
    onError: (data) => {
        console.log('Payment failed!', data);
    }
});
```

### 3. Open Payment Modal

```javascript
// When user clicks "Pay Now"
payment.open('https://your-gateway.com/pay/ORDER_ID');
```

---

## 📖 Complete Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Checkout</title>
</head>
<body>
    <button id="payBtn">Pay $99.99</button>

    <script src="payment-sdk.js"></script>
    <script>
        // Initialize SDK
        const payment = new PaymentSDK({
            title: 'Secure Payment',
            debug: true,
            
            onSuccess: function(data) {
                // Payment completed
                fetch('/verify-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transaction_id: data.transaction_id,
                        order_id: data.order_id
                    })
                })
                .then(response => response.json())
                .then(result => {
                    if (result.verified) {
                        window.location.href = '/success';
                    }
                });
            },
            
            onError: function(data) {
                alert('Payment failed: ' + data.message);
            }
        });

        // Trigger payment on button click
        document.getElementById('payBtn').addEventListener('click', async () => {
            // Get payment URL from your backend
            const response = await fetch('/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: 99.99,
                    order_id: 'ORD-12345'
                })
            });
            
            const { payment_url } = await response.json();
            
            // Open in modal
            payment.open(payment_url);
        });
    </script>
</body>
</html>
```

---

## ⚙️ Configuration Options

```javascript
new PaymentSDK({
    title: 'Complete Payment',          // Modal title
    closeOnSuccess: true,                // Auto-close on success
    allowClose: true,                    // Show close button
    debug: false,                        // Enable console logs
    
    onSuccess: function(data) {},        // Success callback
    onError: function(data) {},          // Error callback
    onClose: function() {}               // Modal close callback
})
```

---

## 📡 PostMessage Protocol

Your payment gateway page should send messages to the parent window:

### Success Message
```javascript
window.parent.postMessage({
    status: 'success',
    event: 'payment_success',
    transaction_id: 'TXN123456',
    order_id: 'ORD-12345',
    amount: 99.99
}, '*');
```

### Error Message
```javascript
window.parent.postMessage({
    status: 'error',
    event: 'payment_failed',
    message: 'Card declined'
}, '*');
```

### Cancel Message
```javascript
window.parent.postMessage({
    status: 'cancel',
    event: 'payment_cancelled'
}, '*');
```

### Redirect Request
```javascript
window.parent.postMessage({
    redirect: true,
    url: 'https://yoursite.com/success'
}, '*');
```

---

## 🔒 Security Best Practices

### 1. Origin Validation
Add origin check in SDK (line 190):
```javascript
_handleMessage(event) {
    // Validate origin
    if (event.origin !== 'https://your-gateway.com') {
        console.warn('Message from unauthorized origin:', event.origin);
        return;
    }
    // ... rest of code
}
```

### 2. Server-Side Verification
**Never trust client-side payment confirmations!**

```javascript
onSuccess: async function(data) {
    // Always verify on backend
    const response = await fetch('/verify-payment', {
        method: 'POST',
        body: JSON.stringify({
            transaction_id: data.transaction_id
        })
    });
    
    const result = await response.json();
    
    if (result.status === 'verified') {
        // Payment is legitimate
        window.location.href = '/success';
    } else {
        alert('Payment verification failed');
    }
}
```

### 3. HTTPS Only
Always use HTTPS for payment pages.

---

## 🎨 Customization

### Custom Styling
Override CSS classes:
```css
.payment-modal {
    max-width: 600px !important;
    border-radius: 16px !important;
}

.payment-modal-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
}
```

### Add Logo
Modify the SDK header:
```javascript
<div class="payment-modal-header">
    <img src="logo.png" height="30">
    <h3 class="payment-modal-title">${this.options.title}</h3>
    <button class="payment-modal-close">&times;</button>
</div>
```

---

## 📱 Mobile Support

The SDK is fully responsive:
- On desktop: Shows centered modal
- On mobile: Full-screen modal
- Touch-friendly close buttons
- Prevents body scroll when open

---

## 🛠️ API Reference

### Methods

#### `open(paymentUrl)`
Opens the payment modal with the specified URL.
```javascript
payment.open('https://gateway.com/pay/12345');
```

#### `close()`
Closes the payment modal.
```javascript
payment.close();
```

#### `destroy()`
Removes the modal from DOM and cleans up.
```javascript
payment.destroy();
```

---

## 🔄 Backend Integration Flow

```
1. User clicks "Pay Now"
        ↓
2. Frontend calls your /create-payment endpoint
        ↓
3. Backend calls payment gateway API
        ↓
4. Gateway returns payment_url
        ↓
5. Frontend opens payment_url in SDK modal
        ↓
6. User completes payment on gateway page
        ↓
7. Gateway sends postMessage to parent
        ↓
8. SDK triggers onSuccess callback
        ↓
9. Frontend calls your /verify-payment endpoint
        ↓
10. Backend verifies with gateway
        ↓
11. Redirect to success page
```

---

## 🐛 Debugging

Enable debug mode:
```javascript
const payment = new PaymentSDK({
    debug: true  // Shows all console logs
});
```

Check browser console for:
- `[PaymentSDK] Opening payment modal: ...`
- `[PaymentSDK] Received message: ...`
- `[PaymentSDK] Payment successful: ...`

---

## 📞 Support

For issues or questions, check:
1. Browser console for errors
2. Network tab for failed requests
3. postMessage communication format
