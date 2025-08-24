/**
 * Cookie Consent Builder - Interactive Configuration Tool
 * תיקון 13 - כלי בניית באנר הסכמה לעוגיות
 */

// Create namespace for Cookie Builder
window.CookieBuilder = (function() {
    'use strict';
    
    // Global configuration object
    let currentConfig = {
        siteName: 'האתר שלי',
        cookieName: 'tikun13_cc',
        cookieExpiry: 365,
        revision: 1,
        modalLayout: 'box',
        modalPosition: 'bottom center',
        theme: 'default',
        categories: {
            necessary: true,
            functionality: true,
            analytics: true,
            marketing: true
        },
        texts: {
            title: 'אנחנו משתמשים בעוגיות 🍪',
            description: 'האתר הזה משתמש בעוגיות כדי לשפר את חוויית המשתמש שלך. בהתאם לתיקון 13 לחוק הגנת הפרטיות, אנו מבקשים את הסכמתך המפורשת לשימוש בעוגיות.',
            privacyLink: '/privacy.html',
            termsLink: '/terms.html'
        },
        features: {
            timestamp: true,
            version: true,
            withdrawal: true,
            granular: true,
            export: true,
            hebrew: true
        }
    };

    // Hebrew translations template
    const hebrewTranslations = {
        consentModal: {
            title: "אנחנו משתמשים בעוגיות 🍪",
            description: "האתר הזה משתמש בעוגיות כדי לשפר את חוויית המשתמש שלך. בהתאם לתיקון 13 לחוק הגנת הפרטיות, אנו מבקשים את הסכמתך המפורשת לשימוש בעוגיות.",
            acceptAllBtn: "אשר הכל",
            acceptNecessaryBtn: "דחה הכל",
            showPreferencesBtn: "נהל העדפות",
            closeIconLabel: "סגור",
            footer: '<a href="{{privacyLink}}">מדיניות פרטיות</a> | <a href="{{termsLink}}">תנאי שימוש</a>'
        },
        preferencesModal: {
            title: "העדפות עוגיות",
            acceptAllBtn: "אשר הכל",
            acceptNecessaryBtn: "דחה הכל",
            savePreferencesBtn: "שמור העדפות",
            closeIconLabel: "סגור",
            serviceCounterLabel: "שירותים",
            sections: [
                {
                    title: "עוגיות חיוניות",
                    description: "עוגיות אלו הכרחיות לתפקוד התקין של האתר ולא ניתן לבטל אותן.",
                    linkedCategory: "necessary"
                },
                {
                    title: "עוגיות תפקודיות",
                    description: "עוגיות אלו מאפשרות לאתר לזכור את הבחירות שלך ולספק תכונות משופרות.",
                    linkedCategory: "functionality"
                },
                {
                    title: "עוגיות אנליטיקס",
                    description: "עוגיות אלו עוזרות לנו להבין איך משתמשים באתר שלנו.",
                    linkedCategory: "analytics"
                },
                {
                    title: "עוגיות שיווק",
                    description: "עוגיות אלו משמשות להצגת פרסומות רלוונטיות עבורך.",
                    linkedCategory: "marketing"
                }
            ]
        }
    };

    // Initialize function
    function init() {
        setupEventListeners();
        updatePreview();
        generateCode();
    }

    // Setup all event listeners
    function setupEventListeners() {
        // Basic settings
        const siteNameInput = document.getElementById('cb-site-name');
        const cookieNameInput = document.getElementById('cb-cookie-name');
        const cookieExpiryInput = document.getElementById('cb-cookie-expiry');
        const revisionInput = document.getElementById('cb-revision');
        
        if (siteNameInput) siteNameInput.addEventListener('input', updateConfig);
        if (cookieNameInput) cookieNameInput.addEventListener('input', updateConfig);
        if (cookieExpiryInput) cookieExpiryInput.addEventListener('input', updateConfig);
        if (revisionInput) revisionInput.addEventListener('input', updateConfig);
        
        // UI settings
        const modalLayoutSelect = document.getElementById('cb-modal-layout');
        const modalPositionSelect = document.getElementById('cb-modal-position');
        const themeSelect = document.getElementById('cb-theme');
        
        if (modalLayoutSelect) modalLayoutSelect.addEventListener('change', updateConfig);
        if (modalPositionSelect) modalPositionSelect.addEventListener('change', updateConfig);
        if (themeSelect) themeSelect.addEventListener('change', updateConfig);
        
        // Categories
        document.querySelectorAll('[id^="cb-cat-"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateConfig);
        });
        
        // Text content
        const modalTitleInput = document.getElementById('cb-modal-title');
        const modalDescInput = document.getElementById('cb-modal-description');
        const privacyLinkInput = document.getElementById('cb-privacy-link');
        const termsLinkInput = document.getElementById('cb-terms-link');
        
        if (modalTitleInput) modalTitleInput.addEventListener('input', updateConfig);
        if (modalDescInput) modalDescInput.addEventListener('input', updateConfig);
        if (privacyLinkInput) privacyLinkInput.addEventListener('input', updateConfig);
        if (termsLinkInput) termsLinkInput.addEventListener('input', updateConfig);
        
        // Features
        document.querySelectorAll('[id^="cb-feat-"]').forEach(checkbox => {
            checkbox.addEventListener('change', updateConfig);
        });
    }

    function updateConfig() {
        // Update basic settings
        const siteNameInput = document.getElementById('cb-site-name');
        const cookieNameInput = document.getElementById('cb-cookie-name');
        const cookieExpiryInput = document.getElementById('cb-cookie-expiry');
        const revisionInput = document.getElementById('cb-revision');
        
        if (siteNameInput) currentConfig.siteName = siteNameInput.value;
        if (cookieNameInput) currentConfig.cookieName = cookieNameInput.value;
        if (cookieExpiryInput) currentConfig.cookieExpiry = parseInt(cookieExpiryInput.value) || 365;
        if (revisionInput) currentConfig.revision = parseInt(revisionInput.value) || 1;
        
        // Update UI settings
        const modalLayoutSelect = document.getElementById('cb-modal-layout');
        const modalPositionSelect = document.getElementById('cb-modal-position');
        const themeSelect = document.getElementById('cb-theme');
        
        if (modalLayoutSelect) currentConfig.modalLayout = modalLayoutSelect.value;
        if (modalPositionSelect) currentConfig.modalPosition = modalPositionSelect.value;
        if (themeSelect) currentConfig.theme = themeSelect.value;
        
        // Update categories
        currentConfig.categories.functionality = document.getElementById('cb-cat-functionality')?.checked || false;
        currentConfig.categories.analytics = document.getElementById('cb-cat-analytics')?.checked || false;
        currentConfig.categories.marketing = document.getElementById('cb-cat-marketing')?.checked || false;
        
        // Update texts
        const modalTitleInput = document.getElementById('cb-modal-title');
        const modalDescInput = document.getElementById('cb-modal-description');
        const privacyLinkInput = document.getElementById('cb-privacy-link');
        const termsLinkInput = document.getElementById('cb-terms-link');
        
        if (modalTitleInput) currentConfig.texts.title = modalTitleInput.value;
        if (modalDescInput) currentConfig.texts.description = modalDescInput.value;
        if (privacyLinkInput) currentConfig.texts.privacyLink = privacyLinkInput.value;
        if (termsLinkInput) currentConfig.texts.termsLink = termsLinkInput.value;
        
        // Update features
        currentConfig.features.timestamp = document.getElementById('cb-feat-timestamp')?.checked || false;
        currentConfig.features.version = document.getElementById('cb-feat-version')?.checked || false;
        currentConfig.features.withdrawal = document.getElementById('cb-feat-withdrawal')?.checked || false;
        currentConfig.features.granular = document.getElementById('cb-feat-granular')?.checked || false;
        currentConfig.features.export = document.getElementById('cb-feat-export')?.checked || false;
        currentConfig.features.hebrew = document.getElementById('cb-feat-hebrew')?.checked || false;
        
        // Update preview and code
        updatePreview();
        generateCode();
    }

    function updatePreview() {
        const previewFrame = document.getElementById('cb-preview-frame');
        if (!previewFrame) return;
        
        // Create preview HTML
        const previewHTML = `
            <div class="cookie-consent-preview" style="
                position: relative;
                min-height: 400px;
                background: #f5f5f5;
                border-radius: 8px;
                padding: 20px;
                display: flex;
                align-items: ${currentConfig.modalPosition.includes('bottom') ? 'flex-end' : currentConfig.modalPosition.includes('top') ? 'flex-start' : 'center'};
                justify-content: ${currentConfig.modalPosition.includes('left') ? 'flex-start' : currentConfig.modalPosition.includes('right') ? 'flex-end' : 'center'};
            ">
                <div class="consent-modal-preview" style="
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    max-width: ${currentConfig.modalLayout === 'box wide' ? '800px' : currentConfig.modalLayout === 'bar' ? '100%' : '500px'};
                    width: 100%;
                    direction: rtl;
                ">
                    <h3 style="color: #333; margin-bottom: 12px;">${currentConfig.texts.title}</h3>
                    <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">${currentConfig.texts.description}</p>
                    
                    ${currentConfig.features.granular ? `
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
                            ${Object.entries(currentConfig.categories).map(([key, enabled]) => 
                                enabled ? `
                                    <label style="display: block; margin: 8px 0;">
                                        <input type="checkbox" ${key === 'necessary' ? 'checked disabled' : 'checked'} style="margin-left: 8px;">
                                        ${getCategoryName(key)}
                                    </label>
                                ` : ''
                            ).join('')}
                        </div>
                    ` : ''}
                    
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button style="background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            אשר הכל
                        </button>
                        <button style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            נהל העדפות
                        </button>
                        <button style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            דחה הכל
                        </button>
                    </div>
                    
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999;">
                        <a href="${currentConfig.texts.privacyLink}" style="color: #667eea; text-decoration: none;">מדיניות פרטיות</a> | 
                        <a href="${currentConfig.texts.termsLink}" style="color: #667eea; text-decoration: none;">תנאי שימוש</a>
                    </div>
                </div>
            </div>
        `;
        
        previewFrame.innerHTML = previewHTML;
    }

    function getCategoryName(key) {
        const names = {
            necessary: 'עוגיות חיוניות',
            functionality: 'עוגיות תפקודיות',
            analytics: 'עוגיות אנליטיקס',
            marketing: 'עוגיות שיווק'
        };
        return names[key] || key;
    }

    function generateCode() {
        generateHTMLCode();
        generateJavaScriptCode();
        generateConfigCode();
    }

    function generateHTMLCode() {
        const htmlCode = `<!-- Cookie Consent - Amendment 13 Compliant -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.0.1/dist/cookieconsent.css">
<script type="module">
    import 'https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.0.1/dist/cookieconsent.esm.js';
    
    // Initialize with your configuration
    window.CookieConsent.run(${JSON.stringify(currentConfig, null, 2)});
</script>`;
        
        const codeElement = document.getElementById('cb-html-code');
        if (codeElement) {
            codeElement.textContent = htmlCode;
        }
    }

    function generateJavaScriptCode() {
        const jsCode = `// Cookie Consent Configuration
const cookieConfig = ${JSON.stringify(currentConfig, null, 2)};

// Initialize Cookie Consent
document.addEventListener('DOMContentLoaded', function() {
    if (window.CookieConsent) {
        window.CookieConsent.run(cookieConfig);
    }
});

// Helper functions for checking consent
function hasAnalyticsConsent() {
    const consent = window.CookieConsent.getCookie();
    return consent && consent.categories && consent.categories.includes('analytics');
}

function hasMarketingConsent() {
    const consent = window.CookieConsent.getCookie();
    return consent && consent.categories && consent.categories.includes('marketing');
}`;
        
        const codeElement = document.getElementById('cb-js-code');
        if (codeElement) {
            codeElement.textContent = jsCode;
        }
    }

    function generateConfigCode() {
        const configCode = JSON.stringify(currentConfig, null, 2);
        
        const codeElement = document.getElementById('cb-config-code');
        if (codeElement) {
            codeElement.textContent = configCode;
        }
    }

    function showPreview(type) {
        // Different preview types
        if (type === 'consent') {
            updatePreview();
        } else if (type === 'preferences') {
            showPreferencesPreview();
        }
    }

    function showPreferencesPreview() {
        const previewFrame = document.getElementById('cb-preview-frame');
        if (!previewFrame) return;
        
        const previewHTML = `
            <div class="preferences-preview" style="
                position: relative;
                min-height: 400px;
                background: #f5f5f5;
                border-radius: 8px;
                padding: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div class="preferences-modal-preview" style="
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    max-width: 600px;
                    width: 100%;
                    direction: rtl;
                ">
                    <h3 style="color: #333; margin-bottom: 20px;">העדפות עוגיות</h3>
                    
                    ${Object.entries(currentConfig.categories).map(([key, enabled]) => 
                        enabled ? `
                            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <h4 style="color: #444; margin: 0 0 8px 0;">${getCategoryName(key)}</h4>
                                        <p style="color: #666; margin: 0; font-size: 14px;">
                                            ${getCategoryDescription(key)}
                                        </p>
                                    </div>
                                    <input type="checkbox" ${key === 'necessary' ? 'checked disabled' : 'checked'} style="width: 24px; height: 24px;">
                                </div>
                            </div>
                        ` : ''
                    ).join('')}
                    
                    <div style="display: flex; gap: 10px; margin-top: 24px;">
                        <button style="background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            שמור העדפות
                        </button>
                        <button style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            אשר הכל
                        </button>
                        <button style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            דחה הכל
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        previewFrame.innerHTML = previewHTML;
    }

    function getCategoryDescription(key) {
        const descriptions = {
            necessary: 'עוגיות אלו הכרחיות לתפקוד התקין של האתר',
            functionality: 'עוגיות אלו מאפשרות תכונות משופרות וחוויית משתמש טובה יותר',
            analytics: 'עוגיות אלו עוזרות לנו להבין כיצד משתמשים באתר',
            marketing: 'עוגיות אלו משמשות להצגת פרסומות רלוונטיות'
        };
        return descriptions[key] || '';
    }

    function testConsent() {
        // Create a test modal overlay
        const existingTestModal = document.getElementById('cookie-test-modal');
        if (existingTestModal) {
            existingTestModal.remove();
        }
        
        // Create test modal with working cookie consent
        const testModal = document.createElement('div');
        testModal.id = 'cookie-test-modal';
        testModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            max-width: 600px;
            width: 100%;
            position: relative;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            direction: rtl;
            text-align: right;
        `;
        
        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #333; font-size: 1.4rem;">${currentConfig.texts.title}</h3>
                <button onclick="this.closest('#cookie-test-modal').remove()" style="
                    background: transparent;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #999;
                    padding: 5px;
                    line-height: 1;
                ">&times;</button>
            </div>
            
            <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">${currentConfig.texts.description}</p>
            
            ${currentConfig.features.granular ? `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #333;">בחר את סוגי העוגיות שברצונך לאשר:</h4>
                    ${Object.entries(currentConfig.categories).map(([key, enabled]) => 
                        enabled ? `
                            <label style="display: block; margin: 8px 0; cursor: pointer;">
                                <input type="checkbox" id="test-${key}" ${key === 'necessary' ? 'checked disabled' : 'checked'} style="margin-left: 8px;">
                                <span>${getCategoryName(key)}</span>
                                ${key === 'necessary' ? '<small style="color: #999; display: block; margin-right: 28px;">(נדרש לתפקוד האתר)</small>' : ''}
                            </label>
                        ` : ''
                    ).join('')}
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
                <button onclick="CookieBuilder.handleTestConsent('accept-all')" style="
                    background: #4caf50;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: 600;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#45a049'" onmouseout="this.style.background='#4caf50'">
                    אשר הכל
                </button>
                
                ${currentConfig.features.granular ? `
                    <button onclick="CookieBuilder.handleTestConsent('save-preferences')" style="
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 1rem;
                        font-weight: 600;
                        transition: background 0.3s;
                    " onmouseover="this.style.background='#5a6fd8'" onmouseout="this.style.background='#667eea'">
                        שמור העדפות
                    </button>
                ` : ''}
                
                <button onclick="CookieBuilder.handleTestConsent('reject-all')" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: 600;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#da190b'" onmouseout="this.style.background='#f44336'">
                    דחה הכל
                </button>
            </div>
            
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 0.9rem; color: #666; text-align: center;">
                <a href="${currentConfig.texts.privacyLink}" style="color: #667eea; text-decoration: none; margin: 0 10px;">מדיניות פרטיות</a>
                |
                <a href="${currentConfig.texts.termsLink}" style="color: #667eea; text-decoration: none; margin: 0 10px;">תנאי שימוש</a>
            </div>
            
            <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 6px; font-size: 0.85rem; color: #1565c0;">
                <strong>מצב בדיקה:</strong> זהו דמו לבאנר ההסכמה. בסביבת הייצור, הבחירות ישמרו בעוגיות ויופעלו התוספים המתאימים.
            </div>
        `;
        
        testModal.appendChild(modalContent);
        document.body.appendChild(testModal);
        
        // Add click outside to close
        testModal.addEventListener('click', function(e) {
            if (e.target === testModal) {
                testModal.remove();
            }
        });
    }

    function handleTestConsent(action) {
        const modal = document.getElementById('cookie-test-modal');
        let consentData = {
            timestamp: new Date().toISOString(),
            action: action,
            categories: [],
            config: currentConfig.siteName
        };
        
        if (action === 'accept-all') {
            consentData.categories = Object.keys(currentConfig.categories).filter(key => currentConfig.categories[key]);
            alert('✅ הסכמה מלאה נרשמה!\n\nקטגוריות שאושרו:\n' + 
                  consentData.categories.map(cat => '• ' + getCategoryName(cat)).join('\n') +
                  '\n\nבסביבת הייצור, הנתונים ישמרו בעוגיה עם תוקף של ' + currentConfig.cookieExpiry + ' ימים.');
        } else if (action === 'save-preferences') {
            // Get selected preferences
            Object.keys(currentConfig.categories).forEach(key => {
                if (currentConfig.categories[key]) {
                    const checkbox = modal.querySelector(`#test-${key}`);
                    if (checkbox && (checkbox.checked || key === 'necessary')) {
                        consentData.categories.push(key);
                    }
                }
            });
            alert('✅ העדפות נשמרו!\n\nקטגוריות שאושרו:\n' + 
                  consentData.categories.map(cat => '• ' + getCategoryName(cat)).join('\n') +
                  '\n\nבסביבת הייצור, הנתונים ישמרו בעוגיה עם תוקף של ' + currentConfig.cookieExpiry + ' ימים.');
        } else if (action === 'reject-all') {
            consentData.categories = ['necessary']; // Only necessary cookies
            alert('❌ הסכמה נדחתה!\n\nרק עוגיות חיוניות יופעלו:\n• עוגיות חיוניות\n\nניתן לשנות את ההחלטה בכל עת דרך הגדרות האתר.');
        }
        
        console.log('Test Consent Data:', consentData);
        modal.remove();
    }

    function showExportTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.cookie-builder-export-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active from all buttons
        document.querySelectorAll('.cb-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        const selectedTab = document.getElementById(`cb-export-${tabName}`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // Mark button as active
        event.target.classList.add('active');
    }

    function copyCode(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const text = element.textContent;
        navigator.clipboard.writeText(text).then(() => {
            alert('הקוד הועתק ללוח!');
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    function downloadConfig() {
        const config = JSON.stringify(currentConfig, null, 2);
        const blob = new Blob([config], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cookie-consent-config.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function downloadComplete() {
        // Create a zip file with all necessary files
        alert('ההורדה תתחיל בקרוב. החבילה כוללת את כל הקבצים הנדרשים להטמעה.');
        // In production, this would create and download a zip file
    }

    function downloadDocumentation() {
        const documentation = `
# Cookie Consent Banner - Amendment 13 Compliant
## Installation Instructions

1. Add the HTML code to your website's <head> section
2. Configure the settings according to your needs
3. Test the implementation
4. Monitor consent logs

## Configuration
${JSON.stringify(currentConfig, null, 2)}

## Support
For questions: info@ionsec.io
        `;
        
        const blob = new Blob([documentation], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cookie-consent-documentation.md';
        a.click();
        URL.revokeObjectURL(url);
    }

    // Public API
    return {
        init: init,
        updateConfig: updateConfig,
        showPreview: showPreview,
        testConsent: testConsent,
        handleTestConsent: handleTestConsent,
        showExportTab: showExportTab,
        copyCode: copyCode,
        downloadConfig: downloadConfig,
        downloadComplete: downloadComplete,
        downloadDocumentation: downloadDocumentation
    };
})();

// Initialize when DOM is ready if on cookie builder section
document.addEventListener('DOMContentLoaded', function() {
    const cookieBuilderSection = document.getElementById('cookie-builder-section');
    if (cookieBuilderSection && cookieBuilderSection.style.display !== 'none') {
        CookieBuilder.init();
    }
});