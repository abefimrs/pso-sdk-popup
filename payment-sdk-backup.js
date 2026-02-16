/**
 * Payment Gateway SDK
 * Opens payment gateway in modal popup instead of redirect
 */
(function(window) {
    'use strict';

    // Modal CSS - SSLCommerz style
    const modalStyles = `
        .payment-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            z-index: 999999;
            align-items: center;
            justify-content: center;
        }
        
        .payment-modal-overlay.active {
            display: flex;
        }
        
        .payment-modal {
            position: relative;
            background: #fff;
            width: 100%;
            height: 100%;
            max-width: 900px;
            max-height: 95vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 0 50px rgba(0,0,0,0.5);
            animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
            from {
                transform: translateY(-50px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        .payment-modal-close {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.5);
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #fff;
            padding: 0;
            width: 36px;
            height: 36px;
            line-height: 36px;
            text-align: center;
            border-radius: 50%;
            z-index: 10;
            transition: background 0.2s;
        }
        
        .payment-modal-close:hover {
            background: rgba(0, 0, 0, 0.8);
        }
        
        .payment-modal-body {
            flex: 1;
            position: relative;
            overflow: hidden;
            background: #fff;
        }
        
        .payment-modal-iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        }
        
        .payment-modal-loader {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            z-index: 1;
        }
        
        .payment-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .payment-loader-text {
            color: #666;
            font-size: 14px;
        }
        
        /* Mobile responsiveness */
        @media (max-width: 768px) {
            .payment-modal {
                width: 100%;
                height: 100%;
                max-width: 100%;
                max-height: 100%;
                border-radius: 0;
            }
            
            .payment-modal-header {
                border-radius: 0;
            }
        }
    `;

    // Inject styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = modalStyles;
    document.head.appendChild(styleSheet);

    // Main SDK class
    class PaymentSDK {
        constructor(options = {}) {
            this.options = {
                title: options.title || 'Complete Payment',
                closeOnSuccess: options.closeOnSuccess !== false,
                allowClose: options.allowClose !== false,
                onSuccess: options.onSuccess || null,
                onError: options.onError || null,
                onClose: options.onClose || null,
                debug: options.debug || false
            };

            this.modal = null;
            this.iframe = null;
            this.isOpen = false;

            this._createModal();
            this._bindEvents();
        }

        _log(...args) {
            if (this.options.debug) {
                console.log('[PaymentSDK]', ...args);
            }
        }

        _createModal() {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'payment-modal-overlay';
            overlay.innerHTML = `
                <div class="payment-modal">
                    <button class="payment-modal-close" aria-label="Close">&times;</button>
                    <div class="payment-modal-body">
                        <div class="payment-modal-loader">
                            <div class="payment-spinner"></div>
                            <div class="payment-loader-text">Loading payment gateway...</div>
                        </div>
                        <iframe class="payment-modal-iframe" style="display:none;" allow="payment" sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation allow-popups allow-popups-to-escape-sandbox"></iframe>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Store references
            this.modal = overlay;
            this.modalContent = overlay.querySelector('.payment-modal');
            this.iframe = overlay.querySelector('.payment-modal-iframe');
            this.loader = overlay.querySelector('.payment-modal-loader');
            this.closeBtn = overlay.querySelector('.payment-modal-close');

            // Hide close button if not allowed
            if (!this.options.allowClose) {
                this.closeBtn.style.display = 'none';
            }
        }

        _bindEvents() {
            // Close button
            this.closeBtn.addEventListener('click', () => {
                if (this.options.allowClose) {
                    this.close();
                }
            });

            // Close on overlay click
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal && this.options.allowClose) {
                    this.close();
                }
            });

            // Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen && this.options.allowClose) {
                    this.close();
                }
            });

            // Listen for messages from iframe
            window.addEventListener('message', (e) => {
                this._handleMessage(e);
            });

            // Iframe load event
            this.iframe.addEventListener('load', () => {
                this._log('Iframe loaded');
                this.loader.style.display = 'none';
                this.iframe.style.display = 'block';
            });
        }

        _handleMessage(event) {
            // TODO: Add origin validation for security
            // if (event.origin !== 'https://your-gateway.com') return;

            this._log('Received message:', event.data);

            let data;
            try {
                data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            } catch (e) {
                this._log('Invalid message format', event.data);
                return;
            }

            // Handle success
            if (data.status === 'success' || data.event === 'payment_success') {
                this._log('Payment successful', data);
                
                if (this.options.onSuccess) {
                    this.options.onSuccess(data);
                }

                if (this.options.closeOnSuccess) {
                    this.close();
                }
            }

            // Handle error/failure
            if (data.status === 'error' || data.status === 'failed' || data.event === 'payment_failed') {
                this._log('Payment failed', data);
                
                if (this.options.onError) {
                    this.options.onError(data);
                }
            }

            // Handle cancel
            if (data.status === 'cancel' || data.event === 'payment_cancelled') {
                this._log('Payment cancelled', data);
                this.close();
            }

            // Handle redirect (if gateway wants to redirect parent)
            if (data.redirect && data.url) {
                this._log('Redirecting to:', data.url);
                window.location.href = data.url;
            }
        }

        /**
         * Open payment modal with gateway URL
         * @param {string} paymentUrl - The payment gateway URL
         */
        open(paymentUrl) {
            if (!paymentUrl) {
                console.error('[PaymentSDK] Payment URL is required');
                return;
            }

            this._log('Opening payment modal:', paymentUrl);

            // Reset state
            this.loader.style.display = 'block';
            this.iframe.style.display = 'none';
            
            // Load payment page in iframe
            this.iframe.src = paymentUrl;
            
            // Show modal
            this.modal.classList.add('active');
            this.isOpen = true;

            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }

        /**
         * Close the payment modal
         */
        close() {
            this._log('Closing payment modal');

            this.modal.classList.remove('active');
            this.isOpen = false;

            // Restore body scroll
            document.body.style.overflow = '';

            // Clear iframe
            setTimeout(() => {
                this.iframe.src = 'about:blank';
            }, 300);

            // Call onClose callback
            if (this.options.onClose) {
                this.options.onClose();
            }
        }

        /**
         * Destroy the modal and cleanup
         */
        destroy() {
            this._log('Destroying payment modal');
            
            if (this.modal && this.modal.parentNode) {
                this.modal.parentNode.removeChild(this.modal);
            }
            
            this.modal = null;
            this.iframe = null;
            this.isOpen = false;
        }
    }

    // Expose to window
    window.PaymentSDK = PaymentSDK;

})(window);
