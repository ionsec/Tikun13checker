// Hebrew Accessibility Widget for Tikun13 Checker
// תוסף נגישות בעברית

class AccessibilityWidget {
    constructor() {
        this.isOpen = false;
        this.settings = this.loadSettings();
        this.originalStyles = new Map();
        this.init();
    }

    init() {
        this.createWidget();
        this.bindEvents();
        this.applySettings();
        this.addSkipLinks();
        this.enhanceKeyboardNavigation();
    }

    loadSettings() {
        const saved = localStorage.getItem('tikun13_accessibility');
        return saved ? JSON.parse(saved) : {
            fontSize: 100,
            contrast: 'normal',
            animations: true,
            underlineLinks: false,
            readableFont: false,
            focusHighlight: false,
            readingMode: false,
            darkMode: false,
            lineHeight: 'normal',
            letterSpacing: 'normal'
        };
    }

    saveSettings() {
        localStorage.setItem('tikun13_accessibility', JSON.stringify(this.settings));
    }

    createWidget() {
        // Create main widget container
        const widget = document.createElement('div');
        widget.className = 'accessibility-widget';
        widget.innerHTML = `
            <button class="accessibility-toggle" aria-label="פתח תפריט נגישות" title="נגישות (Alt+A)">
                <span aria-hidden="true">♿</span>
                <span class="sr-only">נגישות</span>
            </button>
            
            <div class="accessibility-panel" role="dialog" aria-label="הגדרות נגישות" hidden>
                <div class="accessibility-header">
                    <h2>הגדרות נגישות</h2>
                    <button class="accessibility-close" aria-label="סגור תפריט נגישות">✕</button>
                </div>
                
                <div class="accessibility-content">
                    <!-- Text Size -->
                    <div class="accessibility-section">
                        <h3>גודל טקסט</h3>
                        <div class="accessibility-controls">
                            <button data-action="decreaseFont" aria-label="הקטן טקסט">
                                <span>A-</span>
                            </button>
                            <span class="font-size-display">${this.settings.fontSize}%</span>
                            <button data-action="increaseFont" aria-label="הגדל טקסט">
                                <span>A+</span>
                            </button>
                        </div>
                    </div>

                    <!-- Contrast -->
                    <div class="accessibility-section">
                        <h3>ניגודיות</h3>
                        <div class="accessibility-buttons">
                            <button data-action="normalContrast" class="${this.settings.contrast === 'normal' ? 'active' : ''}">
                                רגיל
                            </button>
                            <button data-action="highContrast" class="${this.settings.contrast === 'high' ? 'active' : ''}">
                                גבוה
                            </button>
                            <button data-action="invertedContrast" class="${this.settings.contrast === 'inverted' ? 'active' : ''}">
                                הפוך
                            </button>
                        </div>
                    </div>

                    <!-- Visual Options -->
                    <div class="accessibility-section">
                        <h3>אפשרויות תצוגה</h3>
                        <div class="accessibility-toggles">
                            <label class="accessibility-toggle-item">
                                <input type="checkbox" data-setting="darkMode" ${this.settings.darkMode ? 'checked' : ''}>
                                <span>מצב לילה</span>
                            </label>
                            <label class="accessibility-toggle-item">
                                <input type="checkbox" data-setting="underlineLinks" ${this.settings.underlineLinks ? 'checked' : ''}>
                                <span>הדגש קישורים</span>
                            </label>
                            <label class="accessibility-toggle-item">
                                <input type="checkbox" data-setting="readableFont" ${this.settings.readableFont ? 'checked' : ''}>
                                <span>גופן קריא</span>
                            </label>
                            <label class="accessibility-toggle-item">
                                <input type="checkbox" data-setting="focusHighlight" ${this.settings.focusHighlight ? 'checked' : ''}>
                                <span>הדגש פוקוס</span>
                            </label>
                        </div>
                    </div>

                    <!-- Spacing -->
                    <div class="accessibility-section">
                        <h3>ריווח</h3>
                        <div class="accessibility-buttons">
                            <button data-action="lineHeight" data-value="${this.settings.lineHeight}" class="spacing-btn">
                                רווח שורות: ${this.getLineHeightLabel()}
                            </button>
                            <button data-action="letterSpacing" data-value="${this.settings.letterSpacing}" class="spacing-btn">
                                רווח אותיות: ${this.getLetterSpacingLabel()}
                            </button>
                        </div>
                    </div>

                    <!-- Navigation -->
                    <div class="accessibility-section">
                        <h3>ניווט</h3>
                        <div class="accessibility-toggles">
                            <label class="accessibility-toggle-item">
                                <input type="checkbox" data-setting="animations" ${!this.settings.animations ? 'checked' : ''}>
                                <span>עצור אנימציות</span>
                            </label>
                            <label class="accessibility-toggle-item">
                                <input type="checkbox" data-setting="readingMode" ${this.settings.readingMode ? 'checked' : ''}>
                                <span>מצב קריאה</span>
                            </label>
                        </div>
                    </div>

                    <!-- Quick Navigation -->
                    <div class="accessibility-section">
                        <h3>ניווט מהיר</h3>
                        <div class="accessibility-buttons">
                            <button data-action="skipToContent">דלג לתוכן</button>
                            <button data-action="skipToFooter">דלג לתחתית</button>
                            <button data-action="showHeadings">הצג כותרות</button>
                        </div>
                    </div>

                    <!-- Reset -->
                    <div class="accessibility-section">
                        <button data-action="reset" class="accessibility-reset">
                            🔄 אפס הגדרות
                        </button>
                    </div>
                </div>

                <div class="accessibility-footer">
                    <a href="#" onclick="showAccessibilityStatement(); return false;">הצהרת נגישות</a>
                    <span>תקן ישראלי 5568</span>
                </div>
            </div>
        `;

        document.body.appendChild(widget);
        this.widget = widget;
        this.panel = widget.querySelector('.accessibility-panel');
        this.toggleBtn = widget.querySelector('.accessibility-toggle');
    }

    bindEvents() {
        // Toggle panel
        this.toggleBtn.addEventListener('click', () => this.togglePanel());
        
        // Close button
        this.widget.querySelector('.accessibility-close').addEventListener('click', () => this.closePanel());
        
        // Action buttons
        this.widget.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleAction(e.target.dataset.action, e.target));
        });

        // Setting checkboxes
        this.widget.querySelectorAll('[data-setting]').forEach(input => {
            input.addEventListener('change', (e) => {
                this.settings[e.target.dataset.setting] = e.target.checked;
                this.applySettings();
                this.saveSettings();
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Alt + A to toggle panel
            if (e.altKey && e.key === 'a') {
                e.preventDefault();
                this.togglePanel();
            }
            // Escape to close panel
            if (e.key === 'Escape' && this.isOpen) {
                this.closePanel();
            }
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.widget.contains(e.target)) {
                this.closePanel();
            }
        });
    }

    handleAction(action, button) {
        switch(action) {
            case 'increaseFont':
                this.adjustFontSize(10);
                break;
            case 'decreaseFont':
                this.adjustFontSize(-10);
                break;
            case 'normalContrast':
                this.setContrast('normal');
                break;
            case 'highContrast':
                this.setContrast('high');
                break;
            case 'invertedContrast':
                this.setContrast('inverted');
                break;
            case 'lineHeight':
                this.cycleLineHeight();
                break;
            case 'letterSpacing':
                this.cycleLetterSpacing();
                break;
            case 'skipToContent':
                this.skipToContent();
                break;
            case 'skipToFooter':
                this.skipToFooter();
                break;
            case 'showHeadings':
                this.showHeadingsStructure();
                break;
            case 'reset':
                this.resetSettings();
                break;
        }
    }

    adjustFontSize(change) {
        this.settings.fontSize = Math.max(80, Math.min(200, this.settings.fontSize + change));
        this.widget.querySelector('.font-size-display').textContent = `${this.settings.fontSize}%`;
        this.applySettings();
        this.saveSettings();
    }

    setContrast(mode) {
        this.settings.contrast = mode;
        this.widget.querySelectorAll('[data-action^="normalContrast"], [data-action^="highContrast"], [data-action^="invertedContrast"]').forEach(btn => {
            btn.classList.remove('active');
        });
        this.widget.querySelector(`[data-action="${mode}Contrast"]`).classList.add('active');
        this.applySettings();
        this.saveSettings();
    }

    cycleLineHeight() {
        const values = ['normal', 'large', 'extra-large'];
        const currentIndex = values.indexOf(this.settings.lineHeight);
        this.settings.lineHeight = values[(currentIndex + 1) % values.length];
        this.widget.querySelector('[data-action="lineHeight"]').textContent = `רווח שורות: ${this.getLineHeightLabel()}`;
        this.applySettings();
        this.saveSettings();
    }

    cycleLetterSpacing() {
        const values = ['normal', 'large', 'extra-large'];
        const currentIndex = values.indexOf(this.settings.letterSpacing);
        this.settings.letterSpacing = values[(currentIndex + 1) % values.length];
        this.widget.querySelector('[data-action="letterSpacing"]').textContent = `רווח אותיות: ${this.getLetterSpacingLabel()}`;
        this.applySettings();
        this.saveSettings();
    }

    getLineHeightLabel() {
        const labels = { 'normal': 'רגיל', 'large': 'גדול', 'extra-large': 'גדול מאוד' };
        return labels[this.settings.lineHeight] || 'רגיל';
    }

    getLetterSpacingLabel() {
        const labels = { 'normal': 'רגיל', 'large': 'גדול', 'extra-large': 'גדול מאוד' };
        return labels[this.settings.letterSpacing] || 'רגיל';
    }

    applySettings() {
        const html = document.documentElement;
        
        // Remove all accessibility classes
        html.className = html.className.replace(/\baccessibility-\S+/g, '');

        // Font size
        html.style.fontSize = `${this.settings.fontSize}%`;

        // Contrast modes
        if (this.settings.contrast !== 'normal') {
            html.classList.add(`accessibility-${this.settings.contrast}-contrast`);
        }

        // Dark mode
        if (this.settings.darkMode) {
            html.classList.add('accessibility-dark-mode');
        }

        // Underline links
        if (this.settings.underlineLinks) {
            html.classList.add('accessibility-underline-links');
        }

        // Readable font
        if (this.settings.readableFont) {
            html.classList.add('accessibility-readable-font');
        }

        // Focus highlight
        if (this.settings.focusHighlight) {
            html.classList.add('accessibility-focus-highlight');
        }

        // Animations
        if (!this.settings.animations) {
            html.classList.add('accessibility-no-animations');
        }

        // Reading mode
        if (this.settings.readingMode) {
            html.classList.add('accessibility-reading-mode');
        }

        // Line height
        if (this.settings.lineHeight !== 'normal') {
            html.classList.add(`accessibility-line-height-${this.settings.lineHeight}`);
        }

        // Letter spacing
        if (this.settings.letterSpacing !== 'normal') {
            html.classList.add(`accessibility-letter-spacing-${this.settings.letterSpacing}`);
        }
    }

    resetSettings() {
        this.settings = {
            fontSize: 100,
            contrast: 'normal',
            animations: true,
            underlineLinks: false,
            readableFont: false,
            focusHighlight: false,
            readingMode: false,
            darkMode: false,
            lineHeight: 'normal',
            letterSpacing: 'normal'
        };
        
        // Reset UI
        this.widget.querySelector('.font-size-display').textContent = '100%';
        this.widget.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.checked = this.settings[input.dataset.setting] || false;
        });
        this.widget.querySelectorAll('[data-action$="Contrast"]').forEach(btn => {
            btn.classList.remove('active');
        });
        this.widget.querySelector('[data-action="normalContrast"]').classList.add('active');
        
        this.applySettings();
        this.saveSettings();
        
        // Show confirmation
        this.showNotification('ההגדרות אופסו בהצלחה');
    }

    togglePanel() {
        this.isOpen = !this.isOpen;
        this.panel.hidden = !this.isOpen;
        this.toggleBtn.setAttribute('aria-expanded', this.isOpen);
        
        if (this.isOpen) {
            this.panel.querySelector('.accessibility-close').focus();
            this.widget.classList.add('open');
        } else {
            this.widget.classList.remove('open');
            this.toggleBtn.focus();
        }
    }

    closePanel() {
        this.isOpen = false;
        this.panel.hidden = true;
        this.toggleBtn.setAttribute('aria-expanded', 'false');
        this.widget.classList.remove('open');
        this.toggleBtn.focus();
    }

    addSkipLinks() {
        const skipLinks = document.createElement('div');
        skipLinks.className = 'skip-links';
        skipLinks.innerHTML = `
            <a href="#main-content" class="skip-link">דלג לתוכן הראשי</a>
            <a href="#checker-form" class="skip-link">דלג לטופס בדיקה</a>
            <a href="#results" class="skip-link">דלג לתוצאות</a>
            <a href="#footer" class="skip-link">דלג לתחתית העמוד</a>
        `;
        document.body.insertBefore(skipLinks, document.body.firstChild);

        // Add main content ID if missing
        const mainContent = document.querySelector('main');
        if (mainContent && !mainContent.id) {
            mainContent.id = 'main-content';
        }

        // Add footer ID if missing
        const footer = document.querySelector('footer');
        if (footer && !footer.id) {
            footer.id = 'footer';
        }
    }

    enhanceKeyboardNavigation() {
        // Add visible focus indicators
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
        });

        // Enhance form labels
        document.querySelectorAll('input, select, textarea').forEach(input => {
            if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
                const label = input.closest('label') || document.querySelector(`label[for="${input.id}"]`);
                if (label) {
                    input.setAttribute('aria-label', label.textContent.trim());
                }
            }
        });
    }

    skipToContent() {
        const main = document.querySelector('#main-content, main, [role="main"]');
        if (main) {
            main.scrollIntoView({ behavior: 'smooth', block: 'start' });
            main.setAttribute('tabindex', '-1');
            main.focus();
        }
        this.closePanel();
    }

    skipToFooter() {
        const footer = document.querySelector('#footer, footer');
        if (footer) {
            footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            footer.setAttribute('tabindex', '-1');
            footer.focus();
        }
        this.closePanel();
    }

    showHeadingsStructure() {
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const structure = Array.from(headings).map(h => ({
            level: h.tagName,
            text: h.textContent.trim(),
            element: h
        }));

        const modal = document.createElement('div');
        modal.className = 'accessibility-headings-modal';
        modal.innerHTML = `
            <div class="accessibility-headings-content">
                <h2>מבנה הכותרות בעמוד</h2>
                <button class="close-headings">✕</button>
                <ul class="headings-list">
                    ${structure.map(h => `
                        <li class="heading-${h.level.toLowerCase()}">
                            <button data-heading-index="${structure.indexOf(h)}">
                                ${h.level}: ${h.text}
                            </button>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;

        document.body.appendChild(modal);

        // Bind events
        modal.querySelector('.close-headings').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelectorAll('[data-heading-index]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.headingIndex);
                structure[index].element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                structure[index].element.setAttribute('tabindex', '-1');
                structure[index].element.focus();
                modal.remove();
                this.closePanel();
            });
        });
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'accessibility-notification';
        notification.setAttribute('role', 'status');
        notification.setAttribute('aria-live', 'polite');
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.accessibilityWidget = new AccessibilityWidget();
    });
} else {
    window.accessibilityWidget = new AccessibilityWidget();
}

// Accessibility Statement Function
window.showAccessibilityStatement = function() {
    const modal = document.createElement('div');
    modal.className = 'accessibility-statement-modal';
    modal.innerHTML = `
        <div class="accessibility-statement-content">
            <button class="close-statement">✕</button>
            <h2>הצהרת נגישות</h2>
            <div class="statement-body">
                <div class="disclaimer-box" style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
                    <h4>⚠️ הבהרה חשובה</h4>
                    <p><strong>אתר זה משתמש בכלי קוד פתוח שפותח על ידי IONSEC.IO</strong></p>
                    <p>הכלי סופק בחינם לקהילה ויכול להיות מותקן על כל אתר. <strong>IONSEC.IO אינה אחראית ואינה מחויבת לנושאי נגישות באתר זה.</strong></p>
                    <p><strong>האחריות המלאה על נגישות האתר היא של בעל האתר בלבד.</strong></p>
                </div>

                <p>אנו מחויבים להנגשת האתר לאנשים עם מוגבלויות בהתאם לתקן הישראלי 5568 ולהנחיות WCAG 2.1 ברמה AA.</p>
                
                <h3>מאמצי הנגישות</h3>
                <ul>
                    <li>האתר עבר התאמות נגישות מקיפות</li>
                    <li>תוסף נגישות מובנה עם אפשרויות התאמה מגוונות</li>
                    <li>תמיכה מלאה בקוראי מסך</li>
                    <li>ניווט מקלדת מלא</li>
                    <li>תוכן ברור ופשוט בעברית</li>
                </ul>
                
                <h3>דרכי יצירת קשר לנושאי נגישות</h3>
                <p>נתקלתם בבעיית נגישות? צרו קשר עם בעל האתר:</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; border: 2px dashed #dee2e6;">
                    <p style="color: #6c757d; font-style: italic; margin-bottom: 10px;">
                        <strong>לבעל האתר:</strong> יש להחליף את הפרטים הבאים בפרטי הקשר שלך:
                    </p>
                    <ul>
                        <li>📧 דוא"ל: <a href="mailto:[הכנס כתובת דוא"ל שלך]">[הכנס כתובת דוא"ל שלך]</a></li>
                        <li>📞 טלפון: [הכנס מספר טלפון שלך]</li>
                        <li>📍 כתובת: [הכנס כתובת פיזית אם רלוונטי]</li>
                        <li>👤 איש קשר לנגישות: [הכנס שם איש הקשר]</li>
                    </ul>
                </div>
                
                <h3>אודות הכלי</h3>
                <p>תוסף הנגישות באתר זה הוא חלק מפרויקט קוד פתוח של <a href="https://github.com/ionsec" target="_blank">IONSEC.IO</a> 
                   שנועד לסייע לאתרים ישראלים בהטמעת נגישות. הכלי מסופק "כמות שהוא" ללא אחריות.</p>
                
                <h3>עדכון אחרון</h3>
                <p>הצהרת נגישות זו עודכנה לאחרונה בתאריך: ${new Date().toLocaleDateString('he-IL')}</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.close-statement').addEventListener('click', () => {
        modal.remove();
    });
    
    // Close on escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
};