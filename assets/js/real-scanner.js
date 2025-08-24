// Real Website Scanner - Privacy First with Optional Proxy Mode
class RealWebsiteScanner {
    constructor() {
        // Proxy service (only used when user explicitly consents)
        // Using CorsProxy.io - a commercial GDPR-compliant service
        this.corsProxy = url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
        this.localProxy = null; // Will be set when local proxy is used
        this.proxyType = 'corsproxy'; // 'corsproxy' or 'local'
        this.isManualMode = false;
        this.useProxy = false;
        this.proxyConsentGiven = false;
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
    }

    // Enable proxy mode (requires user consent)
    enableProxyMode(userConfirmed = false, understandsDataSharing = false, proxyType = 'corsproxy', localProxyUrl = null) {
        if (proxyType === 'corsproxy') {
            this.validateProxyConsent(userConfirmed, understandsDataSharing);
        }
        this.useProxy = true;
        this.proxyConsentGiven = true;
        this.proxyType = proxyType;
        
        if (proxyType === 'local' && localProxyUrl) {
            this.localProxy = url => `${localProxyUrl}/${encodeURIComponent(url)}`;
            console.log('🏠 Local proxy mode enabled - no external data sharing');
        } else {
            console.log('🔒 CorsProxy.io mode enabled with privacy protections');
        }
    }

    // Disable proxy mode (default)
    disableProxyMode() {
        this.useProxy = false;
        this.proxyConsentGiven = false;
    }

    // Get the appropriate proxy service based on type
    getProxy() {
        return {
            index: 0,
            proxyFunction: this.proxyType === 'local' ? this.localProxy : this.corsProxy,
            type: this.proxyType
        };
    }

    // Privacy-aware user agent rotation
    getRandomUserAgent() {
        const randomIndex = Math.floor(Math.random() * this.userAgents.length);
        return this.userAgents[randomIndex];
    }

    // Sanitize headers for privacy
    getSanitizedHeaders() {
        return {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'User-Agent': this.getRandomUserAgent()
        };
    }

    // Check if proxy consent is properly given
    isProxyConsentValid() {
        return this.useProxy && this.proxyConsentGiven;
    }

    // Get proxy status for UI display
    getProxyStatus() {
        const serviceName = this.proxyType === 'local' ? 
            'Local Proxy (Self-hosted)' : 
            'CorsProxy.io (Commercial GDPR-compliant service)';
            
        const privacyProtections = this.useProxy ? 
            (this.proxyType === 'local' ? [
                'No external data sharing',
                'Self-hosted proxy',
                'Full user control',
                'Private network only'
            ] : [
                'GDPR-compliant commercial service',
                'Sanitized headers',
                'Random user agent',
                'No persistent tracking',
                'DNT header enabled'
            ]) : [];
            
        return {
            enabled: this.useProxy,
            consentGiven: this.proxyConsentGiven,
            mode: this.isManualMode ? 'manual' : (this.useProxy ? 'proxy' : 'disabled'),
            service: serviceName,
            type: this.proxyType,
            privacyProtections
        };
    }

    // Privacy-focused proxy consent validation
    validateProxyConsent(userConfirmed = false, understandsDataSharing = false) {
        if (!userConfirmed || !understandsDataSharing) {
            throw new Error('נדרשת הסכמה מפורשת והבנה שהנתונים יועברו לשירות צד שלישי לצורך הניתוח');
        }
        return true;
    }

    // Format CorsProxy.io error messages with user-friendly explanations
    formatCorsProxyError(error, originalUrl) {
        const urlObj = new URL(originalUrl);
        const domain = urlObj.hostname;
        
        switch (error.status) {
            case 502:
                // Common case: domain doesn't resolve or is not accessible
                const wwwSuggestion = domain.startsWith('www.') ? 
                    domain.replace('www.', '') : 
                    `www.${domain}`;
                
                return `❌ השרת לא הצליח להתחבר לאתר ${domain}

🔍 סיבות אפשריות:
• האתר לא זמין כרגע
• בעיות DNS או רשת
• האתר חוסם את ה-Proxy

💡 הצעות לפתרון:
• נסה עם הקידומת "www": ${wwwSuggestion}
• בדוק שהכתובת נכונה ותקינה
• נסה שוב מאוחר יותר
• השתמש במצב "הזנה ידנית" - העתק את ה-HTML ישירות`;

            case 404:
                return `❌ הדף לא נמצא ב-${domain}

💡 בדוק שהכתובת נכונה ונסה שוב`;

            case 403:
                return `❌ האתר ${domain} חוסם את הגישה דרך Proxy

💡 השתמש במצב "הזנה ידנית" - העתק את ה-HTML ישירות מהדפדפן`;

            case 429:
                return `❌ חריגה ממגבלת הקצב של CorsProxy.io

💡 נסה שוב עוד מספר דקות או השתמש במצב "הזנה ידנית"`;

            case 500:
                return `❌ שגיאת שרת פנימית ב-CorsProxy.io

💡 נסה שוב עוד כמה דקות או השתמש במצב "הזנה ידנית"`;

            default:
                const message = error.message || 'שגיאה לא מוכרת';
                return `❌ שגיאת Proxy (${error.status}): ${message}

💡 נסה להשתמש במצב "הזנה ידנית" - העתק את ה-HTML ישירות מהדפדפן`;
        }
    }

    // Fetch website using proxy (only when enabled and consented)
    async fetchWebsiteViaProxy(url) {
        if (!this.useProxy || !this.proxyConsentGiven) {
            throw new Error('Proxy mode is disabled or consent not given. Please use manual input mode or enable proxy with explicit consent.');
        }

        try {
            const { proxyFunction, type } = this.getProxy();
            const proxyUrl = proxyFunction(url);
            const sanitizedHeaders = this.getSanitizedHeaders();
            
            if (type === 'local') {
                console.log('🏠 Using local proxy - no external data sharing');
            } else {
                console.log('🔒 Using CorsProxy.io with privacy-aware headers');
            }
            
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: sanitizedHeaders
            });

            const html = await response.text();
            
            // Handle non-OK responses, but first check if CorsProxy.io returned JSON error details
            if (!response.ok) {
                if (type === 'corsproxy') {
                    try {
                        const errorData = JSON.parse(html);
                        if (errorData.error) {
                            throw new Error(this.formatCorsProxyError(errorData.error, url));
                        }
                    } catch (parseError) {
                        // If JSON parse fails, continue with generic HTTP error
                    }
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            if (typeof html === 'string' && html.length > 0) {
                // For successful responses, check if it's still an error response in the body
                if (type === 'corsproxy' && html.includes('error') && html.includes('proxy') && html.length < 5000) {
                    throw new Error('CorsProxy.io service error - content may be blocked or service unavailable');
                }
                return { html, finalUrl: url };
            }
            throw new Error(`Empty response from ${type === 'local' ? 'local proxy' : 'CorsProxy.io'}`);
        } catch (error) {
            const proxyName = this.proxyType === 'local' ? 'local proxy' : 'CorsProxy.io';
            console.error(`🔒 ${proxyName} failed:`, error.message);
            throw new Error(`Failed to fetch website via ${proxyName}: ${error.message}`);
        }
    }

    // Process manually provided HTML content
    async processHTML(htmlContent, url) {
        this.isManualMode = true;
        const urlObj = new URL(url);
        
        return {
            html: htmlContent,
            finalUrl: url,
            protocol: urlObj.protocol,
            hostname: urlObj.hostname,
            isManual: true
        };
    }

    async scanWebsite(url, progressCallback = null, htmlContent = null) {
        const startTime = Date.now();
        let finalUrl = url;
        let urlObj = new URL(url);
        
        // Set manual mode flag based on whether HTML content was provided and proxy is not enabled
        this.isManualMode = !!htmlContent && !this.useProxy;
        
        // Helper function to report progress with real-time updates
        const reportProgress = (step, details = '', progress = 0) => {
            if (progressCallback && typeof progressCallback === 'function') {
                progressCallback(step, details, progress);
            }
        };
        
        const scanResult = {
            url: url,
            timestamp: new Date().toISOString(),
            scanDuration: 0,
            websiteContext: {
                domain: urlObj.hostname,
                protocol: urlObj.protocol,
                path: urlObj.pathname,
                isManualInput: this.isManualMode
            },
            extractedData: {},
            compliance: {},
            score: 0,
            recommendations: [],
            risks: []
        };

        try {
            let html = null;
            
            // Check if HTML content was provided manually or via proxy
            if (htmlContent) {
                // Manual input mode or proxy mode with fetched content
                if (this.isManualMode) {
                    reportProgress('connect', 'מעבד HTML שהוזן ידנית...');
                    reportProgress('fetch', 'משתמש בתוכן שסופק...');
                    console.log('Using manually provided HTML content');
                    
                    // Add note about manual input
                    scanResult.recommendations.push({
                        priority: 'info',
                        message: '📌 הניתוח מבוסס על HTML שהוזן ידנית. חלק מהבדיקות (כמו HTTPS) מבוססות על הכתובת שצוינה.'
                    });
                } else if (this.useProxy) {
                    reportProgress('connect', 'מעבד HTML שהתקבל מ-Proxy...');
                    reportProgress('fetch', 'משתמש בתוכן שהתקבל...');
                    console.log('Using proxy-fetched HTML content');
                    
                    // Add detailed note about proxy usage with privacy context
                    const proxyMessage = this.proxyType === 'local' ?
                        '🏠 הניתוח מבוסס על תוכן שהתקבל דרך Proxy מקומי (ללא שיתוף נתונים חיצוני) - שליטה מלאה על הנתונים.' :
                        '🌐 הניתוח מבוסס על תוכן שהתקבל דרך CorsProxy.io (שירות מסחרי תואם GDPR) עם הגנות פרטיות: כותרות מחוסלות ו-User-Agent אקראי.';
                    
                    scanResult.recommendations.push({
                        priority: 'info',
                        message: proxyMessage
                    });
                }
                
                html = htmlContent;
                reportProgress('fetch', `התקבל HTML - ${(html.length / 1024).toFixed(1)}KB`);
                
            } else {
                // No HTML content provided at all
                reportProgress('error', 'נדרש קוד HTML לניתוח');
                throw new Error('לא סופק תוכן HTML. השתמש במצב הזנה ידנית או במצב Proxy לקבלת התוכן.');
            }
            
            // Check protocol from URL for SSL assessment
            reportProgress('protocol', `בודק פרוטוקול מהכתובת: ${urlObj.protocol.toUpperCase()}`);
            
            // Store protocol information
            scanResult.websiteContext.httpRedirectsToHttps = false; // Can't check redirects in manual mode
            
            // Update the final URL in results
            scanResult.url = finalUrl;
            scanResult.websiteContext.finalUrl = finalUrl;
            
            // Parse the HTML
            reportProgress('parse', 'מנתח מבנה HTML...', 15);
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Extract website context and data
            reportProgress('extract', 'מחלץ נתונים מהאתר...', 25);
            scanResult.extractedData = this.extractWebsiteData(doc, html, reportProgress);
            scanResult.websiteContext = {
                ...scanResult.websiteContext,
                ...scanResult.extractedData.metadata
            };
            reportProgress('extract', `נמצאו ${scanResult.extractedData.forms?.length || 0} טפסים, ${scanResult.extractedData.links?.length || 0} קישורים`, 35);

            // Perform compliance checks with real data
            reportProgress('ssl', 'בודק אישור SSL...', 40);
            scanResult.compliance = {};
            scanResult.compliance.ssl = this.checkSSL(urlObj, scanResult);
            
            reportProgress('cookies', 'מנתח עוגיות...', 50);
            scanResult.compliance.cookies = this.analyzeCookies(doc, html, reportProgress);
            const cookieCount = scanResult.compliance.cookies.cookies?.length || 0;
            if (cookieCount > 0) {
                reportProgress('cookies', `נמצאו ${cookieCount} עוגיות`, 55);
            }
            
            reportProgress('privacy', 'מחפש מדיניות פרטיות...', 65);
            scanResult.compliance.privacy = this.analyzePrivacyPolicy(doc, html, reportProgress);
            
            reportProgress('hebrew', 'בודק תוכן בעברית...', 75);
            scanResult.compliance.hebrew = this.analyzeHebrewContent(doc, html);
            const hebrewPercentage = scanResult.compliance.hebrew.details?.hebrewPercentage || 0;
            reportProgress('hebrew', `${hebrewPercentage}% מהתוכן בעברית`, 80);
            
            reportProgress('security', 'בודק אמצעי אבטחה...', 85);
            scanResult.compliance.dataCollection = this.analyzeDataCollection(doc);
            scanResult.compliance.security = this.analyzeSecurityFeatures(doc, html);
            scanResult.compliance.transparency = this.analyzeTransparency(doc);

            // Calculate score based on real findings
            reportProgress('score', 'מחשב ציון כולל...', 95);
            scanResult.score = this.calculateScore(scanResult.compliance);
            reportProgress('score', `ציון: ${scanResult.score}/100`, 100);
            
            // Generate recommendations based on actual issues found
            scanResult.recommendations = [...scanResult.recommendations, ...this.generateRecommendations(scanResult.compliance)];
            
            // Assess risks based on real data
            scanResult.risks = this.assessRisks(scanResult);

        } catch (error) {
            console.error('Scan error:', error);
            scanResult.error = error.message;
            scanResult.compliance = this.getErrorComplianceResults();
        }

        scanResult.scanDuration = Date.now() - startTime;
        return scanResult;
    }

    extractWebsiteData(doc, html, progressCallback = null) {
        const data = {
            metadata: {},
            content: {},
            technical: {},
            forms: [],
            links: {},
            scripts: [],
            cookies: []
        };

        // Extract metadata
        data.metadata.title = doc.title || 'No title';
        data.metadata.description = doc.querySelector('meta[name="description"]')?.content || '';
        data.metadata.keywords = doc.querySelector('meta[name="keywords"]')?.content || '';
        data.metadata.author = doc.querySelector('meta[name="author"]')?.content || '';
        data.metadata.language = doc.documentElement.lang || doc.querySelector('meta[name="language"]')?.content || '';
        data.metadata.charset = doc.characterSet || 'UTF-8';
        data.metadata.viewport = doc.querySelector('meta[name="viewport"]')?.content || '';

        // Content analysis
        const textContent = doc.body?.innerText || '';
        data.content.totalLength = textContent.length;
        data.content.wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
        data.content.hasHebrewContent = /[\u0590-\u05FF]/.test(textContent);
        data.content.hebrewPercentage = this.calculateHebrewPercentage(textContent);
        
        // Extract all links
        const links = Array.from(doc.querySelectorAll('a[href]'));
        data.links.total = links.length;
        data.links.external = links.filter(a => {
            try {
                const linkUrl = new URL(a.href, window.location.origin);
                return linkUrl.hostname !== new URL(window.location.origin).hostname;
            } catch {
                return false;
            }
        }).length;
        
        // Find privacy-related links
        data.links.privacyLinks = links
            .filter(a => {
                const text = (a.textContent + ' ' + a.href).toLowerCase();
                return text.includes('privacy') || text.includes('פרטיות') || 
                       text.includes('תנאי') || text.includes('terms') ||
                       text.includes('cookies') || text.includes('עוגיות');
            })
            .map(a => ({
                text: a.textContent.trim(),
                href: a.href
            }));

        // Extract forms and input fields
        const forms = Array.from(doc.querySelectorAll('form'));
        data.forms = forms.map(form => ({
            action: form.action || 'none',
            method: form.method || 'get',
            inputs: Array.from(form.querySelectorAll('input')).map(input => ({
                type: input.type,
                name: input.name,
                required: input.required,
                placeholder: input.placeholder
            })),
            hasEmailField: !!form.querySelector('input[type="email"]'),
            hasPasswordField: !!form.querySelector('input[type="password"]'),
            hasFileUpload: !!form.querySelector('input[type="file"]')
        }));

        // Detect tracking scripts
        const scripts = Array.from(doc.querySelectorAll('script'));
        data.scripts = this.detectTrackingScripts(scripts, html);

        // Try to detect cookies from inline scripts
        data.cookies = this.extractCookiesFromScripts(html);

        // Technical details
        data.technical.hasServiceWorker = html.includes('serviceWorker') || html.includes('service-worker');
        data.technical.hasManifest = !!doc.querySelector('link[rel="manifest"]');
        data.technical.hasPWA = data.technical.hasServiceWorker && data.technical.hasManifest;
        data.technical.hasAMP = !!doc.querySelector('html[amp]') || !!doc.querySelector('html[⚡]');
        data.technical.hasStructuredData = !!doc.querySelector('script[type="application/ld+json"]');

        return data;
    }

    detectTrackingScripts(scripts, html) {
        const trackers = [];
        const patterns = {
            'Google Analytics': [/google-analytics\.com/, /gtag\/js/, /_gaq\./],
            'Google Tag Manager': [/googletagmanager\.com/],
            'Facebook Pixel': [/connect\.facebook\.net/, /fbq\(/],
            'Hotjar': [/static\.hotjar\.com/],
            'Mixpanel': [/cdn\.mixpanel\.com/],
            'Segment': [/cdn\.segment\.com/],
            'Matomo/Piwik': [/matomo/, /piwik/],
            'Adobe Analytics': [/omtrdc\.net/],
            'Yandex Metrica': [/mc\.yandex\.ru/],
            'LinkedIn Insight': [/snap\.licdn\.com/]
        };

        for (const [name, regexes] of Object.entries(patterns)) {
            for (const regex of regexes) {
                if (regex.test(html)) {
                    trackers.push({
                        name,
                        detected: true,
                        privacy_concern: 'high'
                    });
                    break;
                }
            }
        }

        return trackers;
    }

    extractCookiesFromScripts(html) {
        const cookies = [];
        
        // Common cookie patterns in JavaScript
        const cookiePatterns = [
            /document\.cookie\s*=\s*["']([^"']+)["']/g,
            /setCookie\(['"]([^'"]+)['"]/g,
            /Cookie\.set\(['"]([^'"]+)['"]/g
        ];

        for (const pattern of cookiePatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const cookieName = match[1].split('=')[0];
                if (cookieName && !cookies.some(c => c.name === cookieName)) {
                    cookies.push({
                        name: cookieName,
                        source: 'inline-script'
                    });
                }
            }
        }

        return cookies;
    }

    calculateHebrewPercentage(text) {
        if (!text || text.length === 0) return 0;
        const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
        const totalChars = text.replace(/\s/g, '').length;
        return totalChars > 0 ? Math.round((hebrewChars / totalChars) * 100) : 0;
    }

    checkSSL(urlObj, scanResult) {
        const isHTTPS = urlObj.protocol === 'https:';
        const httpRedirectsToHttps = scanResult?.websiteContext?.httpRedirectsToHttps || false;
        
        // Consider compliant if: 
        // 1. Currently using HTTPS, OR
        // 2. HTTP redirects to HTTPS
        const isCompliant = isHTTPS || httpRedirectsToHttps;
        
        let recommendation = null;
        if (!isCompliant) {
            recommendation = 'האתר חייב להשתמש ב-HTTPS להצפנת התקשורת';
        } else if (!isHTTPS && httpRedirectsToHttps) {
            recommendation = 'האתר מפנה מ-HTTP ל-HTTPS, זה טוב! המשיכו כך.';
        }
        
        return {
            status: isCompliant ? 'compliant' : 'non-compliant',
            details: {
                protocol: urlObj.protocol,
                encrypted: isHTTPS,
                httpRedirectsToHttps: httpRedirectsToHttps,
                recommendation: recommendation
            }
        };
    }

    analyzeCookies(doc, html, progressCallback = null) {
        const extractedCookies = this.extractCookiesFromScripts(html);
        const hasTrackingScripts = this.detectTrackingScripts([], html).length > 0;
        
        // Amendment 13 enhanced cookie consent patterns (Hebrew and English)
        const consentPatterns = [
            'cookie-consent', 'cookie-banner', 'cookie-notice',
            'cookieconsent', 'cookie-bar', 'gdpr-consent',
            'privacy-banner', 'consent-banner', 'עוגיות',
            'הסכמה לעוגיות', 'רפה עוגיות', 'מדיניות עוגיות',
            'tikun13_cc', 'CookieConsent', 'cc-modal'
        ];
        
        let hasConsentBanner = false;
        for (const pattern of consentPatterns) {
            if (html.toLowerCase().includes(pattern)) {
                hasConsentBanner = true;
                break;
            }
        }

        // Amendment 13 specific opt-out mechanisms (Hebrew and English)
        const hasOptOut = html.includes('opt-out') || html.includes('refuse') || 
                          html.includes('reject') || html.includes('סירוב') ||
                          html.includes('דחה') || html.includes('אסרב') ||
                          html.includes('בטל הסכמה') || html.includes('דחה הכל') ||
                          html.includes('acceptNecessaryBtn');

        // Amendment 13 specific: Check for granular consent (essential vs non-essential)
        const hasGranularConsent = html.includes('essential cookies') || 
                                   html.includes('עוגיות חיוניות') ||
                                   html.includes('marketing cookies') ||
                                   html.includes('עוגיות שיווק') ||
                                   html.includes('analytics cookies') ||
                                   html.includes('עוגיות אנליטיקס') ||
                                   html.includes('functionality') ||
                                   html.includes('תפקודיות') ||
                                   html.includes('necessary') ||
                                   html.includes('analytics') ||
                                   html.includes('marketing');

        // Amendment 13 specific: Check for consent withdrawal mechanism
        const hasConsentWithdrawal = html.includes('withdraw consent') ||
                                     html.includes('מחיקת הסכמה') ||
                                     html.includes('ביטול הסכמה') ||
                                     html.includes('עדכון העדפות') ||
                                     html.includes('withdrawConsent') ||
                                     html.includes('reset') ||
                                     html.includes('showPreferences');

        // Advanced Amendment 13 features detection
        const hasConsentTimestamp = html.includes('timestamp') || 
                                    html.includes('lastUpdated') ||
                                    html.includes('consentDate') ||
                                    html.includes('תאריך הסכמה');
        
        const hasConsentVersion = html.includes('revision') || 
                                 html.includes('version') ||
                                 html.includes('consentVersion') ||
                                 html.includes('גרסת הסכמה');
        
        const hasDataPortability = html.includes('exportConsentData') ||
                                  html.includes('downloadData') ||
                                  html.includes('יצוא נתונים') ||
                                  html.includes('הורדת נתונים');
        
        const hasConsentStorage = html.includes('localStorage') && html.includes('consent') ||
                                 html.includes('tikun13_cc') ||
                                 html.includes('cc_cookie') ||
                                 html.includes('cookie.categories');

        // Amendment 13 compliance scoring with advanced features
        let complianceScore = 0;
        let advancedFeatures = 0;
        
        // Basic requirements
        if (hasConsentBanner) complianceScore += 1;
        if (hasOptOut) complianceScore += 1;
        if (hasGranularConsent) complianceScore += 1;
        if (hasConsentWithdrawal) complianceScore += 1;
        
        // Advanced features bonus
        if (hasConsentTimestamp) advancedFeatures += 1;
        if (hasConsentVersion) advancedFeatures += 1;
        if (hasDataPortability) advancedFeatures += 1;
        if (hasConsentStorage) advancedFeatures += 1;
        
        // No cookies/tracking = automatic compliance
        if (extractedCookies.length === 0 && !hasTrackingScripts) {
            complianceScore = 5;
        } else if (complianceScore === 4 && advancedFeatures >= 2) {
            complianceScore = 5; // Full compliance with advanced features
        }

        const status = complianceScore >= 4 ? 'compliant' :
                      complianceScore >= 2 ? 'partial' : 'non-compliant';

        return {
            status,
            details: {
                cookiesFound: extractedCookies,
                cookieCount: extractedCookies.length,
                hasTrackingScripts,
                hasConsentBanner,
                hasOptOut,
                hasGranularConsent,
                hasConsentWithdrawal,
                hasConsentTimestamp,
                hasConsentVersion,
                hasDataPortability,
                hasConsentStorage,
                complianceScore,
                advancedFeatures,
                recommendation: this.getCookieRecommendation(complianceScore, advancedFeatures)
            }
        };
    }

    getCookieRecommendation(score, advancedFeatures = 0) {
        if (score >= 5) return null;
        if (score >= 4) {
            if (advancedFeatures < 2) {
                return 'מומלץ להוסיף תכונות מתקדמות: חותמת זמן להסכמה, ניהול גרסאות, ויצוא נתונים';
            }
            return null;
        }
        if (score >= 3) return 'יש להוסיף מנגנון לביטול הסכמה בהתאם לתיקון 13';
        if (score >= 2) return 'יש להוסיף בחירה גרנולרית של סוגי עוגיות בהתאם לתיקון 13';
        if (score >= 1) return 'יש להוסיף אפשרות סירוב ובחירה גרנולרית בהתאם לתיקון 13';
        return 'יש להוסיף מנגנון הסכמה מלא לעוגיות בהתאם לדרישות תיקון 13';
    }

    analyzePrivacyPolicy(doc, html, progressCallback = null) {
        const privacyLinks = Array.from(doc.querySelectorAll('a')).filter(a => {
            const text = (a.textContent + ' ' + a.href).toLowerCase();
            return text.includes('privacy') || text.includes('פרטיות') || 
                   text.includes('מדיניות');
        });

        const hasPrivacyLink = privacyLinks.length > 0;
        const privacyUrls = privacyLinks.map(a => a.href);
        
        // Check if privacy content is in Hebrew
        const hasHebrewPrivacy = privacyLinks.some(a => 
            /[\u0590-\u05FF]/.test(a.textContent)
        );

        // Look for Amendment 13 required privacy policy sections in the HTML
        const requiredTerms = [
            { term: 'איסוף מידע|data collection', found: false, amendment13: true },
            { term: 'שימוש במידע|use of information', found: false, amendment13: true },
            { term: 'אבטחת מידע|data security', found: false, amendment13: true },
            { term: 'זכויות נושא המידע|data subject rights', found: false, amendment13: true },
            { term: 'זכות עיון|right of access', found: false, amendment13: true },
            { term: 'זכות תיקון|right to correction', found: false, amendment13: true },
            { term: 'cookies|עוגיות', found: false, amendment13: false },
            { term: 'צד שלישי|third party', found: false, amendment13: true },
            { term: 'מטרות עיבוד|processing purposes', found: false, amendment13: true },
            { term: 'תוצאות אי הסכמה|consequences of non-consent', found: false, amendment13: true },
            { term: 'ממונה הגנת פרטיות|data protection officer|DPO', found: false, amendment13: true },
            { term: 'יצירת קשר|contact information', found: false, amendment13: true },
            { term: 'תקופת שמירה|retention period', found: false, amendment13: true },
            { term: 'הרשאת עיבוד|processing authorization', found: false, amendment13: true }
        ];

        const lowerHTML = html.toLowerCase();
        for (const item of requiredTerms) {
            item.found = new RegExp(item.term).test(lowerHTML);
        }

        const foundSections = requiredTerms.filter(t => t.found).length;
        const totalSections = requiredTerms.length;
        
        const status = !hasPrivacyLink ? 'non-compliant' :
                      hasHebrewPrivacy && foundSections > 5 ? 'compliant' :
                      hasHebrewPrivacy ? 'partial' : 'partial';

        return {
            status,
            details: {
                hasPrivacyPolicy: hasPrivacyLink,
                privacyUrls,
                inHebrew: hasHebrewPrivacy,
                sectionsFound: foundSections,
                totalSections,
                missingSections: requiredTerms.filter(t => !t.found).map(t => t.term),
                recommendation: !hasPrivacyLink ? 'חובה להוסיף מדיניות פרטיות' :
                               !hasHebrewPrivacy ? 'יש לתרגם את מדיניות הפרטיות לעברית' :
                               foundSections < 5 ? 'יש להשלים את כל הסעיפים הנדרשים במדיניות' : null
            }
        };
    }

    analyzeHebrewContent(doc, html) {
        const textContent = doc.body?.innerText || '';
        const hebrewPercentage = this.calculateHebrewPercentage(textContent);
        const hasHebrewLang = doc.documentElement.lang === 'he' || 
                             doc.documentElement.lang === 'he-IL';
        
        const status = hebrewPercentage > 50 || hasHebrewLang ? 'compliant' :
                      hebrewPercentage > 20 ? 'partial' : 'non-compliant';

        return {
            status,
            details: {
                hebrewPercentage,
                hasHebrewLangAttribute: hasHebrewLang,
                recommendation: hebrewPercentage < 20 ? 
                    'יש להוסיף תוכן בעברית לאתר' : null
            }
        };
    }

    analyzeDataCollection(doc) {
        const forms = Array.from(doc.querySelectorAll('form'));
        const inputs = Array.from(doc.querySelectorAll('input'));
        
        const sensitiveInputs = inputs.filter(input => 
            ['email', 'tel', 'password', 'file'].includes(input.type) ||
            ['name', 'phone', 'address', 'id', 'ssn'].some(term => 
                (input.name + input.id + input.placeholder).toLowerCase().includes(term)
            )
        );

        const hasDataCollection = forms.length > 0 || sensitiveInputs.length > 0;
        const hasConsentCheckbox = !!doc.querySelector('input[type="checkbox"][name*="consent"], input[type="checkbox"][name*="agree"]');
        
        const status = !hasDataCollection ? 'compliant' :
                      hasConsentCheckbox ? 'partial' : 'non-compliant';

        return {
            status,
            details: {
                formsCount: forms.length,
                sensitiveFieldsCount: sensitiveInputs.length,
                hasConsentMechanism: hasConsentCheckbox,
                sensitiveFields: sensitiveInputs.slice(0, 5).map(i => ({
                    type: i.type,
                    name: i.name
                })),
                recommendation: hasDataCollection && !hasConsentCheckbox ?
                    'יש להוסיף מנגנון הסכמה מפורשת לאיסוף מידע' : null
            }
        };
    }

    analyzeSecurityFeatures(doc, html) {
        const features = {
            hasHTTPS: window.location?.protocol === 'https:',
            hasCSP: !!doc.querySelector('meta[http-equiv="Content-Security-Policy"]'),
            hasXFrameOptions: !!doc.querySelector('meta[http-equiv="X-Frame-Options"]'),
            hasReferrerPolicy: !!doc.querySelector('meta[name="referrer"]'),
            hasSubresourceIntegrity: !!doc.querySelector('[integrity]'),
            hasSecureLinks: !Array.from(doc.querySelectorAll('a[href^="http:"]')).length
        };

        const securityScore = Object.values(features).filter(v => v).length;
        const status = securityScore >= 5 ? 'compliant' :
                      securityScore >= 3 ? 'partial' : 'non-compliant';

        return {
            status,
            details: {
                features,
                securityScore: `${securityScore}/6`,
                recommendation: securityScore < 5 ?
                    'יש לשפר את אמצעי האבטחה של האתר' : null
            }
        };
    }

    analyzeTransparency(doc) {
        const hasContactInfo = !!doc.querySelector('[href^="mailto:"], [href^="tel:"]');
        const hasAboutPage = !!doc.querySelector('a[href*="about"], a[href*="אודות"]');
        const hasTerms = !!doc.querySelector('a[href*="terms"], a[href*="תנאי"]');
        
        const transparencyScore = [hasContactInfo, hasAboutPage, hasTerms].filter(v => v).length;
        const status = transparencyScore === 3 ? 'compliant' :
                      transparencyScore >= 2 ? 'partial' : 'non-compliant';

        return {
            status,
            details: {
                hasContactInfo,
                hasAboutPage,
                hasTerms,
                transparencyScore: `${transparencyScore}/3`,
                recommendation: transparencyScore < 3 ?
                    'יש להוסיף מידע יצירת קשר ודפי מידע' : null
            }
        };
    }

    calculateScore(compliance) {
        // Amendment 13 adjusted weights - higher emphasis on privacy policy and cookies
        const weights = {
            ssl: 15,
            cookies: 25,        // Increased: Critical for Amendment 13 consent requirements
            privacy: 30,        // Increased: Core requirement for transparency
            hebrew: 15,         // Increased: Accessibility requirement in Israeli law
            dataCollection: 20, // Increased: Data subject rights importance
            security: 10,
            transparency: 5
        };

        let totalScore = 0;
        let maxScore = 0;

        for (const [key, check] of Object.entries(compliance)) {
            const weight = weights[key] || 10;
            maxScore += weight;
            
            if (check.status === 'compliant') {
                totalScore += weight;
            } else if (check.status === 'partial') {
                // Amendment 13 penalty: Partial compliance gets less credit for critical areas
                const partialMultiplier = (key === 'privacy' || key === 'cookies') ? 0.3 : 0.5;
                totalScore += weight * partialMultiplier;
            }
            // Non-compliant gets 0 points (no change)
        }

        return Math.round((totalScore / maxScore) * 100);
    }

    generateRecommendations(compliance) {
        const recommendations = [];

        for (const [category, check] of Object.entries(compliance)) {
            if (check.details?.recommendation) {
                recommendations.push({
                    category,
                    priority: check.status === 'non-compliant' ? 'high' : 'medium',
                    action: check.details.recommendation,
                    status: check.status
                });
            }
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    assessRisks(scanResult) {
        const risks = [];

        // SSL/HTTPS risks with Amendment 13 context
        if (scanResult.compliance.ssl?.status === 'non-compliant') {
            risks.push({
                level: 'high',
                category: 'אבטחה',
                description: 'האתר אינו מוגן בהצפנה',
                impact: 'חשיפת מידע רגיש בהעברה - הפרת תקנות אבטחת מידע תיקון 13',
                potentialFine: '20,000-320,000 ₪'
            });
        }

        // Privacy policy risks with Amendment 13 specifics
        if (scanResult.compliance.privacy?.status === 'non-compliant') {
            risks.push({
                level: 'high',
                category: 'שקיפות',
                description: 'חסרה מדיניות פרטיות',
                impact: 'הפרת חובת היידוע - קנסות חמורים על פי תיקון 13',
                potentialFine: '30,000-500,000 ₪'
            });
        } else if (scanResult.compliance.privacy?.status === 'partial') {
            const missingCount = scanResult.compliance.privacy?.details?.missingSections?.length || 0;
            if (missingCount > 5) {
                risks.push({
                    level: 'medium',
                    category: 'שקיפות',
                    description: 'מדיניות פרטיות לא מלאה',
                    impact: `חסרים ${missingCount} סעיפים נדרשים לתיקון 13`,
                    potentialFine: '15,000-250,000 ₪'
                });
            }
        }

        // Cookie consent risks with Amendment 13 granular requirements
        if (scanResult.compliance.cookies?.status === 'non-compliant' && 
            scanResult.compliance.cookies?.details?.cookieCount > 0) {
            risks.push({
                level: 'high',
                category: 'הסכמה',
                description: 'שימוש בעוגיות ללא הסכמה מתאימה',
                impact: 'הפרת דרישות הסכמה גרנולרית של תיקון 13',
                potentialFine: '20,000-150,000 ₪'
            });
        } else if (scanResult.compliance.cookies?.status === 'partial') {
            const score = scanResult.compliance.cookies?.details?.complianceScore || 0;
            if (score < 3) {
                risks.push({
                    level: 'medium',
                    category: 'הסכמה',
                    description: 'מנגנון הסכמה לעוגיות לא מלא',
                    impact: 'חסרה בחירה גרנולרית או יכולת ביטול הסכמה',
                    potentialFine: '10,000-75,000 ₪'
                });
            }
        }

        // Hebrew content risk (Israeli law requirement)
        if (scanResult.compliance.hebrew?.status === 'non-compliant') {
            risks.push({
                level: 'medium',
                category: 'נגישות',
                description: 'אתר לא נגיש לציבור הישראלי',
                impact: 'הפרת דרישת נגישות בעברית לפי החוק הישראלי',
                potentialFine: 'הליכים משפטיים'
            });
        }

        // Data collection without proper consent
        if (scanResult.compliance.dataCollection?.status === 'non-compliant' &&
            scanResult.compliance.dataCollection?.details?.sensitiveFieldsCount > 0) {
            risks.push({
                level: 'high',
                category: 'איסוף מידע',
                description: 'איסוף מידע רגיש ללא הסכמה',
                impact: 'הפרת עקרון ההסכמה המפורשת בתיקון 13',
                potentialFine: '50,000-400,000 ₪'
            });
        }

        // Overall compliance risk with Amendment 13 thresholds
        if (scanResult.score < 30) {
            risks.push({
                level: 'critical',
                category: 'עמידה כללית',
                description: 'רמת התאמה קריטית לתיקון 13',
                impact: 'סיכון גבוה לקנסות משמעותיים וצווי עצירה',
                potentialFine: '100,000-1,000,000 ₪'
            });
        } else if (scanResult.score < 60) {
            risks.push({
                level: 'high',
                category: 'עמידה כללית',
                description: 'רמת התאמה נמוכה לתיקון 13',
                impact: 'נדרשת פעולה מיידית למניעת הפרות',
                potentialFine: '20,000-300,000 ₪'
            });
        }

        return risks;
    }

    getErrorComplianceResults() {
        return {
            ssl: {
                status: 'error',
                details: { error: 'לא ניתן לבדוק' }
            },
            cookies: {
                status: 'error',
                details: { error: 'לא ניתן לבדוק' }
            },
            privacy: {
                status: 'error',
                details: { error: 'לא ניתן לבדוק' }
            },
            hebrew: {
                status: 'error',
                details: { error: 'לא ניתן לבדוק' }
            }
        };
    }
}

// Export for use in script.js
window.RealWebsiteScanner = RealWebsiteScanner;