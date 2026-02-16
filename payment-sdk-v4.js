/**
 * Payment Gateway SDK - ULTIMATE VERSION
 * Opens payment gateway in modal popup instead of redirect
 * 
 * FEATURES:
 * - Transparent iframe (no background)
 * - All redirects go to parent window
 * - OTP redirects open in main page
 * - Smart gateway detection (bKash, Nagad, etc.)
 * - Configurable handling: iframe, new_window, popup, or full_redirect
 * - X-Frame-Options detection with automatic fallback
 * - Payment window monitoring
 * - Only popup close button works
 */
(function(window) {
    'use strict';

    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIPhone = /iPhone/i.test(navigator.userAgent);
    
    // Modal CSS - Enhanced for all scenarios
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
            margin: 0 auto;
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

        .payment-info-container {
            text-align: center;
            padding: 40px 20px;
        }

        .payment-info-icon {
            font-size: 64px;
            margin-bottom: 20px;
        }

        .payment-info-title {
            font-size: 24px;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
        }

        .payment-info-message {
            font-size: 16px;
            color: #666;
            line-height: 1.5;
            margin-bottom: 20px;
        }

        .payment-info-box {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-size: 14px;
            color: #555;
        }

        .payment-countdown {
            font-size: 18px;
            font-weight: 600;
            color: #3498db;
            margin: 10px 0;
        }

        .payment-btn {
            margin-top: 10px;
            padding: 12px 30px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            transition: background 0.3s;
        }

        .payment-btn:hover {
            background: #2980b9;
        }

        .payment-btn-secondary {
            background: #95a5a6;
        }

        .payment-btn-secondary:hover {
            background: #7f8c8d;
        }

        .payment-status-waiting {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin: 20px 0;
            font-size: 14px;
            color: #666;
        }

        .payment-status-dot {
            width: 8px;
            height: 8px;
            background: #3498db;
            border-radius: 50%;
            animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        
        @media (max-width: 768px) {
            .payment-modal {
                width: 100%;
                height: 100%;
                max-width: 100%;
                max-height: 100%;
                border-radius: 0;
            }

            .payment-modal-close {
                top: 15px;
                right: 15px;
                width: 40px;
                height: 40px;
                font-size: 28px;
            }

            .payment-info-icon {
                font-size: 48px;
            }

            .payment-info-title {
                font-size: 20px;
            }

            .payment-info-message {
                font-size: 14px;
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
                onWindowClose: options.onWindowClose || null,
                debug: options.debug || false,
                autoResize: options.autoResize !== false,
                minHeight: options.minHeight || 400,
                maxHeight: options.maxHeight || (isMobile ? window.innerHeight : window.innerHeight - 100),
                
                // Force all redirects to parent window
                forceParentRedirect: options.forceParentRedirect !== false,
                
                // X-Frame-Options detection timeout (ms)
                iframeLoadTimeout: options.iframeLoadTimeout || 5000,
                
                // Redirect delay when X-Frame-Options detected (ms)
                redirectDelay: options.redirectDelay || 3000,
                
                // Gateways that don't support iframe
                noIframeGateways: options.noIframeGateways || [
                    'bkash.com',
                    'payment.bkash.com',
                    'sandbox.payment.bkash.com',
                    'nagad.com.bd',
                    'nagad.com',
                    'rocket.com.bd',
                    'upay.com.bd'
                ],
                
                // How to handle no-iframe gateways
                // Options: 'new_window', 'popup', 'full_redirect', 'auto'
                noIframeMethod: options.noIframeMethod || 'popup',
                
                // Payment window monitor interval (ms)
                windowMonitorInterval: options.windowMonitorInterval || 500,
                
                // Payment window timeout (ms) - 15 minutes default
                windowTimeout: options.windowTimeout || 15 * 60 * 1000
            };

            this.modal = null;
            this.iframe = null;
            this.contentDiv = null;
            this.isOpen = false;
            this.isMobile = isMobile;
            this.isIPhone = isIPhone;
            this.iframeLoadTimer = null;
            this.iframeLoaded = false;
            this.currentPaymentUrl = null;
            this.paymentWindow = null;
            this.windowMonitorTimer = null;
            this.windowTimeoutTimer = null;

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

            // Store reference for window functions
            window.paymentSDK = this;
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
                this._log('Iframe load event triggered');
                
                // Clear the timeout since iframe loaded
                if (this.iframeLoadTimer) {
                    clearTimeout(this.iframeLoadTimer);
                    this.iframeLoadTimer = null;
                }

                // Check if iframe content is accessible
                try {
                    const iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;
                    
                    if (iframeDoc && iframeDoc.body) {
                        const hasContent = iframeDoc.body.children.length > 0 || iframeDoc.body.textContent.trim().length > 0;
                        
                        if (hasContent) {
                            this._log('Iframe loaded successfully with content');
                            this.iframeLoaded = true;
                            this.loader.style.display = 'none';
                            this.iframe.style.display = 'block';
                            this._tryInjectIframeStyles();
                        } else {
                            this._log('Iframe loaded but appears empty - possible X-Frame-Options block');
                            setTimeout(() => {
                                if (!this.iframeLoaded) {
                                    this._handleIframeBlocked();
                                }
                            }, 1000);
                        }
                    }
                } catch (e) {
                    this._log('Iframe loaded (cross-origin - cannot inspect content)');
                    this.iframeLoaded = true;
                    this.loader.style.display = 'none';
                    this.iframe.style.display = 'block';
                }
            });

            // Iframe error event
            this.iframe.addEventListener('error', () => {
                this._log('Iframe error event triggered');
                this._handleIframeBlocked();
            });
        }

        /**
         * Try to inject CSS into iframe to hide unwanted elements
         */
        _tryInjectIframeStyles() {
            try {
                const iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;
                if (iframeDoc && iframeDoc.head) {
                    const style = iframeDoc.createElement('style');
                    style.textContent = `
                        .close-button, 
                        .btn-close, 
                        .modal-close,
                        [aria-label*="Close"],
                        [data-dismiss="modal"] {
                            display: none !important;
                        }
                        body {
                            background: transparent !important;
                        }
                    `;
                    iframeDoc.head.appendChild(style);
                    this._log('Successfully injected iframe styles');
                }
            } catch (e) {
                this._log('Cannot inject CSS into cross-origin iframe (expected for payment gateways)');
            }
        }

        /**
         * Check if URL is from no-iframe gateway
         */
        _isNoIframeGateway(url) {
            if (!url) return false;
            return this.options.noIframeGateways.some(gateway => url.includes(gateway));
        }

        /**
         * Get gateway name from URL
         */
        _getGatewayName(url) {
            if (url.includes('bkash.com')) return 'bKash';
            if (url.includes('nagad.com')) return 'Nagad';
            if (url.includes('rocket.com')) return 'Rocket';
            if (url.includes('upay.com')) return 'Upay';
            return 'Payment Gateway';
        }

        /**
         * Handle gateways that don't support iframe
         */
        _handleNoIframeGateway(url) {
            const gatewayName = this._getGatewayName(url);
            this._log(`No-iframe gateway detected: ${gatewayName}`, 'Method:', this.options.noIframeMethod);
            
            switch (this.options.noIframeMethod) {
                case 'new_window':
                    this._openInNewWindow(url, gatewayName);
                    break;
                    
                case 'popup':
                    this._openInPopup(url, gatewayName);
                    break;
                    
                case 'full_redirect':
                    this._redirectToGateway(url, gatewayName);
                    break;
                    
                case 'auto':
                    // Auto detect: mobile = full redirect, desktop = popup
                    if (this.isMobile) {
                        this._redirectToGateway(url, gatewayName);
                    } else {
                        this._openInPopup(url, gatewayName);
                    }
                    break;
                    
                default:
                    this._redirectToGateway(url, gatewayName);
                    break;
            }
        }

        /**
         * Open payment in new tab
         */
        _openInNewWindow(url, gatewayName) {
            this._log('Opening payment in new window/tab');
            
            const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
            
            if (!newWindow) {
                this._log('Popup blocked - showing message');
                this._showPopupBlockedMessage(url, gatewayName);
                return;
            }

            this._showWaitingMessage(gatewayName, 'new_window');
            this._monitorPaymentWindow(newWindow);
        }

        /**
         * Open payment in popup window
         */
        _openInPopup(url, gatewayName) {
            this._log('Opening payment in popup window');
            
            const width = this.isMobile ? window.screen.width : 600;
            const height = this.isMobile ? window.screen.height : 700;
            const left = this.isMobile ? 0 : (window.screen.width - width) / 2;
            const top = this.isMobile ? 0 : (window.screen.height - height) / 2;
            
            const features = this.isMobile 
                ? 'width=' + width + ',height=' + height + ',left=0,top=0'
                : `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`;
            
            const popup = window.open(url, 'payment_window', features);
            
            if (!popup) {
                this._log('Popup blocked - showing message');
                this._showPopupBlockedMessage(url, gatewayName);
                return;
            }

            this.paymentWindow = popup;
            this._showWaitingMessage(gatewayName, 'popup');
            this._monitorPaymentWindow(popup);
        }

        /**
         * Redirect to payment gateway (full page)
         */
        _redirectToGateway(url, gatewayName) {
            this._log('Redirecting to payment gateway (full page)');
            
            this.loader.style.display = 'none';
            
            let countdown = Math.floor(this.options.redirectDelay / 1000);
            
            this.contentDiv.innerHTML = `
                <div class="payment-info-container">
                    <div class="payment-info-icon">🔐</div>
                    <h2 class="payment-info-title">Redirecting to ${gatewayName}</h2>
                    <p class="payment-info-message">
                        You will be redirected to ${gatewayName} to complete your payment securely.
                    </p>
                    <div class="payment-countdown" id="countdown-timer">
                        Redirecting in <span id="countdown-seconds">${countdown}</span> seconds...
                    </div>
                    <button 
                        onclick="window.location.href='${url}'" 
                        class="payment-btn">
                        Continue Now →
                    </button>
                </div>
            `;
            this.contentDiv.classList.add('active');
            this.contentDiv.style.display = 'block';
            
            this.modal.classList.add('active');
            this.isOpen = true;
            
            const countdownInterval = setInterval(() => {
                countdown--;
                const countdownEl = document.getElementById('countdown-seconds');
                if (countdownEl) {
                    countdownEl.textContent = countdown;
                }
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    this.close();
                    window.location.href = url;
                }
            }, 1000);
        }

        /**
         * Show message when popup is blocked
         */
        _showPopupBlockedMessage(url, gatewayName) {
            this.contentDiv.innerHTML = `
                <div class="payment-info-container">
                    <div class="payment-info-icon">⚠️</div>
                    <h2 class="payment-info-title">Popup Blocked</h2>
                    <p class="payment-info-message">
                        Your browser blocked the payment window. Please allow popups for this site.
                    </p>
                    <div class="payment-info-box">
                        Click the button below to open ${gatewayName} payment page.
                    </div>
                    <button 
                        onclick="window.open('${url}', '_blank')" 
                        class="payment-btn">
                        Open ${gatewayName} →
                    </button>
                    <br><br>
                    <button 
                        onclick="window.location.href='${url}'" 
                        class="payment-btn payment-btn-secondary">
                        Continue on This Page
                    </button>
                </div>
            `;
            this.contentDiv.classList.add('active');
            this.contentDiv.style.display = 'block';
            this.loader.style.display = 'none';
            
            this.modal.classList.add('active');
            this.isOpen = true;
        }

        /**
         * Show waiting message while payment is in another window
         */
        _showWaitingMessage(gatewayName, method) {
            const windowType = method === 'new_window' ? 'tab' : 'window';
            
            this.contentDiv.innerHTML = `
                <div class="payment-info-container">
                    <div class="payment-info-icon">💳</div>
                    <h2 class="payment-info-title">Payment in Progress</h2>
                    <p class="payment-info-message">
                        Complete your payment in the ${gatewayName} ${windowType}.
                    </p>
                    <div class="payment-info-box">
                        <div class="payment-status-waiting">
                            <div class="payment-status-dot"></div>
                            <span>Waiting for payment completion...</span>
                        </div>
                    </div>
                    <p style="color: #999; font-size: 14px; margin-top: 20px;">
                        This page will automatically update once payment is complete or cancelled.
                    </p>
                    <button 
                        onclick="window.paymentSDK.close()" 
                        class="payment-btn payment-btn-secondary"
                        style="margin-top: 20px;">
                        Cancel Payment
                    </button>
                </div>
            `;
            this.contentDiv.classList.add('active');
            this.contentDiv.style.display = 'block';
            this.loader.style.display = 'none';
            
            this.modal.classList.add('active');
            this.isOpen = true;
        }

        /**
         * Monitor payment window for closure/completion
         */
        _monitorPaymentWindow(paymentWindow) {
            this._log('Started monitoring payment window');
            
            // Clear any existing monitors
            if (this.windowMonitorTimer) {
                clearInterval(this.windowMonitorTimer);
            }
            if (this.windowTimeoutTimer) {
                clearTimeout(this.windowTimeoutTimer);
            }
            
            this.windowMonitorTimer = setInterval(() => {
                try {
                    if (paymentWindow.closed) {
                        this._log('Payment window closed by user');
                        this._stopMonitoring();
                        this.close();
                        
                        if (this.options.onWindowClose) {
                            this.options.onWindowClose({ reason: 'user_closed' });
                        }
                        return;
                    }
                    
                    // Try to read window URL (only works if same domain after redirect)
                    try {
                        const windowUrl = paymentWindow.location.href;
                        this._log('Payment window URL:', windowUrl);
                        
                        // Check for success indicators in URL
                        if (windowUrl.includes('success') || windowUrl.includes('payment-success')) {
                            this._log('Payment success detected from URL');
                            this._stopMonitoring();
                            paymentWindow.close();
                            
                            if (this.options.onSuccess) {
                                this.options.onSuccess({ source: 'payment_window', url: windowUrl });
                            }
                            
                            this.close();
                        }
                        // Check for failure indicators
                        else if (windowUrl.includes('fail') || windowUrl.includes('cancel')) {
                            this._log('Payment failure/cancel detected from URL');
                            this._stopMonitoring();
                            paymentWindow.close();
                            
                            if (this.options.onError) {
                                this.options.onError({ source: 'payment_window', url: windowUrl });
                            }
                            
                            this.close();
                        }
                    } catch (e) {
                        // Cross-origin - can't read URL (this is normal)
                    }
                } catch (e) {
                    this._log('Error monitoring payment window:', e);
                    this._stopMonitoring();
                }
            }, this.options.windowMonitorInterval);
            
            // Set timeout
            this.windowTimeoutTimer = setTimeout(() => {
                this._log('Payment window timeout reached');
                this._stopMonitoring();
                
                if (paymentWindow && !paymentWindow.closed) {
                    this._log('Closing payment window due to timeout');
                    // Don't force close - user might still be completing payment
                }
            }, this.options.windowTimeout);
        }

        /**
         * Stop monitoring payment window
         */
        _stopMonitoring() {
            if (this.windowMonitorTimer) {
                clearInterval(this.windowMonitorTimer);
                this.windowMonitorTimer = null;
            }
            if (this.windowTimeoutTimer) {
                clearTimeout(this.windowTimeoutTimer);
                this.windowTimeoutTimer = null;
            }
            this._log('Stopped monitoring payment window');
        }

        /**
         * Handle iframe blocked by X-Frame-Options
         */
        _handleIframeBlocked() {
            this._log('Iframe blocked - likely X-Frame-Options: DENY or SAMEORIGIN');
            
            if (this.iframeLoadTimer) {
                clearTimeout(this.iframeLoadTimer);
                this.iframeLoadTimer = null;
            }

            const url = this.currentPaymentUrl || this.iframe.src;
            const gatewayName = this._getGatewayName(url);
            
            this._showRedirectMessage(url, gatewayName);
        }

        /**
         * Show redirect message when iframe is blocked
         */
        _showRedirectMessage(url, gatewayName) {
            this.loader.style.display = 'none';
            this.iframe.style.display = 'none';
            
            let countdown = Math.floor(this.options.redirectDelay / 1000);
            
            this.contentDiv.innerHTML = `
                <div class="payment-info-container">
                    <div class="payment-info-icon">🔒</div>
                    <h2 class="payment-info-title">Secure Payment Gateway</h2>
                    <p class="payment-info-message">
                        ${gatewayName} cannot be displayed in a popup for security reasons.
                    </p>
                    <div class="payment-info-box">
                        You will be redirected to the secure payment page
                    </div>
                    <div class="payment-countdown" id="countdown-timer">
                        Redirecting in <span id="countdown-seconds">${countdown}</span> seconds...
                    </div>
                    <button 
                        onclick="window.location.href='${url}'" 
                        class="payment-btn">
                        Continue to Payment →
                    </button>
                </div>
            `;
            this.contentDiv.classList.add('active');
            this.contentDiv.style.display = 'block';
            
            const countdownInterval = setInterval(() => {
                countdown--;
                const countdownEl = document.getElementById('countdown-seconds');
                if (countdownEl) {
                    countdownEl.textContent = countdown;
                }
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    this._log('Redirecting to payment gateway:', url);
                    this.close();
                    window.location.href = url;
                }
            }, 1000);
        }

        /**
         * Handle messages from iframe with parent window redirects
         */
        _handleMessage(event) {
            this._log('Received message:', event.data);

            let data;
            try {
                data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            } catch (e) {
                this._log('Invalid message format', event.data);
                return;
            }

            const redirectUrl = data.url || data.redirectUrl || data.redirect_url || 
                               data.gateway_url || data.gatewayUrl || data.GatewayPageURL ||
                               data.otp_url || data.otpUrl;
            
            // Handle OTP redirect - redirect parent window
            if (data.type === 'otp_redirect' || data.event === 'otp_required') {
                if (redirectUrl) {
                    this._log('OTP redirect - redirecting PARENT window to:', redirectUrl);
                    this.close();
                    window.top.location.href = redirectUrl;
                    return;
                }
            }

            // Handle redirect types
            if (data.type === 'redirect' || data.type === 'gw_redirect') {
                if (redirectUrl) {
                    this._log('Gateway redirect - redirecting PARENT window to:', redirectUrl);
                    this.close();
                    if (this.options.forceParentRedirect) {
                        window.top.location.href = redirectUrl;
                    } else {
                        window.location.href = redirectUrl;
                    }
                }
                return;
            }

            // Handle explicit redirect flag
            if (data.redirect === true || data.redirect === 1) {
                if (redirectUrl) {
                    this._log('Explicit redirect - redirecting PARENT window to:', redirectUrl);
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

            // Handle OTP/HTML content injection
            if (data.type === 'otp' && data.data) {
                this._injectContent(data.data);
                return;
            }

            // Handle success
            if (data.status === 'success' || data.event === 'payment_success') {
                this._log('Payment successful', data);
                
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

            // Handle error/failure
            if (data.status === 'error' || data.status === 'failed' || data.event === 'payment_failed') {
                this._log('Payment failed', data);
                
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

            // Handle cancel
            if (data.status === 'cancel' || data.event === 'payment_cancelled') {
                this._log('Payment cancelled', data);
                
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

            // Fallback redirect
            if (redirectUrl && redirectUrl.indexOf('http') !== -1) {
                this._log('Generic redirect - redirecting PARENT window to:', redirectUrl);
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
         */
        _handleResize(height) {
            if (this.isMobile) {
                this.iframe.style.minHeight = `${Math.min(height, window.innerHeight - 100)}px`;
            } else {
                const newHeight = Math.max(this.options.minHeight, Math.min(height, this.options.maxHeight));
                this.iframe.style.height = `${newHeight}px`;
            }
            this._log('Iframe resized to:', height);
        }

        /**
         * Inject HTML content
         */
        _injectContent(htmlContent) {
            this._log('Injecting content');
            
            this.iframe.style.display = 'none';
            this.loader.style.display = 'none';
            
            this.contentDiv.innerHTML = htmlContent;
            this.contentDiv.classList.add('active');
            
            this.iframe.src = 'about:blank';
        }

        /**
         * Open payment modal with gateway URL
         */
        open(paymentUrl) {
            if (!paymentUrl) {
                console.error('[PaymentSDK] Payment URL is required');
                return;
            }

            this._log('Opening payment:', paymentUrl);

            // Store current payment URL
            this.currentPaymentUrl = paymentUrl;

            // Check if this is a no-iframe gateway
            if (this._isNoIframeGateway(paymentUrl)) {
                const gatewayName = this._getGatewayName(paymentUrl);
                this._log(`Detected no-iframe gateway: ${gatewayName}`);
                this._handleNoIframeGateway(paymentUrl);
                return;
            }

            // Try to open in iframe
            this._log('Attempting to load in iframe');

            // Reset state
            this.iframeLoaded = false;
            this.loader.style.display = 'block';
            this.iframe.style.display = 'none';
            this.contentDiv.style.display = 'none';
            this.contentDiv.classList.remove('active');
            this.contentDiv.innerHTML = '';
            
            this.iframe.style.height = '';
            this.iframe.style.minHeight = '';
            
            if (this.iframeLoadTimer) {
                clearTimeout(this.iframeLoadTimer);
            }
            
            const separator = paymentUrl.includes('?') ? '&' : '?';
            const fullUrl = `${paymentUrl}${separator}full=1`;
            
            // Set timeout for X-Frame-Options detection
            this.iframeLoadTimer = setTimeout(() => {
                if (!this.iframeLoaded) {
                    this._log('Iframe load timeout - likely X-Frame-Options blocking');
                    this._handleIframeBlocked();
                }
            }, this.options.iframeLoadTimeout);
            
            this.iframe.src = fullUrl;
            
            this.modal.classList.add('active');
            this.isOpen = true;

            document.body.style.overflow = 'hidden';
            
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

            // Clear timers
            if (this.iframeLoadTimer) {
                clearTimeout(this.iframeLoadTimer);
                this.iframeLoadTimer = null;
            }

            // Stop monitoring payment window
            this._stopMonitoring();

            // Close payment window if open
            if (this.paymentWindow && !this.paymentWindow.closed) {
                this._log('Closing payment window');
                this.paymentWindow.close();
                this.paymentWindow = null;
            }

            this.modal.classList.remove('active');
            this.isOpen = false;
            this.iframeLoaded = false;
            this.currentPaymentUrl = null;

            document.body.style.overflow = '';
            
            if (this.isMobile) {
                document.body.style.position = '';
                document.body.style.width = '';
            }

            setTimeout(() => {
                this.iframe.src = 'about:blank';
                this.contentDiv.innerHTML = '';
                this.contentDiv.classList.remove('active');
            }, 300);

            if (this.options.onClose) {
                this.options.onClose();
            }
        }

        /**
         * Destroy the modal and cleanup
         */
        destroy() {
            this._log('Destroying payment modal');
            
            // Clear all timers
            if (this.iframeLoadTimer) {
                clearTimeout(this.iframeLoadTimer);
                this.iframeLoadTimer = null;
            }
            
            this._stopMonitoring();
            
            // Close payment window
            if (this.paymentWindow && !this.paymentWindow.closed) {
                this.paymentWindow.close();
                this.paymentWindow = null;
            }
            
            if (this.modal && this.modal.parentNode) {
                this.modal.parentNode.removeChild(this.modal);
            }
            
            this.modal = null;
            this.iframe = null;
            this.isOpen = false;
            
            // Remove global reference
            if (window.paymentSDK === this) {
                window.paymentSDK = null;
            }
        }
    }

    // Expose to window
    window.PaymentSDK = PaymentSDK;

})(window);