/**
 * Tikun 13 Compliant Cookie Consent Configuration
 * תצורת הסכמה לעוגיות תואמת תיקון 13
 * 
 * This configuration ensures full compliance with Israeli Amendment 13
 * to the Privacy Protection Law, including:
 * - Explicit consent requirements
 * - Granular cookie categories
 * - Consent withdrawal mechanism
 * - Hebrew language support with RTL
 * - Consent versioning and timestamps
 */

// Load Hebrew translations
import heTranslations from '../translations/he.json' assert { type: 'json' };

// Initialize Cookie Consent with Amendment 13 compliance
window.initCookieConsent = function() {
    // Enable RTL for Hebrew
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'he';
    
    // Run CookieConsent with Tikun 13 compliant configuration
    return CookieConsent.run({
        // Root element for better accessibility
        root: 'body',
        
        // Auto-detect language but default to Hebrew
        autoDetectLanguage: false,
        
        // Current version of consent (for tracking changes)
        revision: 1,
        
        // Cookie configuration
        cookie: {
            name: 'tikun13_cc',
            domain: location.hostname,
            path: '/',
            sameSite: 'Lax',
            expiresAfterDays: 365, // Keep consent for 1 year as per Amendment 13
        },
        
        // GUI Options - optimized for Hebrew RTL
        guiOptions: {
            consentModal: {
                layout: 'box',
                position: 'bottom center',
                equalWeightButtons: false,
                flipButtons: false
            },
            preferencesModal: {
                layout: 'box',
                position: 'right',
                equalWeightButtons: false,
                flipButtons: false
            }
        },
        
        // Categories aligned with Amendment 13 requirements
        categories: {
            necessary: {
                enabled: true,
                readOnly: true,
                services: {
                    essential: {
                        label: 'שירותים חיוניים',
                        description: 'עוגיות הכרחיות לתפקוד האתר'
                    }
                }
            },
            functionality: {
                enabled: false,
                readOnly: false,
                autoClear: {
                    cookies: [
                        {
                            name: /^language_preference/
                        },
                        {
                            name: /^theme_preference/
                        }
                    ]
                },
                services: {
                    preferences: {
                        label: 'העדפות משתמש',
                        description: 'שמירת העדפות כמו שפה ותצוגה'
                    }
                }
            },
            analytics: {
                enabled: false,
                readOnly: false,
                autoClear: {
                    cookies: [
                        {
                            name: /^local_analytics/
                        },
                        {
                            name: /^scan_count/
                        },
                        {
                            name: '_ga',
                            domain: '.'+location.hostname
                        },
                        {
                            name: /^_ga_/,
                            domain: '.'+location.hostname
                        }
                    ],
                    reloadPage: false
                },
                services: {
                    localAnalytics: {
                        label: 'אנליטיקס מקומי',
                        description: 'ניתוח שימוש באתר ללא שיתוף מידע עם צדדים שלישיים'
                    }
                }
            },
            marketing: {
                enabled: false,
                readOnly: false,
                autoClear: {
                    cookies: [
                        {
                            name: /^_fbp$/
                        },
                        {
                            name: /^_gcl_/
                        }
                    ],
                    reloadPage: false
                },
                services: {
                    advertising: {
                        label: 'פרסום',
                        description: 'עוגיות למעקב ופרסום ממוקד (לא בשימוש כרגע)'
                    }
                }
            }
        },
        
        // Language configuration
        language: {
            default: 'he',
            autoDetect: 'browser',
            rtl: 'he',
            translations: {
                he: heTranslations
            }
        },
        
        // Compliance callbacks for Amendment 13
        onFirstConsent: function({cookie}) {
            console.log('תיקון 13: הסכמה ראשונה נרשמה', cookie);
            // Log first consent with timestamp
            const consentLog = {
                timestamp: new Date().toISOString(),
                version: cookie.revision,
                categories: cookie.categories,
                userAgent: navigator.userAgent,
                language: navigator.language
            };
            localStorage.setItem('tikun13_first_consent', JSON.stringify(consentLog));
        },
        
        onConsent: function({cookie}) {
            console.log('תיקון 13: הסכמה עודכנה', cookie);
            // Track consent updates
            const consentHistory = JSON.parse(localStorage.getItem('tikun13_consent_history') || '[]');
            consentHistory.push({
                timestamp: new Date().toISOString(),
                version: cookie.revision,
                categories: cookie.categories
            });
            localStorage.setItem('tikun13_consent_history', JSON.stringify(consentHistory));
        },
        
        onChange: function({cookie, changedCategories, changedServices}) {
            console.log('תיקון 13: העדפות שונו', changedCategories);
            // Handle preference changes
            if (changedCategories.includes('analytics')) {
                if (CookieConsent.acceptedCategory('analytics')) {
                    // Enable analytics
                    window.analyticsEnabled = true;
                } else {
                    // Disable analytics
                    window.analyticsEnabled = false;
                    // Clear any existing analytics data
                    localStorage.removeItem('local_analytics_data');
                }
            }
        },
        
        // Page scripts management - Amendment 13 compliance
        executeScript: function(scriptId, category) {
            // Only execute scripts after consent
            if (CookieConsent.acceptedCategory(category)) {
                const script = document.getElementById(scriptId);
                if (script) {
                    script.type = 'text/javascript';
                    const newScript = document.createElement('script');
                    newScript.innerHTML = script.innerHTML;
                    document.head.appendChild(newScript);
                }
            }
        }
    });
};

// Consent management API for Amendment 13 compliance
window.Tikun13Consent = {
    // Get current consent status
    getConsentStatus: function() {
        return CookieConsent.getCookie();
    },
    
    // Withdraw consent (required by Amendment 13)
    withdrawConsent: function() {
        if (confirm('האם אתה בטוח שברצונך לבטל את הסכמתך לעוגיות?')) {
            CookieConsent.reset();
            location.reload();
        }
    },
    
    // Update consent preferences
    updatePreferences: function() {
        CookieConsent.showPreferences();
    },
    
    // Check if specific category is accepted
    categoryAccepted: function(category) {
        return CookieConsent.acceptedCategory(category);
    },
    
    // Get consent timestamp
    getConsentTimestamp: function() {
        const cookie = CookieConsent.getCookie();
        return cookie ? cookie.lastUpdated : null;
    },
    
    // Get consent version
    getConsentVersion: function() {
        const cookie = CookieConsent.getCookie();
        return cookie ? cookie.revision : null;
    },
    
    // Export consent data (data portability)
    exportConsentData: function() {
        const data = {
            consent: CookieConsent.getCookie(),
            history: JSON.parse(localStorage.getItem('tikun13_consent_history') || '[]'),
            firstConsent: JSON.parse(localStorage.getItem('tikun13_first_consent') || '{}')
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tikun13_consent_data.json';
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initCookieConsent);
} else {
    window.initCookieConsent();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initCookieConsent: window.initCookieConsent, Tikun13Consent: window.Tikun13Consent };
}