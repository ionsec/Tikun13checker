// Global variables to store scan state
let latestScanResults = null;
let lastScannedUrl = null;
let lastScanMode = 'private'; // Track the scan mode used for the last successful scan
let currentScan = null;
let currentScanMode = 'private'; // Default to private mode
let proxyConsentGiven = false;

// Usage limit management for demo site
const DEMO_SCAN_LIMIT = 10;
const DEMO_HOSTNAME = 'tikun13.ionsec.io';

// Function to check if we're on the demo site
function isDemoSite() {
    return window.location.hostname === DEMO_HOSTNAME || 
           window.location.hostname.endsWith('.github.io');
}

// Function to get scan count for demo site
function getDemoScanCount() {
    if (!isDemoSite()) return 0;
    const stored = localStorage.getItem('tikun13_demo_scans');
    if (!stored) return 0;
    
    try {
        const data = JSON.parse(stored);
        const today = new Date().toDateString();
        
        // Reset if it's a new day
        if (data.date !== today) {
            localStorage.removeItem('tikun13_demo_scans');
            return 0;
        }
        
        return data.count || 0;
    } catch (e) {
        localStorage.removeItem('tikun13_demo_scans');
        return 0;
    }
}

// Function to increment scan count
function incrementDemoScanCount() {
    if (!isDemoSite()) return;
    
    const today = new Date().toDateString();
    const newCount = getDemoScanCount() + 1;
    
    localStorage.setItem('tikun13_demo_scans', JSON.stringify({
        date: today,
        count: newCount
    }));
    
    updateScanCountDisplay();
}

// Function to check if scan limit reached
function isScanLimitReached() {
    if (!isDemoSite()) return false;
    return getDemoScanCount() >= DEMO_SCAN_LIMIT;
}

// Function to update scan count display
function updateScanCountDisplay() {
    if (!isDemoSite()) return;
    
    const scanCount = getDemoScanCount();
    const remaining = Math.max(0, DEMO_SCAN_LIMIT - scanCount);
    
    // Create or update scan counter display
    let counterElement = document.getElementById('demo-scan-counter');
    if (!counterElement) {
        counterElement = document.createElement('div');
        counterElement.id = 'demo-scan-counter';
        counterElement.className = 'demo-scan-counter';
        
        // Insert after the header
        const header = document.querySelector('header');
        if (header && header.nextSibling) {
            header.parentNode.insertBefore(counterElement, header.nextSibling);
        }
    }
    
    if (remaining > 0) {
        counterElement.innerHTML = `
            <div class="scan-limit-info">
                <span class="scan-icon">🔍</span>
                <span class="scan-text">נותרו ${remaining} מתוך ${DEMO_SCAN_LIMIT} סריקות היום</span>
                <span class="educational-notice">(אתר דמו - מגבלות קיימות. הורד/Fork לשימוש מלא)</span>
            </div>
        `;
        counterElement.classList.remove('limit-reached');
    } else {
        counterElement.innerHTML = `
            <div class="scan-limit-info limit-reached">
                <span class="scan-icon">⚠️</span>
                <span class="scan-text">הגעת למגבלת ${DEMO_SCAN_LIMIT} סריקות ליום</span>
                <span class="educational-notice">(אתר דמו - הורד/Fork הפרויקט להרצה מקומית ללא מגבלות)</span>
            </div>
        `;
        counterElement.classList.add('limit-reached');
    }
}

// Israeli domain validation for proxy mode (anti-abuse measure)
function isIsraeliDomain(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // Israeli TLD patterns
        const israeliTLDs = [
            '.co.il',
            '.org.il', 
            '.ac.il',
            '.gov.il',
            '.net.il',
            '.muni.il',
            '.idf.il',
            '.ישראל' // Hebrew IDN
        ];
        
        // Check if hostname ends with any Israeli TLD
        return israeliTLDs.some(tld => hostname.endsWith(tld));
    } catch (e) {
        // Invalid URL format
        return false;
    }
}

// Local IP validation for local proxy mode
function isLocalIP(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // Remove brackets for IPv6 addresses
        const cleanHostname = hostname.replace(/^\[|\]$/g, '');
        
        // Localhost patterns
        if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
            return true;
        }
        
        // IPv4 loopback (127.0.0.0/8)
        if (/^127\./.test(cleanHostname)) {
            return true;
        }
        
        // IPv6 loopback
        if (cleanHostname === '::1' || cleanHostname === '0:0:0:0:0:0:0:1') {
            return true;
        }
        
        // Private IPv4 networks
        const ipv4Match = cleanHostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (ipv4Match) {
            const [, a, b, c, d] = ipv4Match.map(Number);
            
            // 192.168.0.0/16
            if (a === 192 && b === 168) return true;
            
            // 10.0.0.0/8
            if (a === 10) return true;
            
            // 172.16.0.0/12
            if (a === 172 && b >= 16 && b <= 31) return true;
        }
        
        return false;
    } catch (e) {
        return false;
    }
}

// Proxy type switching function
function switchProxyType(type) {
    const corsproxyForm = document.getElementById('proxy-form');
    const localProxyForm = document.getElementById('local-proxy-form');
    const corsproxyWarnings = document.getElementById('corsproxy-warnings');
    const localProxyWarnings = document.getElementById('local-proxy-warnings');
    
    if (type === 'corsproxy') {
        corsproxyForm.style.display = 'block';
        localProxyForm.style.display = 'none';
        corsproxyWarnings.style.display = 'block';
        localProxyWarnings.style.display = 'none';
    } else if (type === 'local') {
        corsproxyForm.style.display = 'none';
        localProxyForm.style.display = 'block';
        corsproxyWarnings.style.display = 'none';
        localProxyWarnings.style.display = 'block';
    }
}

// Progress Tracker Class
class ProgressTracker {
    constructor() {
        this.steps = [
            { id: 'connect', label: 'חיבור לאתר', icon: '🌐' },
            { id: 'protocol', label: 'בדיקת פרוטוקול', icon: '🔐' },
            { id: 'fetch', label: 'טעינת תוכן', icon: '📄' },
            { id: 'parse', label: 'ניתוח HTML', icon: '🔍' },
            { id: 'extract', label: 'חילוץ נתונים', icon: '📊' },
            { id: 'ssl', label: 'בדיקת SSL', icon: '🔒' },
            { id: 'cookies', label: 'ניתוח עוגיות', icon: '🍪' },
            { id: 'privacy', label: 'מדיניות פרטיות', icon: '📋' },
            { id: 'hebrew', label: 'תוכן בעברית', icon: '🇮🇱' },
            { id: 'security', label: 'אבטחת מידע', icon: '🛡️' },
            { id: 'score', label: 'חישוב ציון', icon: '📈' },
            { id: 'complete', label: 'סיום', icon: '✅' }
        ];
        this.currentStep = 0;
        this.startTime = Date.now();
        this.stepTimes = {};
        this.elapsedInterval = null;
        this.totalSteps = this.steps.length;
        this.cancelled = false;
    }

    start(url) {
        this.startTime = Date.now();
        this.cancelled = false;
        
        // Update URL display
        const urlDisplay = document.querySelector('.progress-url');
        if (urlDisplay) {
            urlDisplay.textContent = new URL(url).hostname;
        }
        
        // Start elapsed time counter
        this.startElapsedTimer();
        
        // Reset all steps
        this.resetSteps();
        
        // Update initial status
        this.updateStatus('פעיל');
    }

    startElapsedTimer() {
        this.elapsedInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            const timeDisplay = document.getElementById('elapsed-time');
            if (timeDisplay) {
                timeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    resetSteps() {
        document.querySelectorAll('.step-item').forEach(item => {
            item.classList.remove('active', 'completed', 'error', 'warning');
            const statusElement = item.querySelector('.step-status');
            const timeElement = item.querySelector('.step-time');
            if (statusElement) statusElement.textContent = '⏳';
            if (timeElement) timeElement.textContent = '';
        });
    }

    updateStep(stepId, status = 'active', details = '') {
        if (this.cancelled) return;
        
        const stepIndex = this.steps.findIndex(s => s.id === stepId);
        if (stepIndex === -1) return;
        
        const step = this.steps[stepIndex];
        const stepElement = document.querySelector(`[data-step="${stepId}"]`);
        
        if (!stepElement) return;
        
        // Update previous steps to completed if needed
        for (let i = 0; i < stepIndex; i++) {
            const prevStep = document.querySelector(`[data-step="${this.steps[i].id}"]`);
            if (prevStep && !prevStep.classList.contains('completed')) {
                this.completeStep(this.steps[i].id);
            }
        }
        
        // Update current step
        stepElement.classList.remove('active', 'completed', 'error', 'warning');
        stepElement.classList.add(status);
        
        const statusIcon = stepElement.querySelector('.step-status');
        const timeElement = stepElement.querySelector('.step-time');
        
        if (statusIcon) {
            switch(status) {
                case 'active':
                    statusIcon.textContent = '⚡';
                    statusIcon.style.animation = 'spin 1s linear infinite';
                    this.updateCurrentStepDisplay(step.icon, step.label, details);
                    break;
                case 'completed':
                    statusIcon.textContent = '✅';
                    statusIcon.style.animation = 'none';
                    this.stepTimes[stepId] = Date.now();
                    const elapsed = ((this.stepTimes[stepId] - this.startTime) / 1000).toFixed(1);
                    if (timeElement) timeElement.textContent = `${elapsed}s`;
                    break;
                case 'warning':
                    statusIcon.textContent = '⚠️';
                    statusIcon.style.animation = 'none';
                    break;
                case 'error':
                    statusIcon.textContent = '❌';
                    statusIcon.style.animation = 'none';
                    break;
            }
        } else if (status === 'active') {
            // Still update the current step display even if no status icon
            this.updateCurrentStepDisplay(step.icon, step.label, details);
        }
        
        // Update progress percentage
        this.updateProgress((stepIndex + 1) / this.totalSteps * 100);
    }

    completeStep(stepId) {
        this.updateStep(stepId, 'completed');
    }

    updateCurrentStepDisplay(icon, label, details) {
        const currentStepEl = document.querySelector('.progress-current-step');
        if (currentStepEl) {
            const iconEl = currentStepEl.querySelector('.step-icon');
            const textEl = currentStepEl.querySelector('.step-text');
            if (iconEl) iconEl.textContent = icon;
            if (textEl) textEl.textContent = details || label;
        }
    }

    updateProgress(percentage) {
        const fill = document.querySelector('.progress-fill');
        const percentageDisplay = document.querySelector('.progress-percentage');
        
        if (fill) {
            fill.style.width = `${percentage}%`;
        }
        
        if (percentageDisplay) {
            percentageDisplay.textContent = `${Math.round(percentage)}%`;
        }
    }

    updateStatus(status) {
        const statusEl = document.getElementById('scan-status');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.className = status === 'שגיאה' ? 'error' : 
                              status === 'הושלם' ? 'success' : '';
        }
    }

    complete() {
        this.updateStep('complete', 'completed');
        this.updateProgress(100);
        this.updateStatus('הושלם');
        this.stop();
    }

    error(message) {
        this.updateStatus('שגיאה');
        this.updateCurrentStepDisplay('❌', 'שגיאה', message);
        this.stop();
    }

    cancel() {
        this.cancelled = true;
        this.updateStatus('בוטל');
        this.stop();
    }

    stop() {
        if (this.elapsedInterval) {
            clearInterval(this.elapsedInterval);
            this.elapsedInterval = null;
        }
    }
}

// Theme Management - Make functions globally accessible
window.initTheme = function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    window.updateThemeIcon(savedTheme);
}

window.toggleTheme = function() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    window.updateThemeIcon(newTheme);
    
    // Smooth transition
    document.documentElement.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    setTimeout(() => {
        document.documentElement.style.transition = '';
    }, 300);
}

window.updateThemeIcon = function(theme) {
    const lightIcon = document.querySelector('.theme-icon-light');
    const darkIcon = document.querySelector('.theme-icon-dark');
    
    if (lightIcon && darkIcon) {
        if (theme === 'dark') {
            lightIcon.style.display = 'none';
            darkIcon.style.display = 'inline';
        } else {
            lightIcon.style.display = 'inline';
            darkIcon.style.display = 'none';
        }
    }
}

// Mobile Menu Functions
window.toggleMobileMenu = function() {
    const menu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    const toggle = document.getElementById('mobile-menu-toggle');
    
    if (menu && overlay && toggle) {
        const isActive = menu.classList.contains('active');
        
        if (isActive) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }
}

window.openMobileMenu = function() {
    const menu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    const toggle = document.getElementById('mobile-menu-toggle');
    
    if (menu && overlay && toggle) {
        menu.classList.add('active');
        overlay.classList.add('active');
        toggle.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

window.closeMobileMenu = function() {
    const menu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    const toggle = document.getElementById('mobile-menu-toggle');
    
    if (menu && overlay && toggle) {
        menu.classList.remove('active');
        overlay.classList.remove('active');
        toggle.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close mobile menu on escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeMobileMenu();
    }
});

// Desktop Recommendation Banner Functions
window.hideBanner = function() {
    const banner = document.getElementById('desktop-banner');
    if (banner) {
        banner.classList.add('hidden');
        document.body.classList.remove('banner-shown');
        localStorage.setItem('hideBanner', 'true');
        
        // Remove banner from DOM after animation
        setTimeout(() => {
            banner.style.display = 'none';
        }, 300);
    }
}

// Show banner on mobile devices (unless previously hidden)
window.initBanner = function() {
    const banner = document.getElementById('desktop-banner');
    const isHidden = localStorage.getItem('hideBanner') === 'true';
    
    if (banner && !isHidden && window.innerWidth <= 768) {
        banner.style.display = 'block';
        document.body.classList.add('banner-shown');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    window.initTheme();
    window.initBanner();
    initConsent();
    initCountdown();
    initFormHandlers();
    initResourceDownloads();
    
    // Initialize default scan mode (private)
    switchScanMode('private');
    
    // Initialize demo scan counter if on demo site
    updateScanCountDisplay();
    
    // Initialize disclaimer banner and side tab
    initDisclaimerBanner();
    
    // Adjust section-switcher position based on header height
    adjustSectionSwitcherPosition();
});

// Adjust section-switcher to stick below header
function adjustSectionSwitcherPosition() {
    const header = document.querySelector('header');
    const sectionSwitcher = document.querySelector('.section-switcher');
    
    if (header && sectionSwitcher) {
        const headerHeight = header.offsetHeight;
        sectionSwitcher.style.top = headerHeight + 'px';
    }
    
    // Update on window resize
    window.addEventListener('resize', () => {
        if (header && sectionSwitcher) {
            const headerHeight = header.offsetHeight;
            sectionSwitcher.style.top = headerHeight + 'px';
        }
    });
}

// Consent Management
function initConsent() {
    const consentModal = document.getElementById('consent-modal');
    const consentCheckbox = document.getElementById('consent-agree');
    const acceptButton = document.getElementById('accept-consent');
    
    // Check if user has already consented
    if (!localStorage.getItem('tikun13_consent')) {
        // Show consent modal
        consentModal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
    
    // Enable/disable accept button based on checkbox
    if (consentCheckbox) {
        consentCheckbox.addEventListener('change', function() {
            acceptButton.disabled = !this.checked;
        });
    }
}

window.acceptConsent = function() {
    // Store consent
    localStorage.setItem('tikun13_consent', 'true');
    localStorage.setItem('tikun13_consent_date', new Date().toISOString());
    
    // Hide modal
    const consentModal = document.getElementById('consent-modal');
    consentModal.classList.remove('show');
    document.body.style.overflow = ''; // Re-enable scrolling
    
    // Focus on URL input
    document.getElementById('website-url')?.focus();
};

window.declineConsent = function() {
    // Redirect to IONSEC website or show goodbye message
    if (confirm('אנו מצטערים שבחרת לא להשתמש בכלי. האם ברצונך לבקר באתר IONSEC.IO למידע נוסף?')) {
        window.location.href = 'https://ionsec.io';
    } else {
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center;">
                <div>
                    <h1>תודה על ביקורך</h1>
                    <p>לשימוש בכלי יש לקבל את תנאי השימוש.</p>
                    <p>למידע נוסף: <a href="https://ionsec.io">IONSEC.IO</a></p>
                </div>
            </div>
        `;
    }
};

function initCountdown() {
    const deadlineDate = new Date('2025-08-14T00:00:00');
    const countdownElement = document.getElementById('countdown');
    
    function updateCountdown() {
        const now = new Date();
        const timeRemaining = deadlineDate - now;
        
        if (timeRemaining <= 0) {
            countdownElement.textContent = 'התיקון נכנס לתוקף!';
            return;
        }
        
        const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        
        countdownElement.textContent = `${days} ימים, ${hours} שעות ו-${minutes} דקות`;
    }
    
    updateCountdown();
    setInterval(updateCountdown, 60000);
}

function initFormHandlers() {
    const checkerForm = document.getElementById('checker-form');
    const proxyForm = document.getElementById('proxy-form');
    const newsletterForm = document.getElementById('newsletter-form');
    const localProxyScanButton = document.getElementById('local-proxy-scan-button');
    
    if (checkerForm) {
        checkerForm.addEventListener('submit', handleWebsiteCheck);
    }
    
    if (proxyForm) {
        proxyForm.addEventListener('submit', handleProxyCheck);
    }
    
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', handleNewsletterSignup);
    }
    
    if (localProxyScanButton) {
        localProxyScanButton.addEventListener('click', handleLocalProxyCheck);
    }
}

// Function to switch between scan modes
function switchScanMode(mode) {
    currentScanMode = mode;
    
    // Get the correct elements
    const manualInputMode = document.getElementById('manual-input-mode');
    const proxyInputMode = document.getElementById('proxy-input-mode');
    const privacyNotice = document.getElementById('privacy-notice');
    
    // Hide all mode content areas first
    if (manualInputMode) manualInputMode.style.display = 'none';
    if (proxyInputMode) proxyInputMode.style.display = 'none';
    
    // Update privacy notice based on mode
    if (privacyNotice) {
        switch(mode) {
            case 'private':
                privacyNotice.innerHTML = `
                    <span class="privacy-badge">🔒 100% פרטי</span>
                    <p>כל העיבוד מתבצע בדפדפן שלך. שום מידע לא נשלח לשרתים חיצוניים.</p>
                `;
                break;
            case 'proxy':
                privacyNotice.innerHTML = `
                    <span class="privacy-badge" style="background: #ff9800;">⚠️ מצב Proxy</span>
                    <p>כתובת האתר תישלח לשירותי צד שלישי. נדרשת הסכמה מפורשת.</p>
                `;
                break;
        }
    }
    
    // Show the appropriate mode content
    switch(mode) {
        case 'private':
            if (manualInputMode) manualInputMode.style.display = 'block';
            break;
            
        case 'proxy':
            if (proxyInputMode) proxyInputMode.style.display = 'block';
            
            // Setup proxy consent checkbox handler
            const proxyConsentCheckbox = document.getElementById('proxy-consent');
            const proxyScanButton = document.getElementById('proxy-scan-button');
            
            if (proxyConsentCheckbox && proxyScanButton) {
                // Check if consent was previously given
                if (localStorage.getItem('tikun13_proxy_consent')) {
                    proxyConsentCheckbox.checked = true;
                    proxyScanButton.disabled = false;
                }
                
                // Add event listener for consent checkbox
                proxyConsentCheckbox.onchange = function() {
                    if (this.checked) {
                        proxyConsentGiven = true;
                        localStorage.setItem('tikun13_proxy_consent', 'true');
                        proxyScanButton.disabled = false;
                    } else {
                        proxyConsentGiven = false;
                        localStorage.removeItem('tikun13_proxy_consent');
                        proxyScanButton.disabled = true;
                    }
                };
            }
            break;
            
    }
}


// Initialize disclaimer banner
function initDisclaimerBanner() {
    const banner = document.getElementById('disclaimer-banner');
    const sideTab = document.getElementById('disclaimer-side-tab');
    const body = document.body;
    
    // Check if disclaimer was already accepted
    const isAccepted = localStorage.getItem('disclaimer_accepted');
    
    if (banner) {
        if (isAccepted) {
            // Hide banner if already accepted
            banner.style.display = 'block'; // Ensure display is set
            banner.classList.add('hidden');
            body.classList.remove('disclaimer-visible');
            body.style.paddingTop = '0';
            
            // Show side tab for re-showing the disclaimer
            if (sideTab) {
                sideTab.classList.add('visible');
                sideTab.style.display = 'block';
            }
        } else {
            // Show banner on first visit
            banner.style.display = 'block';
            banner.classList.remove('hidden');
            body.classList.add('disclaimer-visible');
            
            // Calculate and set body padding
            setTimeout(() => {
                const bannerHeight = banner.offsetHeight;
                body.style.paddingTop = bannerHeight + 'px';
            }, 100);
            
            // Hide side tab when banner is visible
            if (sideTab) {
                sideTab.style.display = 'none';
            }
        }
    }
}

// Accept disclaimer banner
function acceptDisclaimer() {
    const banner = document.getElementById('disclaimer-banner');
    const sideTab = document.getElementById('disclaimer-side-tab');
    const body = document.body;
    
    if (banner) {
        // Hide banner with animation
        banner.classList.add('hidden');
        
        // Remove body padding
        body.classList.remove('disclaimer-visible');
        body.style.paddingTop = '0';
        
        // Store acceptance
        localStorage.setItem('disclaimer_accepted', 'true');
        localStorage.setItem('disclaimer_accepted_date', new Date().toISOString());
        
        // Show side tab after delay
        setTimeout(() => {
            if (sideTab) {
                sideTab.style.display = 'block';
                sideTab.classList.add('visible');
            }
        }, 500);
    }
}

// Show disclaimer from side tab
function showDisclaimer() {
    const banner = document.getElementById('disclaimer-banner');
    const body = document.body;
    
    if (banner) {
        // Show banner
        banner.classList.remove('hidden');
        body.classList.add('disclaimer-visible');
        
        // Calculate and set body padding
        setTimeout(() => {
            const bannerHeight = banner.offsetHeight;
            body.style.paddingTop = bannerHeight + 'px';
        }, 100);
    }
}

// Removed bookmarklet-related function



// Handle proxy form submission
async function handleProxyCheck(e) {
    e.preventDefault();
    
    // Check scan limit for demo site
    if (isScanLimitReached()) {
        alert('הגעת למגבלת 10 סריקות ליום עבור האתר הדמו. חזור מחר או רכוש גרסה מלאה.');
        return;
    }
    
    // Ensure we're in proxy mode
    currentScanMode = 'proxy';
    
    // Check consent first
    if (!localStorage.getItem('tikun13_consent')) {
        alert('יש לקבל את תנאי השימוש לפני השימוש בכלי');
        initConsent();
        return;
    }
    
    // Check proxy consent
    if (!proxyConsentGiven && !localStorage.getItem('tikun13_proxy_consent')) {
        alert('יש לאשר את השימוש במצב Proxy לפני הסריקה.');
        return;
    }
    
    const proxyUrlInput = document.getElementById('proxy-url');
    let url = proxyUrlInput.value.trim();
    
    // Normalize and validate URL
    url = normalizeAndValidateUrl(url);
    
    if (!url) {
        alert('אנא הכנס כתובת אתר תקינה (לדוגמה: example.co.il או https://example.com)');
        return;
    }
    
    // Get selected proxy type
    const selectedProxyType = document.querySelector('input[name="proxy-type"]:checked')?.value || 'corsproxy';
    
    // Check if domain is Israeli (anti-abuse measure) - only for CorsProxy.io mode
    if (selectedProxyType === 'corsproxy' && !isIsraeliDomain(url)) {
        alert('מצב CorsProxy.io תומך רק באתרים ישראליים (.co.il, .org.il, .ac.il, .gov.il, .net.il, .muni.il, .idf.il, .ישראל).\n\nעבור אתרים בינלאומיים, אנא השתמשו במצב "הזנה ידנית" או במצב "Proxy מקומי".');
        return;
    }
    
    // For local proxy mode, validate that the proxy URL is a local IP
    if (selectedProxyType === 'local') {
        const localProxyInput = document.getElementById('local-proxy-url');
        const localProxyUrl = localProxyInput?.value?.trim();
        
        if (!localProxyUrl) {
            alert('יש להזין כתובת Proxy מקומי');
            return;
        }
        
        if (!isLocalIP(localProxyUrl)) {
            alert('ניתן להשתמש רק בכתובות Proxy מקומיות (localhost, 127.0.0.1, ::1, או רשתות פרטיות)');
            return;
        }
    }
    
    // Update input with normalized URL
    proxyUrlInput.value = url;
    
    // Create progress tracker
    const progressTracker = new ProgressTracker();
    currentScan = progressTracker;
    
    showLoadingOverlay(true);
    progressTracker.start(url);
    
    try {
        // For proxy mode, pass null as htmlContent to trigger proxy fetching
        const results = await checkWebsiteCompliance(url, (step, details) => {
            progressTracker.updateStep(step, 'active', details);
        }, null);
        
        if (!results) {
            throw new Error('No results returned from scan');
        }
        
        // Check if scan had errors
        if (results.error) {
            console.error('Scan completed with error:', results.error);
            progressTracker.error('הסריקה הושלמה עם שגיאות');
            
            await new Promise(resolve => setTimeout(resolve, 500));
            displayError({ message: results.error }, url);
            lastScannedUrl = url;
        } else {
            // Complete the progress successfully
            progressTracker.complete();
            
            latestScanResults = results;
            lastScannedUrl = url;
            lastScanMode = currentScanMode;
            
            // Increment demo scan count on successful scan
            incrementDemoScanCount();
            
            await new Promise(resolve => setTimeout(resolve, 500));
            displayResults(results);
            
            document.getElementById('checker-title').textContent = `תוצאות עבור: ${new URL(url).hostname}`;
            document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        document.getElementById('scan-controls').style.display = 'flex';
        
    } catch (error) {
        console.error('Error checking website:', error);
        progressTracker.error(error.message || 'אירעה שגיאה בבדיקת האתר');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        displayError(error, url);
        lastScannedUrl = url;
        document.getElementById('scan-controls').style.display = 'flex';
    } finally {
        showLoadingOverlay(false);
        currentScan = null;
    }
}

// Handle local proxy scan
async function handleLocalProxyCheck(e) {
    e.preventDefault();
    
    // Check scan limit for demo site
    if (isScanLimitReached()) {
        alert('הגעת למגבלת 10 סריקות ליום עבור האתר הדמו. חזור מחר או רכוש גרסה מלאה.');
        return;
    }
    
    // Ensure we're in proxy mode
    currentScanMode = 'proxy';
    
    // Check consent first
    if (!localStorage.getItem('tikun13_consent')) {
        alert('יש לקבל את תנאי השימוש לפני השימוש בכלי');
        initConsent();
        return;
    }
    
    // Check proxy consent
    if (!proxyConsentGiven && !localStorage.getItem('tikun13_proxy_consent')) {
        alert('יש לאשר את השימוש במצב Proxy לפני הסריקה.');
        return;
    }
    
    const localProxyUrlInput = document.getElementById('local-proxy-url');
    const localTargetUrlInput = document.getElementById('local-target-url');
    
    const localProxyUrl = localProxyUrlInput.value.trim();
    const targetUrl = localTargetUrlInput.value.trim();
    
    // Validate inputs
    if (!localProxyUrl) {
        alert('יש להזין כתובת Proxy מקומי');
        localProxyUrlInput.focus();
        return;
    }
    
    if (!targetUrl) {
        alert('יש להזין כתובת אתר לסריקה');
        localTargetUrlInput.focus();
        return;
    }
    
    // Validate local proxy URL
    if (!isLocalIP(localProxyUrl)) {
        alert('ניתן להשתמש רק בכתובות Proxy מקומיות (localhost, 127.0.0.1, ::1, או רשתות פרטיות)');
        localProxyUrlInput.focus();
        return;
    }
    
    // Normalize and validate target URL
    const normalizedTargetUrl = normalizeAndValidateUrl(targetUrl);
    if (!normalizedTargetUrl) {
        alert('אנא הכנס כתובת אתר תקינה לסריקה (לדוגמה: https://example.com)');
        localTargetUrlInput.focus();
        return;
    }
    
    // Update inputs with normalized values
    localTargetUrlInput.value = normalizedTargetUrl;
    
    // Create progress tracker
    const progressTracker = new ProgressTracker();
    currentScan = progressTracker;
    
    showLoadingOverlay(true);
    
    try {
        // Check website compliance with local proxy
        const results = await checkWebsiteComplianceWithLocalProxy(normalizedTargetUrl, progressTracker.updateProgress.bind(progressTracker), localProxyUrl);
        
        if (!results) {
            throw new Error('No results returned from scan');
        }
        
        // Check if scan had errors
        if (results.error) {
            console.error('Scan completed with error:', results.error);
            progressTracker.error('הסריקה הושלמה עם שגיאות');
            
            await new Promise(resolve => setTimeout(resolve, 500));
            displayError({ message: results.error }, normalizedTargetUrl);
            lastScannedUrl = normalizedTargetUrl;
        } else {
            // Complete the progress successfully
            progressTracker.complete();
            
            latestScanResults = results;
            lastScannedUrl = normalizedTargetUrl;
            lastScanMode = currentScanMode;
            
            // Increment demo scan count on successful scan
            incrementDemoScanCount();
            
            // Display results
            displayResults(results);
            
            // Scroll to results
            document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        document.getElementById('scan-controls').style.display = 'flex';
        
    } catch (error) {
        console.error('Error checking website:', error);
        progressTracker.error(error.message || 'אירעה שגיאה בבדיקת האתר');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        displayError(error, normalizedTargetUrl);
        lastScannedUrl = normalizedTargetUrl;
        document.getElementById('scan-controls').style.display = 'flex';
    } finally {
        showLoadingOverlay(false);
        currentScan = null;
    }
}

async function handleWebsiteCheck(e) {
    e.preventDefault();
    
    // Check scan limit for demo site
    if (isScanLimitReached()) {
        alert('הגעת למגבלת 10 סריקות ליום עבור האתר הדמו. חזור מחר או רכוש גרסה מלאה.');
        return;
    }
    
    // Only set to private mode if not doing a rescan (preserve the mode for rescans)
    if (e.type !== 'submit' || !e.isTrusted || !lastScannedUrl) {
        currentScanMode = 'private';
    }
    
    // Check consent first
    if (!localStorage.getItem('tikun13_consent')) {
        alert('יש לקבל את תנאי השימוש לפני השימוש בכלי');
        initConsent();
        return;
    }
    
    const urlInput = document.getElementById('website-url');
    const htmlInput = document.getElementById('html-input');
    let url = urlInput.value.trim();
    let htmlContent = htmlInput ? htmlInput.value.trim() : '';
    
    // Normalize and validate URL
    url = normalizeAndValidateUrl(url);
    
    if (!url) {
        alert('אנא הכנס כתובת אתר תקינה (לדוגמה: example.co.il או https://example.com)');
        return;
    }
    
    // Handle different scan modes
    if (currentScanMode === 'private') {
        // Check if HTML content is provided for private mode
        if (!htmlContent) {
            alert('אנא הדבק את קוד ה-HTML של האתר. לחץ על "איך להשיג HTML" להוראות.');
            return;
        }
    } else if (currentScanMode === 'proxy') {
        // For proxy mode, we'll fetch the HTML via proxy
        if (!proxyConsentGiven && !localStorage.getItem('tikun13_proxy_consent')) {
            alert('יש לאשר את השימוש במצב Proxy לפני הסריקה.');
            return;
        }
        // HTML content will be fetched by the scanner in proxy mode
        htmlContent = null;
    }
    
    // Update input with normalized URL
    urlInput.value = url;
    
    // Create progress tracker
    const progressTracker = new ProgressTracker();
    currentScan = progressTracker;
    
    showLoadingOverlay(true);
    progressTracker.start(url);
    
    try {
        // Pass HTML content and progress callback to compliance check
        const results = await checkWebsiteCompliance(url, (step, details) => {
            progressTracker.updateStep(step, 'active', details);
        }, htmlContent);
        
        console.log('Scan results:', results); // Debug log
        
        if (!results) {
            throw new Error('No results returned from scan');
        }
        
        // Check if scan had errors
        if (results.error) {
            console.error('Scan completed with error:', results.error);
            progressTracker.error('הסריקה הושלמה עם שגיאות');
            
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Display error UI
            displayError({ message: results.error }, url);
            
            // Store URL for retry
            lastScannedUrl = url;
        } else {
            // Complete the progress successfully
            progressTracker.complete();
            
            // Store results and URL globally
            latestScanResults = results;
            lastScannedUrl = url;
            lastScanMode = currentScanMode;
            
            // Increment demo scan count on successful scan
            incrementDemoScanCount();
            
            // Wait a moment to show completion
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Display results
            displayResults(results);
            
            // Update checker title for success
            document.getElementById('checker-title').textContent = `תוצאות עבור: ${new URL(url).hostname}`;
            
            // Smooth scroll to results
            document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // ALWAYS show scan controls (success or error)
        document.getElementById('scan-controls').style.display = 'flex';
        
    } catch (error) {
        console.error('Error checking website:', error);
        progressTracker.error(error.message || 'אירעה שגיאה בבדיקת האתר');
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Display error UI
        displayError(error, url);
        
        // Store URL for retry
        lastScannedUrl = url;
        
        // Show scan controls for retry
        document.getElementById('scan-controls').style.display = 'flex';
    } finally {
        showLoadingOverlay(false);
        currentScan = null;
    }
}

function normalizeAndValidateUrl(input) {
    if (!input) return null;
    
    let url = input.trim();
    
    // Remove any whitespace
    url = url.replace(/\s+/g, '');
    
    // Add protocol if missing
    if (!url.match(/^https?:\/\//i)) {
        // Default to https://
        url = 'https://' + url;
    }
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // Israeli TLDs
        const israeliTLDs = [
            '.co.il', '.org.il', '.net.il', '.gov.il',
            '.muni.il', '.ac.il', '.k12.il', '.idf.il',
            '.ישראל', '.israel'
        ];
        
        // Common international TLDs
        const internationalTLDs = [
            '.com', '.org', '.net', '.edu', '.info',
            '.io', '.dev', '.app', '.tech', '.online',
            '.biz', '.me', '.tv', '.cc', '.xyz'
        ];
        
        // Check if it has a valid TLD
        const hasIsraeliTLD = israeliTLDs.some(tld => hostname.endsWith(tld));
        const hasInternationalTLD = internationalTLDs.some(tld => hostname.endsWith(tld));
        
        // Basic domain validation (allows subdomains)
        const domainPattern = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
        const hebrewDomainPattern = /^([א-ת0-9]([א-ת0-9-]{0,61}[א-ת0-9])?\.)+ישראל$/;
        
        // Validate domain structure
        if (!hasIsraeliTLD && !hasInternationalTLD) {
            // Check if it's a valid domain structure anyway
            if (!domainPattern.test(hostname) && !hebrewDomainPattern.test(hostname)) {
                console.warn('Invalid domain structure:', hostname);
                return null;
            }
        }
        
        // Additional validation for localhost and IP addresses (for testing)
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isIPAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
        
        if (!hasIsraeliTLD && !hasInternationalTLD && !isLocalhost && !isIPAddress) {
            // If no recognized TLD, but valid structure, warn but allow
            console.warn('Unrecognized TLD, but allowing:', hostname);
        }
        
        return url;
    } catch (error) {
        console.error('URL validation error:', error);
        return null;
    }
}

// Keep old function for backward compatibility
function isValidUrl(string) {
    return normalizeAndValidateUrl(string) !== null;
}

function showLoadingOverlay(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

async function checkWebsiteCompliance(url, progressCallback, htmlContent = null) {
    try {
        // Use the real scanner with HTML content and progress callback
        const scanner = new RealWebsiteScanner();
        
        // Enable proxy mode if selected and consented (when htmlContent is null)
        if (currentScanMode === 'proxy' && !htmlContent && (proxyConsentGiven || localStorage.getItem('tikun13_proxy_consent'))) {
            // Get selected proxy type and configuration
            const selectedProxyType = document.querySelector('input[name="proxy-type"]:checked')?.value || 'corsproxy';
            const localProxyUrl = selectedProxyType === 'local' ? 
                document.getElementById('local-proxy-url')?.value?.trim() : null;
            
            // Enable appropriate proxy mode
            if (selectedProxyType === 'local') {
                scanner.enableProxyMode(true, true, 'local', localProxyUrl);
            } else {
                scanner.enableProxyMode(true, true, 'corsproxy');
            }
            
            // For proxy mode, fetch the HTML
            const proxyResult = await scanner.fetchWebsiteViaProxy(url);
            htmlContent = proxyResult.html;
        }
        
        const results = await scanner.scanWebsite(url, progressCallback, htmlContent);
        
        // Map the results to the expected format
        return {
            url: results.url,
            timestamp: results.timestamp,
            checks: results.compliance,
            compliance: results.compliance,
            overallScore: results.score,
            score: results.score,
            recommendations: results.recommendations,
            risks: results.risks,
            extractedData: results.extractedData,
            websiteContext: results.websiteContext,
            scanDuration: results.scanDuration,
            error: results.error
        };
    } catch (error) {
        console.error('Error in checkWebsiteCompliance:', error);
        // Return a default error result structure
        return {
            url: url,
            timestamp: new Date().toISOString(),
            checks: {
                ssl: {
                    status: 'error',
                    message: 'לא ניתן לבדוק את אישור ה-SSL',
                    recommendation: 'נסה שוב מאוחר יותר'
                },
                cookies: {
                    status: 'error',
                    message: 'לא ניתן לבדוק עוגיות',
                    recommendation: 'נסה שוב מאוחר יותר'
                },
                privacy: {
                    status: 'error',
                    message: 'לא ניתן לבדוק מדיניות פרטיות',
                    recommendation: 'נסה שוב מאוחר יותר'
                },
                hebrew: {
                    status: 'error',
                    message: 'לא ניתן לבדוק תוכן בעברית',
                    recommendation: 'נסה שוב מאוחר יותר'
                }
            },
            overallScore: 0,
            error: error.message || error.toString() || 'אירעה שגיאה לא צפויה'
        };
    }
}

// Removed mock data functions - now using real scanner in real-scanner.js

// Check website compliance with local proxy (similar to checkWebsiteCompliance but for local proxy)
async function checkWebsiteComplianceWithLocalProxy(url, progressCallback, localProxyUrl) {
    try {
        // Use the real scanner with local proxy configuration
        const scanner = new RealWebsiteScanner();
        
        // Enable local proxy mode with the provided proxy URL
        scanner.enableProxyMode(true, true, 'local', localProxyUrl);
        
        // For local proxy mode, fetch the HTML via the local proxy
        const proxyResult = await scanner.fetchWebsiteViaProxy(url);
        const htmlContent = proxyResult.html;
        
        const results = await scanner.scanWebsite(url, progressCallback, htmlContent);
        
        // Map the results to the expected format
        return {
            url: results.url,
            timestamp: results.timestamp,
            checks: results.compliance,
            compliance: results.compliance,
            overallScore: results.score,
            score: results.score,
            recommendations: results.recommendations,
            risks: results.risks,
            extractedData: results.extractedData,
            websiteContext: results.websiteContext,
            scanDuration: results.scanDuration,
            error: results.error
        };
    } catch (error) {
        console.error('Error in checkWebsiteComplianceWithLocalProxy:', error);
        // Return a default error result structure
        return {
            url: url,
            timestamp: new Date().toISOString(),
            checks: {
                ssl: {
                    status: 'error',
                    message: 'לא ניתן לבדוק את אישור ה-SSL',
                    recommendation: 'נסה שוב מאוחר יותר'
                },
                cookies: {
                    status: 'error',
                    message: 'לא ניתן לבדוק עוגיות',
                    recommendation: 'נסה שוב מאוחר יותר'
                },
                privacy: {
                    status: 'error',
                    message: 'לא ניתן לבדוק מדיניות פרטיות',
                    recommendation: 'נסה שוב מאוחר יותר'
                },
                hebrew: {
                    status: 'error',
                    message: 'לא ניתן לבדוק תוכן עברי',
                    recommendation: 'נסה שוב מאוחר יותר'
                }
            },
            compliance: {},
            overallScore: 0,
            error: error.message || error.toString() || 'אירעה שגיאה לא צפויה'
        };
    }
}

function displayError(error, url) {
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) return;
    
    // Show the results container
    resultsContainer.style.display = 'block';
    
    // Check if this is a detailed CorsProxy error (contains emoji indicators)
    const errorMessage = error?.message || error?.toString() || 'אירעה שגיאה לא צפויה';
    const isDetailedError = typeof errorMessage === 'string' && (errorMessage.includes('❌') || errorMessage.includes('💡'));
    
    if (isDetailedError) {
        // Display the detailed formatted error message
        const formattedErrorMessage = errorMessage.replace(/\n/g, '<br>');
        resultsContainer.innerHTML = `
            <div class="error-container proxy-error">
                <div class="error-icon">🚫</div>
                <h3>שגיאת Proxy</h3>
                <p class="error-url">${url ? new URL(url).hostname : 'האתר המבוקש'}</p>
                
                <div class="detailed-error-message">
                    ${formattedErrorMessage}
                </div>
                
                <div class="error-actions">
                    ${generateWwwRetryButton(url)}
                    <button class="btn-primary" onclick="rescanWebsite()">
                        🔄 נסה שוב
                    </button>
                    <button class="btn-secondary" onclick="switchToManualMode()">
                        📝 מצב הזנה ידנית
                    </button>
                    <button class="btn-secondary" onclick="newScan()">
                        🆕 סרוק אתר אחר
                    </button>
                </div>
                
                <div class="error-footer">
                    <p class="error-note">
                        💡 טיפ: במצב הזנה ידנית אתה מעתיק את ה-HTML ישירות מהדפדפן - פרטי לחלוטין!
                    </p>
                </div>
            </div>
        `;
    } else {
        // Display the standard error message
        resultsContainer.innerHTML = `
            <div class="error-container">
                <div class="error-icon">❌</div>
                <h3>שגיאה בסריקת האתר</h3>
                <p class="error-url">${url ? new URL(url).hostname : 'האתר המבוקש'}</p>
                
                <div class="error-details">
                    <h4>מה קרה?</h4>
                    <p>${errorMessage}</p>
                    
                    <h4>סיבות אפשריות:</h4>
                    <ul>
                        <li>האתר אינו זמין כרגע</li>
                        <li>כתובת האתר אינה נכונה</li>
                        <li>האתר חוסם סריקות אוטומטיות</li>
                        <li>בעיית חיבור לאינטרנט</li>
                        <li>האתר דורש הרשאות מיוחדות</li>
                    </ul>
                    
                    <h4>מה לעשות?</h4>
                    <ul>
                        <li>ודא שכתובת האתר נכונה</li>
                        <li>בדוק שהאתר עובד בדפדפן רגיל</li>
                        <li>נסה שוב בעוד מספר דקות</li>
                    </ul>
                </div>
                
                <div class="error-actions">
                    <button class="btn-primary" onclick="rescanWebsite()">
                        🔄 נסה שוב
                    </button>
                    <button class="btn-secondary" onclick="newScan()">
                        🆕 סרוק אתר אחר
                    </button>
                    <button class="btn-secondary" onclick="document.getElementById('checker-form').scrollIntoView({ behavior: 'smooth' })">
                        ⬆️ חזור לטופס
                    </button>
                </div>
                
                <div class="error-footer">
                    <p class="error-note">
                        💡 טיפ: אם הבעיה נמשכת, נסה להעתיק את כתובת האתר ישירות משורת הכתובת בדפדפן
                    </p>
                </div>
            </div>
        `;
    }
    
    // Always show scan controls on error
    const scanControls = document.getElementById('scan-controls');
    if (scanControls) {
        scanControls.style.display = 'flex';
    }
    
    // Update checker title to show error state
    const checkerTitle = document.getElementById('checker-title');
    if (checkerTitle) {
        checkerTitle.textContent = 'שגיאה בסריקה - נסה שוב';
    }
}

// Generate www retry button for 502 errors
function generateWwwRetryButton(url) {
    if (!url) return '';
    
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        // Generate the alternative domain
        const altDomain = domain.startsWith('www.') ? 
            domain.replace('www.', '') : 
            `www.${domain}`;
        
        const altUrl = url.replace(domain, altDomain);
        
        return `
            <button class="btn-warning" onclick="retryWithWww('${altUrl}')">
                🌐 נסה עם ${altDomain}
            </button>
        `;
    } catch (e) {
        return '';
    }
}

// Retry scanning with www prefix/suffix
function retryWithWww(newUrl) {
    const proxyUrlInput = document.getElementById('proxy-url');
    if (proxyUrlInput) {
        proxyUrlInput.value = newUrl;
        
        // Trigger the proxy check
        const fakeEvent = { preventDefault: () => {} };
        handleProxyCheck(fakeEvent);
    }
}

// Switch to manual mode
function switchToManualMode() {
    // Switch to private mode
    switchScanMode('private');
    
    // Scroll to the form
    document.getElementById('checker-form').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
    
    // Focus on the manual input area
    setTimeout(() => {
        const manualContent = document.getElementById('manual-content');
        if (manualContent) {
            manualContent.focus();
        }
    }, 500);
}

function displayResults(results) {
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) {
        console.error('Results container not found');
        return;
    }
    
    // Handle both 'checks' and 'compliance' property names
    const checks = results.checks || results.compliance;
    
    // Validate results structure
    if (!results || !checks) {
        console.error('Invalid results structure:', results);
        alert('שגיאה בעיבוד תוצאות הבדיקה');
        return;
    }
    
    // Clear previous results
    resultsContainer.innerHTML = '';
    
    // Create new interactive results display
    const resultsHTML = `
        <div class="results-header">
            <h3>תוצאות בדיקת ${results.url}</h3>
            <div class="overall-score ${getScoreClass(results.overallScore || results.score)}">
                <div class="score-circle">
                    <span class="score-number">${results.overallScore || results.score || 0}</span>
                    <span class="score-label">ציון כולל</span>
                </div>
                <div class="score-status">${getScoreStatus(results.overallScore || results.score)}</div>
            </div>
        </div>
        
        <div class="scan-metadata">
            <span>🕐 זמן סריקה: ${new Date(results.timestamp).toLocaleString('he-IL')}</span>
            ${results.scanDuration ? `<span>⏱️ משך: ${(results.scanDuration/1000).toFixed(2)} שניות</span>` : ''}
            ${results.organizationType ? `<span>🏢 סוג ארגון: ${results.organizationType.name}</span>` : ''}
        </div>
        
        ${results.extractedData ? `
        <div class="website-context">
            <h4>📊 מידע שנאסף מהאתר</h4>
            <div class="context-grid">
                ${results.extractedData.metadata ? `
                <div class="context-item">
                    <strong>מטא-דאטה:</strong>
                    <ul>
                        <li>כותרת: ${results.extractedData.metadata.title || 'לא נמצא'}</li>
                        <li>תיאור: ${results.extractedData.metadata.description || 'לא נמצא'}</li>
                        <li>שפה: ${results.extractedData.metadata.language || 'לא מוגדר'}</li>
                    </ul>
                </div>` : ''}
                
                ${results.extractedData.content ? `
                <div class="context-item">
                    <strong>ניתוח תוכן:</strong>
                    <ul>
                        <li>מילים: ${results.extractedData.content.wordCount || 0}</li>
                        <li>עברית: ${results.extractedData.content.hebrewPercentage || 0}%</li>
                        <li>אורך: ${results.extractedData.content.totalLength || 0} תווים</li>
                    </ul>
                </div>` : ''}
                
                ${results.extractedData.scripts && results.extractedData.scripts.length > 0 ? `
                <div class="context-item">
                    <strong>סקריפטים שזוהו:</strong>
                    <ul>
                        ${results.extractedData.scripts.map(s => `<li>${s.name}</li>`).join('')}
                    </ul>
                </div>` : ''}
                
                ${results.extractedData.forms && results.extractedData.forms.length > 0 ? `
                <div class="context-item">
                    <strong>טפסים באתר:</strong>
                    <ul>
                        <li>סה"כ טפסים: ${results.extractedData.forms.length}</li>
                        <li>שדות אימייל: ${results.extractedData.forms.filter(f => f.hasEmailField).length}</li>
                        <li>שדות סיסמה: ${results.extractedData.forms.filter(f => f.hasPasswordField).length}</li>
                    </ul>
                </div>` : ''}
                
                ${results.extractedData.links ? `
                <div class="context-item">
                    <strong>קישורים:</strong>
                    <ul>
                        <li>סה"כ: ${results.extractedData.links.total || 0}</li>
                        <li>חיצוניים: ${results.extractedData.links.external || 0}</li>
                        <li>מדיניות פרטיות: ${results.extractedData.links.privacyLinks?.length || 0}</li>
                    </ul>
                </div>` : ''}
                
                ${results.extractedData.cookies && results.extractedData.cookies.length > 0 ? `
                <div class="context-item">
                    <strong>עוגיות שזוהו:</strong>
                    <ul>
                        ${results.extractedData.cookies.map(c => `<li>${c.name}</li>`).join('')}
                    </ul>
                </div>` : ''}
            </div>
        </div>` : ''}
        
        <div class="results-grid" id="interactive-results">
            <!-- Results will be inserted here -->
        </div>
        
        <div class="recommendations" id="recommendations">
            <h4>המלצות לשיפור</h4>
            <ul id="recommendations-list"></ul>
        </div>
        
        ${results.risks && results.risks.length > 0 ? `
        <div class="risks-section">
            <h4>⚠️ סיכונים שזוהו</h4>
            <div class="risks-list">
                ${results.risks.map(risk => `
                    <div class="risk-item risk-${risk.level}">
                        <strong>${risk.description}</strong>
                        <p>השפעה: ${risk.impact}</p>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}
        
        <div class="raw-data-section">
            <button class="btn-secondary" onclick="toggleRawData()">הצג נתונים גולמיים מלאים 📊</button>
            <div class="download-buttons" style="margin-top: 1rem;">
                <button class="btn-primary" onclick="downloadRawData()">
                    📥 הורד נתונים גולמיים (JSON)
                </button>
                <button class="btn-primary" onclick="downloadReport()">
                    📄 הורד דוח מלא (HTML)
                </button>
            </div>
            <pre id="raw-data" style="display: none;">${JSON.stringify(results, null, 2)}</pre>
        </div>
    `;
    
    resultsContainer.innerHTML = resultsHTML;
    resultsContainer.style.display = 'block';
    
    // Display interactive check results
    const interactiveResults = document.getElementById('interactive-results');
    if (checks.ssl) displayInteractiveCheck(interactiveResults, 'SSL/הצפנה', checks.ssl, 'ssl');
    if (checks.cookies) displayInteractiveCheck(interactiveResults, 'עוגיות', checks.cookies, 'cookies');
    if (checks.privacy) displayInteractiveCheck(interactiveResults, 'מדיניות פרטיות', checks.privacy, 'privacy');
    if (checks.hebrew || checks.transparency) {
        const hebrewCheck = checks.hebrew || {
            status: checks.transparency.status,
            details: checks.transparency.details
        };
        displayInteractiveCheck(interactiveResults, 'תוכן בעברית', hebrewCheck, 'hebrew');
    }
    if (checks.dataRights) displayInteractiveCheck(interactiveResults, 'זכויות נושאי מידע', checks.dataRights, 'rights');
    if (checks.security) displayInteractiveCheck(interactiveResults, 'אבטחת מידע', checks.security, 'security');
    if (checks.consent) displayInteractiveCheck(interactiveResults, 'מנגנוני הסכמה', checks.consent, 'consent');
    
    // Display recommendations
    if (results.recommendations && Array.isArray(results.recommendations)) {
        displayDetailedRecommendations(results.recommendations);
    } else {
        displayRecommendations(checks);
    }
    
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

function displayInteractiveCheck(container, title, check, checkType) {
    if (!check) return;
    
    const status = check.status || 'unknown';
    let statusClass = 'error';
    let statusIcon = '❌';
    let statusText = 'נכשל';
    
    if (status === 'pass' || status === 'compliant') {
        statusClass = 'success';
        statusIcon = '✅';
        statusText = 'עבר';
    } else if (status === 'warning' || status === 'partial') {
        statusClass = 'warning';
        statusIcon = '⚠️';
        statusText = 'חלקי';
    } else if (status === 'fail' || status === 'non-compliant') {
        statusClass = 'error';
        statusIcon = '❌';
        statusText = 'נכשל';
    }
    
    const checkId = `check-${checkType}-${Date.now()}`;
    
    const checkHTML = `
        <div class="interactive-check-item ${statusClass}" id="${checkId}">
            <div class="check-header" onclick="toggleCheckDetails('${checkId}')">
                <div class="check-title">
                    <span class="check-icon">${statusIcon}</span>
                    <h4>${title}</h4>
                </div>
                <div class="check-status">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    <span class="expand-icon">▼</span>
                </div>
            </div>
            <div class="check-details" style="display: none;">
                ${generateCheckDetails(check, checkType)}
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', checkHTML);
}

function generateCheckDetails(check, checkType) {
    let detailsHTML = '<div class="details-content">';
    
    // Add main message
    if (check.message) {
        detailsHTML += `<p class="main-message"><strong>סטטוס:</strong> ${check.message}</p>`;
    }
    
    // Add recommendation if exists
    if (check.recommendation) {
        detailsHTML += `
            <div class="detail-recommendation">
                <strong>💡 המלצה:</strong>
                <p>${check.recommendation}</p>
            </div>
        `;
    }
    
    // Add specific details based on check type
    if (check.details) {
        detailsHTML += '<div class="technical-details">';
        detailsHTML += '<h5>פרטים טכניים:</h5>';
        
        if (checkType === 'cookies' && check.details.cookieCount !== undefined) {
            detailsHTML += `
                <ul>
                    <li>מספר עוגיות שנמצאו: ${check.details.cookieCount}</li>
                    <li>עוגיות צד שלישי: ${check.details.thirdParty ? 'כן' : 'לא'}</li>
                    ${check.details.hasConsentBanner !== undefined ? 
                        `<li>באנר הסכמה: ${check.details.hasConsentBanner ? '✅ קיים' : '❌ חסר'}</li>` : ''}
                    ${check.details.allowsOptOut !== undefined ? 
                        `<li>אפשרות סירוב: ${check.details.allowsOptOut ? '✅ קיימת' : '❌ חסרה'}</li>` : ''}
                </ul>
            `;
        } else if (checkType === 'privacy' && check.details) {
            if (check.details.requiredSections) {
                detailsHTML += '<ul class="sections-checklist">';
                check.details.requiredSections.forEach(section => {
                    detailsHTML += `
                        <li class="${section.present ? 'present' : 'missing'}">
                            ${section.present ? '✅' : '❌'} ${section.name}
                        </li>
                    `;
                });
                detailsHTML += '</ul>';
            }
            if (check.details.lastUpdated) {
                detailsHTML += `<p>עדכון אחרון: ${check.details.lastUpdated}</p>`;
            }
        } else if (checkType === 'security' && check.details.measures) {
            detailsHTML += '<ul class="security-measures">';
            Object.entries(check.details.measures).forEach(([measure, enabled]) => {
                const measureNames = {
                    encryption: 'הצפנה',
                    accessControl: 'בקרת גישה',
                    auditLogs: 'רישום פעולות',
                    backups: 'גיבויים',
                    incidentResponse: 'תגובה לאירועים',
                    penetrationTesting: 'בדיקות חדירה'
                };
                detailsHTML += `
                    <li class="${enabled ? 'enabled' : 'disabled'}">
                        ${enabled ? '✅' : '❌'} ${measureNames[measure] || measure}
                    </li>
                `;
            });
            detailsHTML += '</ul>';
            if (check.details.complianceLevel) {
                detailsHTML += `<p><strong>רמת התאמה כוללת:</strong> ${check.details.complianceLevel}</p>`;
            }
        } else if (checkType === 'rights' && check.details) {
            detailsHTML += '<ul>';
            if (check.details.accessRight !== undefined) {
                detailsHTML += `<li>זכות עיון: ${check.details.accessRight ? '✅ מיושמת' : '❌ חסרה'}</li>`;
            }
            if (check.details.correctionRight !== undefined) {
                detailsHTML += `<li>זכות תיקון: ${check.details.correctionRight ? '✅ מיושמת' : '❌ חסרה'}</li>`;
            }
            if (check.details.deletionRight !== undefined) {
                detailsHTML += `<li>זכות מחיקה: ${check.details.deletionRight ? '✅ מיושמת' : '❌ חסרה'}</li>`;
            }
            if (check.details.responseTime) {
                detailsHTML += `<li>זמן תגובה: ${check.details.responseTime}</li>`;
            }
            detailsHTML += '</ul>';
        } else {
            // Generic details display
            detailsHTML += '<ul>';
            Object.entries(check.details).forEach(([key, value]) => {
                if (typeof value !== 'object') {
                    detailsHTML += `<li><strong>${key}:</strong> ${value}</li>`;
                }
            });
            detailsHTML += '</ul>';
        }
        
        detailsHTML += '</div>';
    }
    
    // Add raw data viewer
    detailsHTML += `
        <div class="raw-check-data">
            <button class="btn-link" onclick="toggleRawCheckData('${checkType}')">הצג נתונים גולמיים</button>
            <pre id="raw-${checkType}" style="display: none;">${JSON.stringify(check, null, 2)}</pre>
        </div>
    `;
    
    detailsHTML += '</div>';
    return detailsHTML;
}

function toggleCheckDetails(checkId) {
    const checkItem = document.getElementById(checkId);
    const details = checkItem.querySelector('.check-details');
    const expandIcon = checkItem.querySelector('.expand-icon');
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        expandIcon.textContent = '▲';
    } else {
        details.style.display = 'none';
        expandIcon.textContent = '▼';
    }
}

function toggleRawCheckData(checkType) {
    const rawData = document.getElementById(`raw-${checkType}`);
    if (rawData) {
        rawData.style.display = rawData.style.display === 'none' ? 'block' : 'none';
    }
}

function toggleRawData() {
    const rawData = document.getElementById('raw-data');
    if (rawData) {
        rawData.style.display = rawData.style.display === 'none' ? 'block' : 'none';
    }
}

function getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
}

function getScoreStatus(score) {
    if (score >= 80) return 'מצוין! האתר עומד ברוב הדרישות';
    if (score >= 60) return 'טוב, אך יש מקום לשיפור';
    if (score >= 40) return 'נדרשים שיפורים משמעותיים';
    return 'נדרשת היערכות מיידית';
}

function displayRecommendations(checks) {
    const recommendationsList = document.getElementById('recommendations-list');
    if (!recommendationsList) return;
    
    recommendationsList.innerHTML = '';
    
    for (const check of Object.values(checks)) {
        if (check.recommendation) {
            const li = document.createElement('li');
            li.textContent = check.recommendation;
            recommendationsList.appendChild(li);
        }
    }
    
    const recommendationsSection = document.getElementById('recommendations');
    if (recommendationsList.children.length === 0) {
        recommendationsSection.style.display = 'none';
    } else {
        recommendationsSection.style.display = 'block';
    }
}

function getCategoryTitle(category) {
    const titles = {
        'ssl': 'אבטחת SSL',
        'cookies': 'ניהול עוגיות',
        'privacy': 'מדיניות פרטיות',
        'hebrew': 'תוכן בעברית',
        'security': 'אבטחת מידע',
        'dataCollection': 'איסוף נתונים',
        'transparency': 'שקיפות',
        'consent': 'הסכמה מדעת'
    };
    return titles[category] || category;
}

function displayDetailedRecommendations(recommendations) {
    const recommendationsList = document.getElementById('recommendations-list');
    if (!recommendationsList) return;
    
    recommendationsList.innerHTML = '';
    
    for (const rec of recommendations) {
        const li = document.createElement('li');
        
        // Handle different recommendation formats
        if (typeof rec === 'object' && rec !== null) {
            // Object format recommendation
            let recommendationText = '';
            
            // Check for different possible text fields
            if (rec.action) {
                recommendationText = rec.action;
            } else if (rec.message) {
                recommendationText = rec.message;
            } else if (rec.text) {
                recommendationText = rec.text;
            } else if (rec.description) {
                recommendationText = rec.description;
            }
            
            // Add category prefix if available
            if (rec.category && recommendationText) {
                const categoryTitle = getCategoryTitle(rec.category);
                li.innerHTML = `<strong>${categoryTitle}:</strong> ${recommendationText}`;
            } else if (recommendationText) {
                li.textContent = recommendationText;
            } else {
                // Skip empty recommendations
                continue;
            }
            
            // Apply priority styling
            if (rec.priority === 'high') {
                li.style.color = '#ef4444';
                li.style.fontWeight = '600';
            } else if (rec.priority === 'medium') {
                li.style.color = '#f59e0b';
            }
        } else if (typeof rec === 'string' && rec.trim()) {
            // Simple string recommendation
            li.textContent = rec;
        } else {
            // Skip invalid recommendations
            continue;
        }
        
        recommendationsList.appendChild(li);
    }
    
    const recommendationsSection = document.getElementById('recommendations');
    if (recommendationsList.children.length === 0) {
        recommendationsSection.style.display = 'none';
    } else {
        recommendationsSection.style.display = 'block';
    }
}

function handleNewsletterSignup(e) {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value;
    alert(`תודה על ההרשמה! נשלח עדכונים ל-${email}`);
    e.target.reset();
}

// Cookie Guide Modal Functions
function openCookieGuideModal() {
    const modal = document.getElementById('cookie-guide-modal');
    const content = document.getElementById('cookie-guide-content');
    
    // Load the content
    const guideContent = `
        <h2>סקירה כללית</h2>
        <p>תיקון 13 לחוק הגנת הפרטיות, שנכנס לתוקף באוגוסט 2025, מחייב אתרי אינטרנט ישראליים לקבל הסכמה מפורשת ומדעת מהמשתמשים לפני שימוש בעוגיות למטרות שאינן חיוניות לתפקוד האתר.</p>
        
        <h3>✅ מה כולל הפתרון שלנו?</h3>
        <ul>
            <li>הסכמה מפורשת לפני הפעלת עוגיות</li>
            <li>אפשרות דחייה ברורה</li>
            <li>בחירה גרנולרית של קטגוריות</li>
            <li>מנגנון ביטול הסכמה</li>
            <li>רישום ותיעוד הסכמות</li>
            <li>תמיכה מלאה בעברית ו-RTL</li>
        </ul>

        <h2>דרישות עיקריות של תיקון 13</h2>
        
        <h3>1. הסכמה מפורשת ומדעת</h3>
        <ul>
            <li><strong>לפני הפעלת עוגיות:</strong> אסור להפעיל עוגיות לא-חיוניות לפני קבלת הסכמה</li>
            <li><strong>מידע ברור:</strong> יש להציג למשתמש מידע ברור על סוגי העוגיות והשימוש בהן</li>
            <li><strong>פעולה אקטיבית:</strong> ההסכמה חייבת להינתן בפעולה אקטיבית (לחיצה על כפתור)</li>
        </ul>
        
        <h3>2. אפשרות דחייה</h3>
        <ul>
            <li><strong>כפתור דחייה בולט:</strong> חייב להיות כפתור ברור לדחיית כל העוגיות הלא-חיוניות</li>
            <li><strong>המשך גלישה:</strong> המשתמש צריך להיות מסוגל להמשיך לגלוש באתר גם אם דחה עוגיות</li>
        </ul>
        
        <h3>3. בחירה גרנולרית</h3>
        <ul>
            <li><strong>קטגוריות נפרדות:</strong> הפרדה בין סוגי עוגיות (חיוניות, תפקודיות, אנליטיקס, שיווק)</li>
            <li><strong>בחירה פרטנית:</strong> אפשרות לאשר/לדחות כל קטגוריה בנפרד</li>
        </ul>
        
        <h3>4. ביטול הסכמה</h3>
        <ul>
            <li><strong>נגישות מתמדת:</strong> אפשרות לבטל או לשנות הסכמה בכל עת</li>
            <li><strong>תהליך פשוט:</strong> ביטול ההסכמה צריך להיות פשוט כמו מתן ההסכמה</li>
        </ul>
        
        <h3>5. תיעוד ושמירת נתונים</h3>
        <ul>
            <li><strong>חותמת זמן:</strong> רישום מתי ניתנה ההסכמה</li>
            <li><strong>גרסת הסכמה:</strong> תיעוד גרסת מדיניות העוגיות</li>
            <li><strong>שמירת העדפות:</strong> שמירת העדפות המשתמש לתקופה סבירה (עד שנה)</li>
        </ul>

        <h2>התקנת מערכת ההסכמה</h2>
        
        <h3>שלב 1: הוספת הקבצים לאתר</h3>
        <pre><code>&lt;!-- בתוך ה-&lt;head&gt; של האתר --&gt;
&lt;link rel="stylesheet" href="assets/vendor/cookieconsent/cookieconsent.css"&gt;</code></pre>
        
        <h3>שלב 2: הוספת הסקריפט</h3>
        <pre><code>&lt;script type="module"&gt;
    import './assets/vendor/cookieconsent/cookieconsent.esm.js';
    import heTranslations from './assets/translations/he.json' assert { type: 'json' };
    
    window.CookieConsent.run({
        // התצורה המלאה
    });
&lt;/script&gt;</code></pre>

        <h2>קטגוריות עוגיות</h2>
        
        <p>המערכת תומכת ב-4 קטגוריות עיקריות:</p>
        
        <h3>1. עוגיות חיוניות (Necessary)</h3>
        <p>עוגיות הכרחיות לתפקוד האתר - תמיד פעילות ולא ניתן לבטל אותן.</p>
        
        <h3>2. עוגיות תפקודיות (Functionality)</h3>
        <p>עוגיות המשפרות את חוויית המשתמש (העדפות שפה, ערכת נושא וכד').</p>
        
        <h3>3. עוגיות אנליטיקס (Analytics)</h3>
        <p>עוגיות לניתוח השימוש באתר (Google Analytics וכד').</p>
        
        <h3>4. עוגיות שיווק (Marketing)</h3>
        <p>עוגיות לצרכי פרסום ושיווק ממוקד.</p>

        <h2>שאלות נפוצות</h2>
        
        <h3>ש: האם המערכת תואמת GDPR?</h3>
        <p><strong>ת:</strong> כן, המערכת תואמת גם GDPR וגם תיקון 13. היא מכסה את כל הדרישות של שני התקנים.</p>
        
        <h3>ש: איך מטפלים בגולשים עם חוסמי פרסומות?</h3>
        <p><strong>ת:</strong> המערכת פועלת גם עם חוסמי פרסומות כי היא לא משתמשת בשירותי צד שלישי.</p>
        
        <h3>ש: כמה זמן נשמרת ההסכמה?</h3>
        <p><strong>ת:</strong> ברירת המחדל היא שנה (365 ימים), אך ניתן להתאים זאת בתצורה.</p>

        <div class="warning-box">
            <strong>⚠️ אזהרה חשובה:</strong> מדריך זה מספק הנחיות טכניות בלבד ואינו מהווה ייעוץ משפטי. יש להיוועץ בעורך דין המתמחה בדיני פרטיות וטכנולוגיה לצורך עמידה מלאה בדרישות החוק.
        </div>
    `;
    
    content.innerHTML = guideContent;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeCookieGuideModal() {
    const modal = document.getElementById('cookie-guide-modal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('cookie-guide-modal');
    if (event.target === modal) {
        closeCookieGuideModal();
    }
});

function initResourceDownloads() {
    window.downloadChecklist = function() {
        const checklist = `רשימת תיוג להיערכות לתיקון 13
=====================================

□ מיפוי ותיעוד מאגרי מידע
□ בדיקת חובת רישום מאגרים
□ הכנת מסמכי הגדרת מאגר
□ בחינת הצורך במינוי ממונה הגנת פרטיות
□ עדכון מדיניות פרטיות בעברית
□ הטמעת מנגנון הסכמה לעוגיות
□ יישום אמצעי אבטחת מידע
□ הכנת נהלי דיווח על אירועי אבטחה
□ הטמעת זכויות נושאי מידע
□ הכשרת עובדים

תאריך יעד: 14 באוגוסט 2025`;
        
        downloadTextFile('tikun13-checklist.txt', checklist);
    };
    
    window.downloadTemplate = function() {
        const template = `מדיניות פרטיות - תבנית לדוגמה
==================================

1. כללי
[שם החברה] ("החברה") מכבדת את פרטיותך ומחויבת להגן על המידע האישי שלך בהתאם לחוק הגנת הפרטיות, התשמ"א-1981 ותיקון 13.

2. איסוף מידע
אנו אוספים את סוגי המידע הבאים:
- מידע שאתה מספק באופן ישיר
- מידע שנאסף באופן אוטומטי
- מידע מצדדים שלישיים

3. שימוש במידע
אנו משתמשים במידע שלך למטרות הבאות:
- אספקת השירותים
- שיפור חוויית המשתמש
- עמידה בדרישות החוק

4. זכויותיך
על פי החוק, זכותך:
- לעיין במידע האישי שלך (סעיף 13)
- לתקן מידע שגוי (סעיף 14)
- למחוק מידע בנסיבות מסוימות
- להתנגד לשימושים מסוימים

5. אבטחת מידע
אנו נוקטים באמצעי אבטחה טכנולוגיים וארגוניים להגנה על המידע שלך.

6. יצירת קשר
לשאלות בנושא פרטיות: privacy@example.co.il

עדכון אחרון: [תאריך]`;
        
        downloadTextFile('privacy-policy-template.txt', template);
    };
    
    window.downloadBanner = function() {
        const bannerCode = `<!-- Tikun 13 Cookie Consent Banner -->
<div id="cookie-consent" style="
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #2c3e50;
    color: white;
    padding: 20px;
    text-align: center;
    z-index: 9999;
    direction: rtl;
">
    <div style="max-width: 1200px; margin: 0 auto;">
        <p style="margin: 0 0 15px 0;">
            אתר זה משתמש בעוגיות כדי לשפר את חוויית הגלישה שלך. 
            <a href="/privacy" style="color: #3498db;">למידע נוסף</a>
        </p>
        <div>
            <button onclick="acceptCookies()" style="
                background: #27ae60;
                color: white;
                border: none;
                padding: 10px 30px;
                margin: 0 10px;
                border-radius: 5px;
                cursor: pointer;
            ">אשר הכל</button>
            <button onclick="showCookieSettings()" style="
                background: transparent;
                color: white;
                border: 1px solid white;
                padding: 10px 30px;
                margin: 0 10px;
                border-radius: 5px;
                cursor: pointer;
            ">הגדרות</button>
            <button onclick="rejectCookies()" style="
                background: transparent;
                color: white;
                border: 1px solid white;
                padding: 10px 30px;
                margin: 0 10px;
                border-radius: 5px;
                cursor: pointer;
            ">דחה</button>
        </div>
    </div>
</div>

<script>
function acceptCookies() {
    localStorage.setItem('cookieConsent', 'accepted');
    document.getElementById('cookie-consent').style.display = 'none';
}

function rejectCookies() {
    localStorage.setItem('cookieConsent', 'rejected');
    document.getElementById('cookie-consent').style.display = 'none';
}

function showCookieSettings() {
    // פתח חלון הגדרות עוגיות
    alert('הגדרות עוגיות - יש להטמיע לפי הצורך');
}

// בדוק אם המשתמש כבר נתן הסכמה
if (localStorage.getItem('cookieConsent')) {
    document.getElementById('cookie-consent').style.display = 'none';
}
</script>`;
        
        downloadTextFile('cookie-banner.html', bannerCode);
    };
}

function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

window.showTerms = function() {
    alert('תנאי השימוש יופיעו כאן');
};

window.showPrivacy = function() {
    alert('מדיניות הפרטיות תופיע כאן');
};

// Download functions
window.downloadRawData = function() {
    if (!latestScanResults) {
        alert('אין תוצאות סריקה להורדה');
        return;
    }
    
    const dataStr = JSON.stringify(latestScanResults, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tikun13-scan-${latestScanResults.websiteContext?.domain || 'website'}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
};

window.downloadReport = function() {
    if (!latestScanResults) {
        alert('אין תוצאות סריקה להורדה');
        return;
    }
    
    const report = generateHTMLReport(latestScanResults);
    const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tikun13-report-${latestScanResults.websiteContext?.domain || 'website'}-${Date.now()}.html`;
    link.click();
    URL.revokeObjectURL(url);
};

function generateHTMLReport(results) {
    const scoreClass = getScoreClass(results.score || 0);
    const scoreStatus = getScoreStatus(results.score || 0);
    
    return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>דוח בדיקת תיקון 13 - ${results.url}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .score-circle {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: white;
            color: #333;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            font-weight: bold;
            margin: 20px auto;
        }
        .section {
            background: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .check-item {
            padding: 15px;
            margin: 10px 0;
            border-right: 4px solid;
            background: #f9f9f9;
        }
        .success { border-color: #10b981; }
        .warning { border-color: #f59e0b; }
        .error { border-color: #ef4444; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 10px;
            text-align: right;
            border: 1px solid #ddd;
        }
        th {
            background: #f5f5f5;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            padding: 20px;
            margin-top: 40px;
            border-top: 2px solid #ddd;
        }
        .ionsec-branding {
            background: #1e293b;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px;
            margin-top: 30px;
        }
        .ionsec-branding a {
            color: #60a5fa;
            text-decoration: none;
        }
        pre {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
            direction: ltr;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>דוח בדיקת התאמה לתיקון 13</h1>
        <p>חוק הגנת הפרטיות - תיקון מספר 13</p>
        <div class="score-circle">${results.score || 0}</div>
        <p style="text-align: center;">${scoreStatus}</p>
    </div>

    <div class="section">
        <h2>פרטי הסריקה</h2>
        <table>
            <tr><th>כתובת אתר</th><td>${results.url}</td></tr>
            <tr><th>תאריך סריקה</th><td>${new Date(results.timestamp).toLocaleString('he-IL')}</td></tr>
            <tr><th>משך סריקה</th><td>${results.scanDuration ? (results.scanDuration/1000).toFixed(2) + ' שניות' : 'לא זמין'}</td></tr>
            <tr><th>ציון כולל</th><td>${results.score || 0}/100</td></tr>
        </table>
    </div>

    ${results.extractedData ? `
    <div class="section">
        <h2>מידע שנאסף מהאתר</h2>
        <table>
            <tr><th>כותרת</th><td>${results.extractedData.metadata?.title || 'לא נמצא'}</td></tr>
            <tr><th>שפה</th><td>${results.extractedData.metadata?.language || 'לא מוגדר'}</td></tr>
            <tr><th>תוכן בעברית</th><td>${results.extractedData.content?.hebrewPercentage || 0}%</td></tr>
            <tr><th>טפסים</th><td>${results.extractedData.forms?.length || 0}</td></tr>
            <tr><th>עוגיות שזוהו</th><td>${results.extractedData.cookies?.length || 0}</td></tr>
            <tr><th>סקריפטים של צד שלישי</th><td>${results.extractedData.scripts?.length || 0}</td></tr>
        </table>
    </div>` : ''}

    <div class="section">
        <h2>תוצאות בדיקות התאמה</h2>
        ${Object.entries(results.compliance || results.checks || {}).map(([key, check]) => `
            <div class="check-item ${check.status === 'compliant' || check.status === 'pass' ? 'success' : 
                                    check.status === 'partial' || check.status === 'warning' ? 'warning' : 'error'}">
                <h3>${getCheckTitle(key)}</h3>
                <p>סטטוס: ${getStatusText(check.status)}</p>
                ${check.details?.recommendation ? `<p>המלצה: ${check.details.recommendation}</p>` : ''}
            </div>
        `).join('')}
    </div>

    ${results.recommendations && results.recommendations.length > 0 ? `
    <div class="section">
        <h2>המלצות לשיפור</h2>
        <ul>
            ${results.recommendations.map(rec => {
                if (typeof rec === 'object' && rec !== null) {
                    const text = rec.action || rec.message || rec.text || rec.description || '';
                    const category = rec.category ? getCategoryTitle(rec.category) + ': ' : '';
                    const priority = rec.priority ? ` (עדיפות: ${rec.priority === 'high' ? 'גבוהה' : rec.priority === 'medium' ? 'בינונית' : 'נמוכה'})` : '';
                    return text ? `<li><strong>${category}${text}</strong>${priority}</li>` : '';
                } else if (typeof rec === 'string') {
                    return `<li>${rec}</li>`;
                }
                return '';
            }).filter(item => item).join('')}
        </ul>
    </div>` : ''}

    ${results.risks && results.risks.length > 0 ? `
    <div class="section">
        <h2>סיכונים שזוהו</h2>
        ${results.risks.map(risk => `
            <div class="check-item ${risk.level === 'high' ? 'error' : risk.level === 'medium' ? 'warning' : 'success'}">
                <strong>${risk.description}</strong>
                <p>השפעה: ${risk.impact}</p>
            </div>
        `).join('')}
    </div>` : ''}

    <div class="ionsec-branding">
        <h3>פותח על ידי IONSEC.IO</h3>
        <p>פרויקט קוד פתוח לבדיקת התאמה לתיקון 13</p>
        <p>
            <a href="https://ionsec.io" target="_blank">IONSEC.IO</a> | 
            <a href="https://github.com/ionsec" target="_blank">GitHub</a> | 
            <a href="https://linkedin.com/company/ionsec" target="_blank">LinkedIn</a>
        </p>
        <p>לייעוץ מקצועי בנושא אבטחת מידע והגנת פרטיות: info@ionsec.io</p>
    </div>

    <div class="footer">
        <p>דוח זה נוצר באופן אוטומטי ומספק הערכה ראשונית בלבד</p>
        <p>לקבלת ייעוץ מקצועי מלא, מומלץ לפנות למומחה בתחום</p>
        <p>תאריך יצירת הדוח: ${new Date().toLocaleString('he-IL')}</p>
    </div>
</body>
</html>`;
}

function getCheckTitle(key) {
    const titles = {
        ssl: 'אבטחת SSL/HTTPS',
        cookies: 'ניהול עוגיות',
        privacy: 'מדיניות פרטיות',
        hebrew: 'תוכן בעברית',
        dataCollection: 'איסוף מידע',
        security: 'אמצעי אבטחה',
        transparency: 'שקיפות',
        dataRights: 'זכויות נושאי מידע',
        consent: 'מנגנוני הסכמה'
    };
    return titles[key] || key;
}

function getStatusText(status) {
    const statuses = {
        'compliant': 'תואם',
        'partial': 'תואם חלקית',
        'non-compliant': 'לא תואם',
        'pass': 'עבר',
        'warning': 'אזהרה',
        'fail': 'נכשל',
        'error': 'שגיאה'
    };
    return statuses[status] || status;
}

// Section Navigation Functions
window.showScannerSection = function() {
    // Show scanner section
    const scannerSection = document.getElementById('scanner-section');
    const assessmentSection = document.getElementById('assessment');
    const cookieBuilderSection = document.getElementById('cookie-builder-section');
    
    if (scannerSection) scannerSection.style.display = 'block';
    if (assessmentSection) assessmentSection.style.display = 'none';
    if (cookieBuilderSection) cookieBuilderSection.style.display = 'none';
    
    // Update button states
    const scannerBtn = document.querySelector('.switch-btn:first-child');
    const assessmentBtn = document.querySelector('.switch-btn:last-child');
    if (scannerBtn) {
        scannerBtn.classList.add('active');
        scannerBtn.classList.remove('highlight');
    }
    if (assessmentBtn) {
        assessmentBtn.classList.remove('active');
        assessmentBtn.classList.add('highlight');
    }
    
    // Update nav active state
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.textContent.includes('סריקת')) {
            link.classList.add('active');
        }
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.showAssessmentSection = function(scrollToTop = true) {
    // Show assessment section
    const scannerSection = document.getElementById('scanner-section');
    const assessmentSection = document.getElementById('assessment');
    const cookieBuilderSection = document.getElementById('cookie-builder-section');
    
    if (scannerSection) scannerSection.style.display = 'none';
    if (assessmentSection) assessmentSection.style.display = 'block';
    if (cookieBuilderSection) cookieBuilderSection.style.display = 'none';
    
    // Update button states
    const scannerBtn = document.querySelector('.switch-btn:first-child');
    const assessmentBtn = document.querySelector('.switch-btn:last-child');
    if (scannerBtn) {
        scannerBtn.classList.remove('active');
        scannerBtn.classList.remove('highlight');
    }
    if (assessmentBtn) {
        assessmentBtn.classList.add('active');
        assessmentBtn.classList.remove('highlight');
    }
    
    // Update nav active state
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.textContent.includes('הערכה')) {
            link.classList.add('active');
        }
    });
    
    // Initialize assessment if needed
    if (!window.assessmentEngine && document.getElementById('assessment-container')) {
        // Check if AssessmentEngine is available, if not, wait for it to load
        if (typeof AssessmentEngine !== 'undefined') {
            window.assessmentEngine = new AssessmentEngine();
        } else {
            // Trigger loading of assessment modules if not already loaded
            if (typeof loadAssessmentModules === 'function') {
                loadAssessmentModules();
            }
            // Wait for AssessmentEngine to be available
            const checkInterval = setInterval(() => {
                if (typeof AssessmentEngine !== 'undefined') {
                    window.assessmentEngine = new AssessmentEngine();
                    clearInterval(checkInterval);
                }
            }, 100);
            // Timeout after 5 seconds
            setTimeout(() => clearInterval(checkInterval), 5000);
        }
    }
    
    // Scroll to top
    if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Cancel scan function
window.cancelScan = function() {
    if (currentScan) {
        currentScan.cancel();
        currentScan = null;
    }
    showLoadingOverlay(false);
};

// UI Helper functions for manual input mode
window.showInstructions = function() {
    const modal = document.getElementById('instructions-modal');
    if (modal) {
        modal.style.display = 'block';
    }
};

window.closeInstructions = function() {
    const modal = document.getElementById('instructions-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.setInputMode = function(mode) {
    // Currently only manual mode is supported for privacy
    const manualMode = document.getElementById('manual-input-mode');
    if (manualMode) {
        manualMode.style.display = 'block';
    }
};

// Scan Control Functions
window.rescanWebsite = async function() {
    if (!lastScannedUrl) {
        alert('אין כתובת לסריקה חוזרת');
        return;
    }
    
    // Update UI
    document.getElementById('checker-title').textContent = 'מבצע סריקה חוזרת...';
    
    // Restore the previous scan mode
    currentScanMode = lastScanMode || 'private';
    
    // Set appropriate form fields based on scan mode
    if (currentScanMode === 'proxy') {
        // For proxy mode, set the proxy URL input and call handleProxyCheck
        const proxyUrlInput = document.getElementById('proxy-url');
        if (proxyUrlInput) {
            proxyUrlInput.value = lastScannedUrl;
        }
        
        // Create a fake event for handleProxyCheck
        const fakeEvent = { preventDefault: () => {} };
        await handleProxyCheck(fakeEvent);
    } else {
        // For private mode, set the website URL input and call handleWebsiteCheck  
        const urlInput = document.getElementById('website-url');
        if (urlInput) {
            urlInput.value = lastScannedUrl;
        }
        
        // Create a fake event for handleWebsiteCheck
        const fakeEvent = { preventDefault: () => {} };
        await handleWebsiteCheck(fakeEvent);
    }
};

window.newScan = function() {
    // Clear the input
    document.getElementById('website-url').value = '';
    
    // Reset title
    document.getElementById('checker-title').textContent = 'בדיקת התאמה חינמית';
    
    // Hide scan controls
    document.getElementById('scan-controls').style.display = 'none';
    
    // Hide results
    document.getElementById('results').style.display = 'none';
    
    // Focus on input
    document.getElementById('website-url').focus();
    
    // Scroll to form
    document.getElementById('checker-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.clearForm = function() {
    // Clear everything
    document.getElementById('website-url').value = '';
    document.getElementById('checker-title').textContent = 'בדיקת התאמה חינמית';
    document.getElementById('scan-controls').style.display = 'none';
    document.getElementById('results').style.display = 'none';
    
    // Clear stored data
    lastScannedUrl = null;
    latestScanResults = null;
    
    // Focus on input
    document.getElementById('website-url').focus();
};

// Cookie Builder Section
window.showCookieBuilderSection = function(scrollToTop = true) {
    // Show cookie builder section
    const scannerSection = document.getElementById('scanner-section');
    const assessmentSection = document.getElementById('assessment');
    const cookieBuilderSection = document.getElementById('cookie-builder-section');
    const highlightBanner = document.getElementById('cookie-builder-highlight');
    
    if (scannerSection) scannerSection.style.display = 'none';
    if (assessmentSection) assessmentSection.style.display = 'none';
    if (cookieBuilderSection) cookieBuilderSection.style.display = 'block';
    
    // Show highlight banner when navigating from header button
    if (highlightBanner) {
        highlightBanner.style.display = 'block';
        highlightBanner.classList.add('animate-in');
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (highlightBanner && highlightBanner.style.display !== 'none') {
                highlightBanner.style.display = 'none';
            }
        }, 10000);
    }
    
    // Update section switcher buttons
    const buttons = document.querySelectorAll('.section-switcher .switch-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (buttons[2]) buttons[2].classList.add('active'); // Third button for cookie builder
    
    // Update nav active state
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.textContent.includes('בונה עוגיות')) {
            link.classList.add('active');
        }
    });
    
    // Scroll to top if needed
    if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // Initialize cookie builder if available
    if (typeof CookieBuilder !== 'undefined' && typeof CookieBuilder.init === 'function') {
        CookieBuilder.init();
    }
    
    // Show notification about the feature
    showNotification('ברוכים הבאים לכלי יצירת באנר העוגיות - צור באנר מותאם אישית תואם תיקון 13!');
};

// Resources Tab Functions

function showResourceTab(tabName) {
    // Hide all tab panes
    const panes = document.querySelectorAll('.resource-tab-content');
    panes.forEach(pane => pane.classList.remove('active'));
    
    // Remove active class from all tab buttons
    const tabs = document.querySelectorAll('.resource-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab pane
    const selectedPane = document.getElementById(tabName + '-tab');
    if (selectedPane) {
        selectedPane.classList.add('active');
    }
    
    // Add active class to selected tab button
    const selectedTab = document.querySelector(`[onclick="showResourceTab('${tabName}')"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
}

function downloadChecklist(type) {
    const checklists = {
        'mapping': {
            name: 'checklist_data_mapping.pdf',
            content: `צ'ק ליסט: מיפוי מאגרי מידע
            
□ זיהוי כל מאגרי המידע בארגון
□ תיעוד סוג המידע הנאסף בכל מאגר
□ סיווג מאגרים לפי רמת רגישות (רגיש/רגיל)
□ תיעוד מטרות איסוף המידע
□ מיפוי זרימת המידע בין מערכות
□ זיהוי צדדים שלישיים עם גישה למידע
□ תיעוד בסיס החוקי לעיבוד
□ קביעת תקופות שמירה
□ רישום המאגרים ברשם מאגרי המידע
□ עדכון שוטף של המיפוי`
        },
        'dpo': {
            name: 'checklist_dpo_appointment.pdf',
            content: `צ'ק ליסט: מינוי ממונה הגנת פרטיות (DPO)
            
□ האם הארגון מעסיק מעל 50 עובדים?
□ האם הארגון מחזיק מאגר מידע הכולל מעל 100,000 רשומות?
□ האם קיים מאגר מידע רגיש (בריאות, גנטי, פלילי)?
□ האם מונה ממונה הגנת פרטיות?
□ האם הממונה עבר הכשרה מתאימה?
□ האם הממונה בעל 5 שנות ניסיון רלוונטי?
□ האם פרטי הממונה פורסמו באתר?
□ האם הממונה נרשם ברשם מאגרי המידע?
□ האם הוגדרו סמכויות הממונה בכתב?
□ האם הממונה מדווח ישירות להנהלה?`
        },
        'security': {
            name: 'checklist_data_security.pdf',
            content: `צ'ק ליסט: אבטחת מידע לפי תיקון 13
            
□ הצפנת SSL/TLS בכל האתר
□ מדיניות סיסמאות חזקות
□ אימות דו-שלבי למערכות רגישות
□ גיבויים אוטומטיים יומיים
□ הצפנת מאגרי מידע רגישים
□ ניטור גישה למאגרי מידע
□ בדיקות חדירה תקופתיות
□ תוכנית התאוששות מאסון
□ הגבלת גישה על בסיס Need-to-Know
□ רישום כל הפעולות במאגר`
        },
        'rights': {
            name: 'checklist_data_rights.pdf',
            content: `צ'ק ליסט: מימוש זכויות נושאי המידע
            
□ מנגנון עיון במידע אישי
□ אפשרות תיקון מידע שגוי
□ אפשרות מחיקת מידע
□ מנגנון הסרה מרשימות דיוור
□ ניידות נתונים (Data Portability)
□ זמן תגובה עד 30 יום
□ ללא עלות לנושא המידע
□ אימות זהות לפני מתן מידע
□ תיעוד כל הבקשות
□ מענה בשפת הפנייה`
        }
    };
    
    const checklist = checklists[type];
    if (checklist) {
        // Create a blob with the content
        const blob = new Blob([checklist.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = checklist.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show notification
        showNotification('הצ\'ק ליסט הורד בהצלחה!');
    }
}

function downloadTemplate(type) {
    const templates = {
        'privacy': {
            name: 'privacy_policy_tikun13.docx',
            content: `מדיניות פרטיות תואמת תיקון 13 לחוק הגנת הפרטיות
=====================================

1. מבוא והגדרות
--------------
[שם החברה/הארגון] (להלן: "החברה", "אנחנו") מכבדת את פרטיותך ומחויבת להגן על המידע האישי שלך בהתאם לחוק הגנת הפרטיות, התשמ"א-1981 ותיקון 13 שנכנס לתוקף ב-14 באוגוסט 2025.

הגדרות:
• "מידע אישי": כל נתון הנוגע לאדם מזוהה או לאדם הניתן לזיהוי
• "מידע בעל רגישות מיוחדת": מידע רפואי, גנטי, ביומטרי, על דעות פוליטיות, אמונות דתיות, נטייה מינית, עבר פלילי, מוצא אתני
• "עיבוד": כל פעולה שמבוצעת על מידע אישי, לרבות איסוף, אחסון, העתקה, מסירה, מחיקה

2. בסיס חוקי לאיסוף ועיבוד מידע
-----------------------------
אנו אוספים ומעבדים מידע אישי על בסיס:
□ הסכמתך המפורשת והמדעת
□ צורך בביצוע חוזה שאתה צד לו
□ חובה חוקית המוטלת עלינו
□ אינטרס לגיטימי של החברה (בכפוף לאיזון עם זכויותיך)

3. סוגי המידע שאנו אוספים
----------------------
3.1 מידע שאתה מספק ישירות:
• פרטים מזהים: שם, ת.ז., כתובת, טלפון, דוא"ל
• פרטי תשלום: מספר כרטיס אשראי, חשבון בנק (מוצפנים)
• תוכן שיצרת: הודעות, תגובות, העלאות

3.2 מידע שנאסף אוטומטית:
• נתוני גלישה: כתובת IP, סוג דפדפן, מערכת הפעלה
• עוגיות: העדפות, היסטוריית גלישה באתר
• נתוני מיקום: בהסכמתך המפורשת בלבד

3.3 מידע מצדדים שלישיים:
• רשתות חברתיות: בהתאם להרשאות שנתת
• שותפים עסקיים: בהתאם להסכמים

4. מטרות השימוש במידע
-------------------
• אספקת השירותים/המוצרים שהזמנת
• שיפור חוויית המשתמש והתאמה אישית
• תמיכה ושירות לקוחות
• תקשורת שיווקית (בהסכמתך)
• עמידה בדרישות החוק והרגולציה
• מניעת הונאות ואבטחת מידע
• ניתוחים סטטיסטיים (במידע מצרפי בלבד)

5. שיתוף מידע עם צדדים שלישיים
---------------------------
איננו מוכרים, משכירים או סוחרים במידע האישי שלך. נשתף מידע רק:
• בהסכמתך המפורשת
• עם ספקי שירות הפועלים מטעמנו (בהסכמי סודיות)
• לצורך אספקת השירות שביקשת
• על פי צו שיפוטי או דרישת רשות מוסמכת
• בעת מיזוג, רכישה או מכירת נכסים (בהודעה מראש)

6. אבטחת מידע
-----------
אנו מיישמים אמצעי אבטחה בהתאם לתקנות אבטחת מידע, התשע"ז-2017:
• הצפנת נתונים רגישים
• בקרת גישה והרשאות
• ניטור ותיעוד פעילות
• גיבויים תקופתיים
• הדרכות עובדים
• סקרי סיכונים ומבדקי חדירה (למאגרים גדולים)

7. זכויותיך לפי תיקון 13
--------------------
□ זכות עיון: לקבל מידע על הנתונים שלך המוחזקים אצלנו
□ זכות תיקון: לתקן מידע שגוי או לא מעודכן
□ זכות מחיקה: לבקש מחיקת מידע (בכפוף לחוק)
□ זכות הגבלת עיבוד: להגביל שימושים מסוימים
□ זכות ניידות: לקבל את המידע בפורמט נייד
□ זכות התנגדות: להתנגד לעיבוד למטרות שיווק
□ זכות ביטול הסכמה: לבטל הסכמה שניתנה

למימוש זכויותיך, פנה לממונה הגנת הפרטיות שלנו.

8. שמירת מידע
-----------
נשמור את המידע רק כל עוד נדרש:
• למטרה שלשמה נאסף
• לעמידה בדרישות החוק
• להגנה מפני תביעות

מידע שאינו נחוץ יימחק או יהפוך לאנונימי.

9. העברת מידע לחו"ל
-----------------
במקרה של העברת מידע מחוץ לישראל:
• נוודא רמת הגנה נאותה במדינת היעד
• נחתום על הסכמי העברת נתונים מתאימים
• ניידע אותך ונקבל הסכמתך כנדרש

10. קטינים
--------
איננו אוספים ביודעין מידע מקטינים מתחת לגיל 14 ללא הסכמת הורה.

11. עוגיות
--------
אנו משתמשים בעוגיות לשיפור חוויית הגלישה. ראה מדיניות עוגיות נפרדת.

12. שינויים במדיניות
-----------------
נעדכן מדיניות זו מעת לעת. שינויים מהותיים יפורסמו באתר ובהודעה אליך.

13. פרטי התקשרות
--------------
ממונה הגנת הפרטיות (DPO):
שם: [שם הממונה]
טלפון: [מספר טלפון]
דוא"ל: privacy@[domain].co.il
כתובת: [כתובת מלאה]

הרשות להגנת הפרטיות:
טלפון: 1-800-22-18-22
אתר: www.gov.il/privacy

עדכון אחרון: [תאריך]`
        },
        'consent': {
            name: 'consent_form_tikun13.docx',
            content: `טופס הסכמה מדעת - תואם תיקון 13 לחוק הגנת הפרטיות
=============================================

פרטי נושא המידע
--------------
שם מלא: _________________________
ת.ז.: _________________________
כתובת: _________________________
טלפון: _________________________
דוא"ל: _________________________

הצהרת הסכמה מדעת
---------------
אני, החתום מטה, מצהיר בזאת כי:

1. יידוע על איסוף המידע (סעיף 11 לחוק)
------------------------------------
הוסבר לי כי:
□ איסוף המידע הוא לצורך: [פרט את המטרות]
□ מסירת המידע היא: □ חובה חוקית □ רצונית
□ אי מסירת המידע עלולה לגרום ל: [פרט השלכות]
□ המידע יימסר ל: [פרט למי יועבר המידע]
□ יש לי זכות עיון במידע (סעיף 13 לחוק)
□ יש לי זכות לבקש תיקון המידע (סעיף 14 לחוק)

2. סוגי המידע שייאסף
------------------
□ מידע מזהה: שם, ת.ז., כתובת, טלפון, דוא"ל
□ מידע פיננסי: חשבון בנק, כרטיס אשראי
□ מידע בריאותי (רגיש): [פרט]
□ מידע ביומטרי (רגיש): [פרט]
□ אחר: _________________________

3. מטרות השימוש במידע
-------------------
אני מסכים/ה שהמידע ישמש ל:
□ אספקת השירות/המוצר המבוקש
□ תקשורת שוטפת בנוגע לשירות
□ שיווק ישיר (ניתן לביטול בכל עת)
□ שיפור השירות וניתוחים סטטיסטיים
□ אחר: _________________________

4. העברת מידע לצדדים שלישיים
-------------------------
□ אני מסכים/ה להעברת המידע ל:
   □ ספקי שירות הפועלים מטעם החברה
   □ שותפים עסקיים לצורך: _________
   □ חברות בקבוצה
□ איני מסכים/ה להעברת המידע

5. תקופת שמירת המידע
------------------
הוסבר לי כי המידע יישמר למשך: _________
ולאחר מכן: □ יימחק □ יהפוך לאנונימי

6. זכויותיי
---------
הוסבר לי כי זכותי:
□ לעיין במידע אודותיי
□ לבקש תיקון מידע שגוי
□ לבקש מחיקת מידע
□ להתנגד לשימושים מסוימים
□ לבטל הסכמה זו בכל עת
□ לקבל את המידע בפורמט נייד

7. ביטול הסכמה
------------
ידוע לי כי:
• אני רשאי/ת לבטל הסכמה זו בכל עת
• הביטול יחול מכאן ולהבא בלבד
• ביטול ההסכמה עלול למנוע המשך קבלת שירות
• לביטול יש לפנות ל: privacy@[domain].co.il

8. הסכמה לקבלת דיוור שיווקי
-----------------------
□ אני מסכים/ה לקבל דיוור שיווקי ב:
   □ דוא"ל □ SMS □ טלפון □ דואר
□ איני מסכים/ה לקבל דיוור שיווקי

9. חתימה ואישור
-------------
□ קראתי והבנתי את כל האמור לעיל
□ ההסכמה ניתנת מרצוני החופשי
□ קיבלתי העתק מטופס זה

תאריך: ___________
חתימה: ___________
חותמת (לתאגיד): ___________

אישור עד לחתימה (במקרה הצורך):
שם העד: ___________
ת.ז.: ___________
חתימה: ___________

---
לשימוש משרדי בלבד:
תאריך קבלה: ___________
מספר אסמכתא: ___________
מאושר ע"י: ___________`
        },
        'dpo': {
            name: 'dpo_appointment_tikun13.docx',
            content: `כתב מינוי ממונה על הגנת הפרטיות (DPO) - תיקון 13
==========================================

תאריך: ___________

לכבוד
[שם הממונה]
[כתובת]

הנדון: מינוי לתפקיד ממונה על הגנת הפרטיות

1. המינוי
-------
בהתאם לסעיף 17ב1 לחוק הגנת הפרטיות, התשמ"א-1981, כפי שתוקן בתיקון 13,
הנך ממונה בזאת לתפקיד ממונה על הגנת הפרטיות (Data Protection Officer - DPO)
ב-[שם הארגון] החל מיום ___________.

2. תחומי אחריות
-------------
בתפקידך כממונה על הגנת הפרטיות, תהיה אחראי/ת על:

א. ייעוץ מקצועי:
• שמש סמכות מקצועית ומוקד ידע בתחום הגנת הפרטיות
• ייעץ להנהלת הארגון בכל הנוגע לחוק הגנת הפרטיות ותקנותיו

ב. הדרכה והטמעה:
• הכנת תכנית הדרכה שנתית בתחום הגנת הפרטיות
• פיקוח על ביצוע ההדרכות לכלל העובדים
• הטמעת נהלים ותהליכים תואמי רגולציה

ג. בקרה ופיקוח:
• הכנת תכנית בקרה שוטפת על עמידה בהוראות החוק
• ביצוע ביקורות תקופתיות
• דיווח להנהלה על ממצאים והמלצות לתיקון

ד. ניהול מסמכים:
• וידוא קיום נוהל אבטחת מידע (תקנה 4)
• וידוא קיום מסמך הגדרות מאגר (תקנה 2)
• אישור המסמכים מול ההנהלה

ה. טיפול בפניות:
• טיפול בבקשות נושאי מידע לעיון, תיקון ומחיקה
• מענה לפניות בנושא זכויות פרטיות
• תיעוד ומעקב אחר הטיפול

ו. קשר עם הרשות:
• שמש איש קשר מול הרשות להגנת הפרטיות
• דיווח על אירועי אבטחה חמורים
• ליווי ביקורות וחקירות

3. סמכויות
--------
• גישה מלאה לכל המידע והמערכות הרלוונטיות
• סמכות לדרוש מידע ומסמכים מכל עובד
• סמכות להמליץ על הפסקת פעילות המפרה את החוק
• השתתפות בישיבות הנהלה רלוונטיות

4. כפיפות ודיווח
-------------
• תדווח ישירות ל: [מנכ"ל / סמנכ"ל]
• תגיש דו"ח רבעוני להנהלה
• תקבל הנחיה מקצועית מהרשות להגנת הפרטיות

5. משאבים ותנאים
--------------
הארגון מתחייב להעמיד לרשותך:
• משרד ועמדת עבודה
• גישה למערכות המידע
• תקציב להדרכות והכשרות
• תמיכה מנהלית
• [פרט משאבים נוספים]

6. תקופת המינוי
-------------
• המינוי הינו לתקופה של ___ שנים
• הארכה/סיום המינוי יעשו בהתייעצות עם הרשות

7. ניגוד עניינים
-------------
הנך מצהיר כי:
• אינך ממלא תפקיד העלול להעמידך בניגוד עניינים
• תימנע מטיפול בנושאים בהם יש לך עניין אישי
• תדווח מיידית על כל חשש לניגוד עניינים

8. סודיות
-------
הנך מתחייב לשמור על סודיות המידע שיגיע אליך במסגרת תפקידך.

9. הכשרה
-------
הארגון יאפשר לך להשתתף בהכשרות מקצועיות בתחום.

בכבוד רב,

___________          ___________
[שם המנכ"ל]         [חתימה וחותמת]

אישור קבלת המינוי:

אני מאשר קבלת המינוי ומתחייב למלא את התפקיד בהתאם לחוק.

___________          ___________
[שם הממונה]         [חתימה]`
        },
        'breach': {
            name: 'breach_notification_tikun13.docx', 
            content: `הודעה על אירוע אבטחת מידע - תיקון 13
====================================

לכבוד
הרשות להגנת הפרטיות
משרד המשפטים

תאריך: ___________

הנדון: הודעה על אירוע אבטחת מידע חמור
(בהתאם לתקנה 11(ד) לתקנות אבטחת מידע)

1. פרטי הארגון
-----------
שם הארגון: ___________
מספר רישום המאגר: ___________
שם בעל השליטה: ___________
שם הממונה על אבטחת המידע: ___________
טלפון: ___________ דוא"ל: ___________

2. פרטי האירוע
-----------
תאריך גילוי האירוע: ___________
תאריך התרחשות משוער: ___________
סוג האירוע:
□ פריצה למערכת
□ גניבת מידע
□ אובדן מידע
□ חשיפה בלתי מורשית
□ השחתת מידע
□ אחר: ___________

3. היקף האירוע
------------
מספר נושאי מידע שנפגעו: ___________
סוגי המידע שנחשף:
□ מידע מזהה (שם, ת.ז.)
□ פרטי קשר
□ מידע פיננסי
□ מידע רפואי
□ מידע ביומטרי
□ אחר: ___________

4. תיאור האירוע
------------
[תאר בפירוט את האירוע, הנסיבות, אופן הגילוי]
___________________________________________
___________________________________________
___________________________________________

5. הערכת סיכונים
-------------
רמת החומרה: □ נמוכה □ בינונית □ גבוהה □ קריטית

סיכונים פוטנציאליים:
□ גניבת זהות
□ נזק כלכלי
□ פגיעה בפרטיות
□ נזק מוניטין
□ אחר: ___________

6. פעולות שננקטו
-------------
□ חסימת הגישה למערכת
□ איפוס סיסמאות
□ יידוע נושאי המידע
□ הגשת תלונה במשטרה
□ שכירת יועץ אבטחה חיצוני
□ אחר: ___________

7. פעולות מתוכננות
---------------
[פרט צעדים למניעת הישנות]
___________________________________________
___________________________________________

8. יידוע נושאי המידע
-----------------
□ נושאי המידע יודעו בתאריך: ___________
□ טרם יודעו - סיבה: ___________
□ אופן היידוע: □ דוא"ל □ SMS □ מכתב □ אתר

9. פרטי איש קשר לבירורים
--------------------
שם: ___________
תפקיד: ___________
טלפון: ___________
דוא"ל: ___________

10. מסמכים מצורפים
---------------
□ דו"ח טכני מפורט
□ רשימת נושאי מידע
□ תכתובות רלוונטיות
□ אחר: ___________

הצהרה
-----
אני מצהיר כי כל הפרטים שמסרתי לעיל נכונים ומדויקים.

___________          ___________
שם החותם            חתימה וחותמת

תפקיד: ___________

---
הערות:
1. יש להגיש הודעה זו בהקדם האפשרי
2. יש לעדכן על כל התפתחות מהותית
3. יש לשמור תיעוד מלא של האירוע והטיפול בו`
        }
    };
    
    const template = templates[type];
    if (template) {
        const blob = new Blob([template.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = template.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('התבנית הורדה בהצלחה!');
    }
}

function copyCode(elementId) {
    const codeElement = document.getElementById(elementId);
    if (codeElement) {
        const code = codeElement.textContent;
        navigator.clipboard.writeText(code).then(() => {
            showNotification('הקוד הועתק ללוח!');
        });
    }
}

// Cookie Banner Functions - Link to Cookie Builder
function downloadAdvancedBanner() {
    // Redirect to cookie builder instead of download
    const cookieBuilderSection = document.getElementById('cookie-builder-section');
    const scannerSection = document.getElementById('scanner-section');
    const assessmentSection = document.getElementById('assessment');
    const highlightBanner = document.getElementById('cookie-builder-highlight');
    
    if (cookieBuilderSection) {
        // Hide other sections
        if (scannerSection) scannerSection.style.display = 'none';
        if (assessmentSection) assessmentSection.style.display = 'none';
        
        // Show cookie builder
        cookieBuilderSection.style.display = 'block';
        
        // Show highlight banner when coming from resources
        if (highlightBanner) {
            highlightBanner.style.display = 'block';
            highlightBanner.classList.add('animate-in');
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (highlightBanner && highlightBanner.style.display !== 'none') {
                    highlightBanner.style.display = 'none';
                }
            }, 10000);
        }
        
        // Scroll to cookie builder
        cookieBuilderSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Initialize cookie builder if needed
        if (window.CookieBuilder && typeof window.CookieBuilder.init === 'function') {
            window.CookieBuilder.init();
        }
        
        showNotification('עברת לכלי יצירת באנר העוגיות - צור את הבאנר המותאם אישית שלך!');
    }
}

function previewBanner() {
    // Show cookie builder in preview mode
    downloadAdvancedBanner();
    
    // Trigger preview after navigation
    setTimeout(() => {
        if (window.CookieBuilder && typeof window.CookieBuilder.showPreview === 'function') {
            window.CookieBuilder.showPreview('consent');
        }
    }, 500);
}

function downloadRightsAPI() {
    // Show coming soon modal for Rights Management API
    showComingSoonModal('מערכת ניהול זכויות', 
        'מערכת ה-API לניהול זכויות נושאי מידע נמצאת בפיתוח.\n' +
        'המערכת תכלול:\n' +
        '• ממשק API מלא לניהול בקשות עיון, תיקון ומחיקה\n' +
        '• תבניות קוד ב-Node.js, Python ו-PHP\n' +
        '• מערכת תיעוד ומעקב אחר בקשות\n' +
        '• כלים לעמידה בזמני התגובה הנדרשים בחוק\n\n' +
        'בינתיים, השתמש בתבניות המסמכים הזמינות לניהול ידני של בקשות.'
    );
}

function showComingSoonModal(title, description) {
    // Create coming soon modal
    const modalHTML = `
        <div id="coming-soon-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 600px;">
                <span class="close" onclick="closeComingSoonModal()">&times;</span>
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🚧</div>
                    <h2 style="color: #667eea; margin-bottom: 15px;">${title} - בקרוב!</h2>
                    <p style="color: #666; line-height: 1.6; white-space: pre-line;">${description}</p>
                    <div style="margin-top: 30px;">
                        <button class="btn btn-primary" onclick="closeComingSoonModal()" style="
                            background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
                            color: white;
                            border: none;
                            padding: 12px 30px;
                            border-radius: 50px;
                            font-size: 16px;
                            cursor: pointer;
                        ">הבנתי</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    
    // Add close event
    const modal = document.getElementById('coming-soon-modal');
    modal.onclick = function(event) {
        if (event.target === modal) {
            closeComingSoonModal();
        }
    };
}

function closeComingSoonModal() {
    const modal = document.getElementById('coming-soon-modal');
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }
}

function calculatePenalty() {
    // Get form elements with correct IDs
    const violationTypeElement = document.getElementById('violation-type');
    const dataSubjectsElement = document.getElementById('data-subjects');
    const sensitiveDataElement = document.getElementById('sensitive-data');
    const resultDiv = document.getElementById('penalty-result');
    
    // Check if elements exist
    if (!violationTypeElement || !resultDiv) {
        console.error('Required form elements not found');
        if (resultDiv) {
            resultDiv.innerHTML = '<p style="color: red;">שגיאה: אלמנטי הטופס לא נמצאו</p>';
        }
        return;
    }
    
    // Get values
    const violationType = violationTypeElement.value;
    const dataSubjects = parseInt(dataSubjectsElement?.value) || 0;
    const hasSensitiveData = sensitiveDataElement ? sensitiveDataElement.checked : false;
    
    // Base penalties according to Amendment 13
    let basePenalty = 150000; // Default penalty for most violations
    
    // Calculate total penalty
    let total = basePenalty;
    
    // Additional penalty for sensitive data
    if (hasSensitiveData) {
        total = 150000; // Sensitive data violations also have 150,000 penalty
    }
    
    // Maximum penalty for large number of data subjects
    if (dataSubjects >= 1000000) {
        total = 1000000; // Maximum penalty for over 1 million subjects
    }
    
    // Display result
    resultDiv.innerHTML = `
        <div class="calculation-result" style="padding: 15px; background: #f8f9fa; border-radius: 8px; margin-top: 15px;">
            <h4 style="margin: 0 0 10px 0; color: #333;">סכום העיצום המשוער</h4>
            <div class="penalty-amount" style="font-size: 28px; color: #d32f2f; font-weight: bold; margin: 10px 0;">
                ₪${total.toLocaleString('he-IL')}
            </div>
            <div style="font-size: 14px; color: #666; margin-top: 10px;">
                <p style="margin: 5px 0;"><strong>פירוט החישוב:</strong></p>
                <p style="margin: 5px 0;">• סוג ההפרה: ${getViolationName(violationType)}</p>
                <p style="margin: 5px 0;">• עיצום בסיסי: ₪${basePenalty.toLocaleString('he-IL')}</p>
                ${hasSensitiveData ? '<p style="margin: 5px 0;">• מידע רגיש: כן</p>' : ''}
                ${dataSubjects > 0 ? `<p style="margin: 5px 0;">• נושאי מידע: ${dataSubjects.toLocaleString('he-IL')}</p>` : ''}
                ${dataSubjects >= 1000000 ? '<p style="margin: 5px 0; color: #d32f2f;">• עיצום מירבי (מעל מיליון נושאים)</p>' : ''}
            </div>
            <p style="font-size: 12px; color: #999; margin-top: 15px; padding-top: 10px; border-top: 1px solid #ddd;">
                * חישוב זה הינו הערכה בלבד. העיצום בפועל נקבע על ידי רשות הגנת הפרטיות.
            </p>
        </div>
    `;
}

function getViolationName(type) {
    const names = {
        'registration': 'אי-רישום מאגר',
        'notification': 'אי-הודעה לרשות',
        'false-info': 'מסירת פרטים שגויים'
    };
    return names[type] || type;
}

function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification-toast';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10001;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add animation styles if not already present
if (!document.querySelector('#notificationStyles')) {
    const style = document.createElement('style');
    style.id = 'notificationStyles';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}