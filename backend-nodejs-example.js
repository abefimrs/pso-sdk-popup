/**
 * Backend API - Node.js/Express Example
 * npm install express cors axios
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend files

// Configuration
const config = {
    storeId: 'YOUR_STORE_ID',
    storePassword: 'YOUR_STORE_PASSWORD',
    gatewayUrl: 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php', // Sandbox
    // gatewayUrl: 'https://securepay.sslcommerz.com/gwprocess/v4/api.php', // Live
    validationUrl: 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php',
    siteUrl: 'http://localhost:3000'
};

/**
 * Create Payment Session
 * POST /api/create-payment
 */
app.post('/api/create-payment', async (req, res) => {
    try {
        const { customer_name, customer_email, customer_phone, amount, product_name, order_id } = req.body;

        // Validate required fields
        if (!customer_name || !customer_email || !customer_phone || !amount || !order_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customer_email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address'
            });
        }

        // Validate amount
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount'
            });
        }

        // Prepare order data
        const orderData = {
            order_id,
            customer_name,
            customer_email,
            customer_phone,
            amount: numAmount,
            product_name: product_name || 'Product',
            status: 'pending',
            created_at: new Date()
        };

        // Save to database
        await saveOrder(orderData);

        // Create payment session with gateway
        const paymentUrl = await createPaymentSession(orderData);

        res.json({
            success: true,
            payment_url: paymentUrl,
            order_id: orderData.order_id
        });

    } catch (error) {
        console.error('Payment creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment session',
            error: error.message
        });
    }
});

/**
 * Verify Payment
 * POST /api/verify-payment
 */
app.post('/api/verify-payment', async (req, res) => {
    try {
        const { transaction_id, order_id } = req.body;

        if (!transaction_id) {
            return res.status(400).json({
                success: false,
                message: 'Transaction ID required'
            });
        }

        // Verify with payment gateway
        const verification = await verifyWithGateway(transaction_id);

        if (verification.status === 'VALID' || verification.status === 'VALIDATED') {
            // Update order status
            await updateOrderStatus(order_id, 'completed', verification);

            res.json({
                success: true,
                message: 'Payment verified',
                order_id,
                transaction_id,
                amount: verification.amount
            });
        } else {
            res.json({
                success: false,
                message: 'Payment verification failed',
                status: verification.status
            });
        }

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Verification error',
            error: error.message
        });
    }
});

/**
 * Payment Success Callback (IPN)
 * POST /api/payment-success
 */
app.post('/api/payment-success', async (req, res) => {
    try {
        console.log('Payment success callback:', req.body);

        const { tran_id, status } = req.body;

        if (status === 'VALID') {
            await updateOrderStatus(tran_id, 'completed', req.body);
        }

        // Send postMessage to parent window
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Payment Success</title></head>
            <body>
                <h2>Payment Successful!</h2>
                <p>Redirecting...</p>
                <script>
                    // Send message to parent window (SDK)
                    if (window.parent !== window) {
                        window.parent.postMessage({
                            status: 'success',
                            event: 'payment_success',
                            transaction_id: '${tran_id}',
                            order_id: '${req.body.tran_id}'
                        }, '*');
                    }
                    
                    // Also redirect after 2 seconds
                    setTimeout(() => {
                        window.location.href = '/success.html?order=${tran_id}';
                    }, 2000);
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Success callback error:', error);
        res.status(500).send('Error processing payment');
    }
});

/**
 * Payment Fail Callback
 * POST /api/payment-fail
 */
app.post('/api/payment-fail', async (req, res) => {
    console.log('Payment failed:', req.body);

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Payment Failed</title></head>
        <body>
            <h2>Payment Failed</h2>
            <script>
                if (window.parent !== window) {
                    window.parent.postMessage({
                        status: 'error',
                        event: 'payment_failed',
                        message: 'Payment failed'
                    }, '*');
                }
            </script>
        </body>
        </html>
    `);
});

/**
 * Payment Cancel Callback
 * POST /api/payment-cancel
 */
app.post('/api/payment-cancel', async (req, res) => {
    console.log('Payment cancelled:', req.body);

    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Payment Cancelled</title></head>
        <body>
            <h2>Payment Cancelled</h2>
            <script>
                if (window.parent !== window) {
                    window.parent.postMessage({
                        status: 'cancel',
                        event: 'payment_cancelled'
                    }, '*');
                }
            </script>
        </body>
        </html>
    `);
});

/**
 * Create payment session with gateway
 */
async function createPaymentSession(orderData) {
    const postData = {
        store_id: config.storeId,
        store_passwd: config.storePassword,
        total_amount: orderData.amount,
        currency: 'BDT',
        tran_id: orderData.order_id,
        success_url: `${config.siteUrl}/api/payment-success`,
        fail_url: `${config.siteUrl}/api/payment-fail`,
        cancel_url: `${config.siteUrl}/api/payment-cancel`,
        ipn_url: `${config.siteUrl}/api/payment-ipn`,

        // Customer info
        cus_name: orderData.customer_name,
        cus_email: orderData.customer_email,
        cus_phone: orderData.customer_phone,
        cus_add1: 'Dhaka',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',

        // Product info
        product_name: orderData.product_name,
        product_category: 'General',
        product_profile: 'general',

        shipping_method: 'NO',
        num_of_item: 1
    };

    const response = await axios.post(config.gatewayUrl, null, {
        params: postData
    });

    if (response.data.status !== 'SUCCESS') {
        throw new Error(response.data.failedreason || 'Gateway error');
    }

    return response.data.GatewayPageURL;
}

/**
 * Verify payment with gateway
 */
async function verifyWithGateway(transactionId) {
    const params = {
        store_id: config.storeId,
        store_passwd: config.storePassword,
        val_id: transactionId,
        format: 'json'
    };

    const response = await axios.get(config.validationUrl, { params });

    return response.data;
}

/**
 * Save order to database
 */
async function saveOrder(orderData) {
    // TODO: Save to your database
    console.log('Saving order:', orderData);
    
    // Example with MongoDB:
    // const db = require('./database');
    // await db.orders.insertOne(orderData);
}

/**
 * Update order status
 */
async function updateOrderStatus(orderId, status, gatewayData) {
    // TODO: Update in your database
    console.log(`Updating order ${orderId} to ${status}`);
    
    // Example with MongoDB:
    // const db = require('./database');
    // await db.orders.updateOne(
    //     { order_id: orderId },
    //     { $set: { status, payment_data: gatewayData, updated_at: new Date() } }
    // );
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/create-payment`);
});
