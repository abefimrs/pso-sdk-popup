/**
 * Payment Gateway SDK - MODIFIED VERSION
 * Opens payment gateway in modal popup instead of redirect
 * 
 * MODIFICATIONS:
 * - Removed iframe background (transparent)
 * - All redirects go to parent window (not iframe)
 * - OTP redirects open in main page
 * - Only popup close button works (iframe buttons hidden)
 * - Better cross-origin handling
 */
(function(window) {
    'use strict';

    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIPhone = /iPhone/i.test(navigator.userAgent);
    
    // Modal CSS - Enhanced for transparent iframe
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
            max-width: ${isMobile ? '100%' : '900px'};
            max-height: ${isMobile ? '100%' : '95vh'};
            display: flex;
            flex-direction: column;
            box-shadow: 0 0 50px rgba(0,0,0,0.5);
            animation: slideIn 0.3s ease-out;
            border-radius: ${isMobile ? '0' : '8px'};
            overflow: hidden;
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
        
        .payment-modal-content {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            padding: 20px;
            display: none;
            background: #fff;
        }
        
        .payment-modal-content.active {
            display: block;
        }
        
        .payment-modal-iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
            background: transparent !important;
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
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .payment-loader-text {
            margin-top: 15px;
            color: #666;
            font-size: 14px;
        }
        
        @media (max-width: 768px) {
            .payment-modal {
                width: 100%;
                height: 100%;
                max-width: 100%;
                max-height: 100%;
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
                debug: options.debug || false,
                autoResize: options.autoResize !== false,
                minHeight: options.minHeight || 400,
                maxHeight: options.maxHeight || (isMobile ? window.innerHeight : window.innerHeight - 100),
                // NEW: Option to force all redirects to parent window
                forceParentRedirect: options.forceParentRedirect !== false
            };

            this.modal = null;
            this.iframe = null;
            this.contentDiv = null;
            this.isOpen = false;
            this.isMobile = isMobile;
            this.isIPhone = isIPhone;

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
                        <iframe 
                            class="payment-modal-iframe" 
                            style="display:none;" 
                            allow="payment" 
                            allowtransparency="true"
                            sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation allow-popups allow-popups-to-escape-sandbox">
                        </iframe>
                        <div class="payment-modal-content"></div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Store references
            this.modal = overlay;
            this.modalContent = overlay.querySelector('.payment-modal');
            this.iframe = overlay.querySelector('.payment-modal-iframe');
            this.contentDiv = overlay.querySelector('.payment-modal-content');
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
                
                // Try to inject CSS to hide gateway's close buttons (only works if same-origin)
                this._tryInjectIframeStyles();
            });
        }

        /**
         * NEW: Try to inject CSS into iframe to hide unwanted elements
         * Only works for same-origin iframes
         */
        _tryInjectIframeStyles() {
            try {
                const iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;
                if (iframeDoc) {
                    const style = iframeDoc.createElement('style');
                    style.textContent = `
                        /* Hide common close button classes */
                        .close-button, 
                        .btn-close, 
                        .modal-close,
                        [aria-label*="Close"],
                        [data-dismiss="modal"] {
                            display: none !important;
                        }
                        /* Make body background transparent */
                        body {
                            background: transparent !important;
                        }
                    `;
                    iframeDoc.head.appendChild(style);
                    this._log('Successfully injected iframe styles');
                }
            } catch (e) {
                // Cross-origin - can't modify iframe content
                this._log('Cannot inject CSS into cross-origin iframe (expected for payment gateways)');
            }
        }

        /**
         * MODIFIED: Handle messages from iframe with parent window redirects
         */
        _handleMessage(event) {
            console.log("EVENT: "+event);
            this._log('Event Triggered');
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

            // Check for any redirect URL in the message (priority handling)
            const redirectUrl = data.url || data.redirectUrl || data.redirect_url || 
                               data.gateway_url || data.gatewayUrl || data.GatewayPageURL ||
                               data.otp_url || data.otpUrl; // Added OTP URL detection
            
            // NEW: Handle OTP redirect - ALWAYS redirect parent window, not iframe
            if (data.type === 'otp_redirect' || data.event === 'otp_required') {
                if (redirectUrl) {
                    this._log('OTP redirect detected - redirecting PARENT window to:', redirectUrl);
                    this.close(); // Close modal properly
                    window.top.location.href = redirectUrl; // Redirect main window
                    return;
                }
            }

            // MODIFIED: Handle redirect types - redirect PARENT window
            if (data.type === 'redirect' || data.type === 'gw_redirect') {
                if (redirectUrl) {
                    this._log('Gateway redirect - redirecting PARENT window to:', redirectUrl);
                    this.close();
                    // Use window.top to ensure parent window redirect
                    if (this.options.forceParentRedirect) {
                        window.top.location.href = redirectUrl;
                    } else {
                        window.location.href = redirectUrl;
                    }
                }
                return;
            }

            // MODIFIED: Handle explicit redirect flag - redirect PARENT window
            if (data.redirect === true || data.redirect === 1) {
                if (redirectUrl) {
                    this._log('Explicit redirect flag - redirecting PARENT window to:', redirectUrl);
                    this.close();
                    if (this.options.forceParentRedirect) {
                        window.top.location.href = redirectUrl;
                    } else {
                        window.location.href = redirectUrl;
                    }
                    return;
                }
            }

            // Handle auto-resize
            if (data.type === 'resize' && data.height && this.options.autoResize) {
                this._handleResize(data.height);
                return;
            }

            // Handle OTP/HTML content injection (for in-modal OTP)
            if (data.type === 'otp' && data.data) {
                this._injectContent(data.data);
                return;
            }

            // MODIFIED: Handle success with automatic redirect to PARENT window
            if (data.status === 'success' || data.event === 'payment_success') {
                this._log('Payment successful', data);
                
                // Auto-redirect if URL is provided - redirect PARENT window
                if (redirectUrl && redirectUrl.indexOf('http') !== -1) {
                    this._log('Success - redirecting PARENT window to:', redirectUrl);
                    this.close();
                    if (this.options.forceParentRedirect) {
                        window.top.location.href = redirectUrl;
                    } else {
                        window.location.href = redirectUrl;
                    }
                    return;
                }
                
                if (this.options.onSuccess) {
                    this.options.onSuccess(data);
                }

                if (this.options.closeOnSuccess) {
                    this.close();
                }
                return;
            }

            // MODIFIED: Handle error/failure with potential redirect to PARENT window
            if (data.status === 'error' || data.status === 'failed' || data.event === 'payment_failed') {
                this._log('Payment failed', data);
                
                // Some gateways redirect even on failure - redirect PARENT window
                if (redirectUrl && redirectUrl.indexOf('http') !== -1) {
                    this._log('Error - redirecting PARENT window to:', redirectUrl);
                    this.close();
                    if (this.options.forceParentRedirect) {
                        window.top.location.href = redirectUrl;
                    } else {
                        window.location.href = redirectUrl;
                    }
                    return;
                }
                
                if (this.options.onError) {
                    this.options.onError(data);
                }
                return;
            }

            // MODIFIED: Handle cancel with potential redirect to PARENT window
            if (data.status === 'cancel' || data.event === 'payment_cancelled') {
                this._log('Payment cancelled', data);
                
                // Check if there's a cancel redirect URL - redirect PARENT window
                if (redirectUrl && redirectUrl.indexOf('http') !== -1) {
                    this._log('Cancel - redirecting PARENT window to:', redirectUrl);
                    this.close();
                    if (this.options.forceParentRedirect) {
                        window.top.location.href = redirectUrl;
                    } else {
                        window.location.href = redirectUrl;
                    }
                    return;
                }
                
                this.close();
                return;
            }

            // MODIFIED: Fallback - if message contains any URL field, redirect PARENT window
            if (redirectUrl && redirectUrl.indexOf('http') !== -1) {
                this._log('Generic redirect detected - redirecting PARENT window to:', redirectUrl);
                this.close();
                if (this.options.forceParentRedirect) {
                    window.top.location.href = redirectUrl;
                } else {
                    window.location.href = redirectUrl;
                }
            }
        }

        /**
         * Handle iframe resize
         * @param {number} height - New height for iframe
         */
        _handleResize(height) {
            if (this.isMobile) {
                // On mobile, use min-height for better UX
                this.iframe.style.minHeight = `${Math.min(height, window.innerHeight - 100)}px`;
            } else {
                // On desktop, set exact height within limits
                const newHeight = Math.max(this.options.minHeight, Math.min(height, this.options.maxHeight));
                this.iframe.style.height = `${newHeight}px`;
            }
            this._log('Iframe resized to:', height);
        }

        /**
         * Inject HTML content (for OTP pages, etc.)
         * @param {string} htmlContent - HTML content to inject
         */
        _injectContent(htmlContent) {
            this._log('Injecting content');
            
            // Hide iframe and loader
            this.iframe.style.display = 'none';
            this.loader.style.display = 'none';
            
            // Show and populate content div
            this.contentDiv.innerHTML = htmlContent;
            this.contentDiv.classList.add('active');
            
            // Close iframe to free memory
            this.iframe.src = 'about:blank';
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
            this._log('Mobile device:', this.isMobile, 'iPhone:', this.isIPhone);

            // Reset state
            this.loader.style.display = 'block';
            this.iframe.style.display = 'none';
            this.contentDiv.style.display = 'none';
            this.contentDiv.classList.remove('active');
            this.contentDiv.innerHTML = '';
            
            // Reset iframe height
            this.iframe.style.height = '';
            this.iframe.style.minHeight = '';
            
            // Append ?full=1 for SSLCommerz-style gateways
            const separator = paymentUrl.includes('?') ? '&' : '?';
            const fullUrl = `${paymentUrl}${separator}full=1`;
            
            // Load payment page in iframe
            this.iframe.src = fullUrl;
            
            // Show modal
            this.modal.classList.add('active');
            this.isOpen = true;

            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // On mobile, adjust for viewport
            if (this.isMobile) {
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
            }
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
            
            // Restore mobile styles
            if (this.isMobile) {
                document.body.style.position = '';
                document.body.style.width = '';
            }

            // Clear iframe and content
            setTimeout(() => {
                this.iframe.src = 'about:blank';
                this.contentDiv.innerHTML = '';
                this.contentDiv.classList.remove('active');
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