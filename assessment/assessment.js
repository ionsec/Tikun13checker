// Main Assessment Engine for Amendment 13 Compliance
// Manages questionnaire flow, state, and UI interactions

class AssessmentEngine {
    constructor() {
        this.questions = window.assessmentQuestions;
        this.calculator = new window.ComplianceCalculator();
        this.currentSectionIndex = 0;
        this.answers = {};
        this.isCompleted = false;
        this.startTime = null;
        
        // Load saved state from localStorage
        this.loadState();
        
        // Initialize UI
        this.initializeUI();
    }

    initializeUI() {
        // Create assessment container if it doesn't exist
        const container = document.getElementById('assessment-container');
        if (!container) {
            console.error('Assessment container not found');
            return;
        }
        
        // Set initial content
        if (this.isCompleted) {
            this.showResults();
        } else if (Object.keys(this.answers).length > 0) {
            this.showResumeDialog();
        } else {
            this.showWelcome();
        }
    }

    showWelcome() {
        const container = document.getElementById('assessment-container');
        container.innerHTML = `
            <div class="assessment-welcome">
                <div class="welcome-card">
                    <h2>ברוכים הבאים להערכה העצמית לתיקון 13</h2>
                    <p>כלי זה יעזור לכם להעריך את מידת המוכנות של הארגון שלכם לעמידה בדרישות תיקון 13 לחוק הגנת הפרטיות.</p>
                    
                    <div class="assessment-benefits">
                        <h3>מה תקבלו בסיום ההערכה:</h3>
                        <ul>
                            <li>📊 ציון עמידה כולל (0-100)</li>
                            <li>⚠️ זיהוי הפרות פוטנציאליות וקנסות</li>
                            <li>📋 המלצות מעשיות לשיפור</li>
                            <li>📄 דוח מפורט להורדה</li>
                            <li>🎯 תוכנית פעולה מותאמת אישית</li>
                        </ul>
                    </div>
                    
                    <div class="assessment-info">
                        <div class="info-item">
                            <span class="info-icon">⏱️</span>
                            <span>זמן משוער: 10-15 דקות</span>
                        </div>
                        <div class="info-item">
                            <span class="info-icon">💾</span>
                            <span>התשובות נשמרות אוטומטית</span>
                        </div>
                        <div class="info-item">
                            <span class="info-icon">🔒</span>
                            <span>המידע נשאר אצלכם בלבד</span>
                        </div>
                    </div>
                    
                    <div class="assessment-actions">
                        <button class="btn-primary" onclick="assessmentEngine.startAssessment()">
                            התחל הערכה
                        </button>
                        <button class="btn-secondary" onclick="assessmentEngine.loadSampleData()">
                            טען נתונים לדוגמה
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    showResumeDialog() {
        const completedCount = Object.keys(this.answers).length;
        const totalQuestions = this.questions.getTotalQuestions();
        const percentage = Math.round((completedCount / totalQuestions) * 100);
        
        const container = document.getElementById('assessment-container');
        container.innerHTML = `
            <div class="assessment-resume">
                <div class="resume-card">
                    <h2>נמצאה הערכה בתהליך</h2>
                    <p>השלמת ${completedCount} מתוך ${totalQuestions} שאלות (${percentage}%)</p>
                    
                    <div class="progress-bar-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                        <div class="progress-percentage">${percentage}%</div>
                    </div>
                    
                    <div class="resume-actions">
                        <button class="btn-primary" onclick="assessmentEngine.resumeAssessment()">
                            המשך מהמקום שעצרת
                        </button>
                        <button class="btn-secondary" onclick="assessmentEngine.restartAssessment()">
                            התחל מחדש
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    startAssessment() {
        this.currentSectionIndex = 0;
        this.answers = {};
        this.isCompleted = false;
        this.startTime = new Date().toISOString();
        this.saveState();
        this.showSection(0);
    }

    resumeAssessment() {
        // Find the last answered section
        let lastSection = 0;
        this.questions.sections.forEach((section, index) => {
            const hasAnswers = section.questions.some(q => this.answers[q.id] !== undefined);
            if (hasAnswers) lastSection = index;
        });
        
        this.currentSectionIndex = lastSection;
        this.showSection(lastSection);
    }

    restartAssessment() {
        if (confirm('האם אתה בטוח שברצונך להתחיל מחדש? כל התשובות הקיימות יימחקו.')) {
            this.clearState();
            this.startAssessment();
        }
    }

    showSection(sectionIndex) {
        if (sectionIndex < 0 || sectionIndex >= this.questions.sections.length) {
            this.calculateAndShowResults();
            return;
        }
        
        const section = this.questions.sections[sectionIndex];
        const container = document.getElementById('assessment-container');
        
        // Build section HTML
        let html = `
            <div class="assessment-section">
                <div class="section-header">
                    <div class="progress-indicator">
                        <span>סעיף ${sectionIndex + 1} מתוך ${this.questions.sections.length}</span>
                        <div class="progress-bar-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${(sectionIndex / this.questions.sections.length) * 100}%"></div>
                            </div>
                            <div class="progress-percentage">${Math.round((sectionIndex / this.questions.sections.length) * 100)}%</div>
                        </div>
                    </div>
                    <h2>${section.icon} ${section.title}</h2>
                    <p class="section-description">${section.description}</p>
                </div>
                
                <div class="questions-container">
                    ${this.renderSectionQuestions(section)}
                </div>
                
                <div class="section-navigation">
                    <button class="btn-secondary" onclick="assessmentEngine.previousSection()" 
                            ${sectionIndex === 0 ? 'disabled' : ''}>
                        הקודם
                    </button>
                    <button class="btn-primary" onclick="assessmentEngine.nextSection()">
                        ${sectionIndex === this.questions.sections.length - 1 ? 'סיים והצג תוצאות' : 'הבא'}
                    </button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Restore answers for this section
        this.restoreAnswers(section);
    }

    renderSectionQuestions(section) {
        let html = '';
        
        section.questions.forEach((question, index) => {
            // Check if question should be displayed based on dependencies
            if (!this.shouldShowQuestion(question)) {
                return;
            }
            
            html += `
                <div class="question-block" data-question-id="${question.id}">
                    <div class="question-header">
                        <label class="question-label">
                            ${question.required ? '<span class="required">*</span>' : ''}
                            ${index + 1}. ${question.text}
                        </label>
                        ${question.helpText ? `
                            <button class="help-icon" onclick="assessmentEngine.toggleTooltip('${question.id}')" aria-label="עזרה">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
                                    <path d="M8 11c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zM8 3C6.3 3 5 4.3 5 6h2c0-.6.4-1 1-1s1 .4 1 1c0 .3-.1.5-.3.7l-.7.7c-.5.5-.7.9-.7 1.6v.5h2V9c0-.3.1-.5.3-.7l.7-.7c.5-.5.7-1.1.7-1.6 0-1.7-1.3-3-3-3z"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                    ${question.helpText ? `
                        <div class="tooltip-content" id="tooltip-${question.id}" style="display: none;">
                            <div class="tooltip-header">
                                <h4>${question.helpText.title}</h4>
                                <button class="tooltip-close" onclick="assessmentEngine.closeTooltip('${question.id}')">&times;</button>
                            </div>
                            <div class="tooltip-body">
                                ${question.helpText.description}
                                ${question.helpText.requirements ? `
                                    <div class="tooltip-requirements">
                                        <strong>דרישות:</strong>
                                        <ul>
                                            ${question.helpText.requirements.map(req => `<li>${req}</li>`).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                                ${question.helpText.reference ? `
                                    <div class="tooltip-reference">
                                        <small>מקור: ${question.helpText.reference}</small>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
            `;
            
            if (question.type === 'select') {
                html += this.renderSelectQuestion(question);
            } else if (question.type === 'multiselect') {
                html += this.renderMultiselectQuestion(question);
            }
            
            html += '</div>';
        });
        
        return html;
    }

    renderSelectQuestion(question) {
        let html = `<div class="select-wrapper">`;
        
        // Add select element
        html += `
            <select class="form-select" data-question-id="${question.id}" 
                    onchange="assessmentEngine.handleAnswer('${question.id}', this.value)">
                <option value="">בחר תשובה...</option>
        `;
        
        question.options.forEach(option => {
            const selected = this.answers[question.id] === option.value ? 'selected' : '';
            html += `<option value="${option.value}" ${selected}>${option.label}</option>`;
        });
        
        html += '</select>';
        
        // Add help tooltips for options that have helpText
        question.options.forEach(option => {
            if (option.helpText) {
                const optionId = `${question.id}-${option.value}`;
                html += `
                    <div class="select-option-help" data-option-value="${option.value}" style="display: none;">
                        <button class="option-help-icon" onclick="assessmentEngine.toggleTooltip('${optionId}')" aria-label="עזרה עבור ${option.label}">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
                                <path d="M8 11c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zM8 3C6.3 3 5 4.3 5 6h2c0-.6.4-1 1-1s1 .4 1 1c0 .3-.1.5-.3.7l-.7.7c-.5.5-.7.9-.7 1.6v.5h2V9c0-.3.1-.5.3-.7l.7-.7c.5-.5.7-1.1.7-1.6 0-1.7-1.3-3-3-3z"/>
                            </svg>
                        </button>
                        <div class="tooltip-content option-tooltip" id="tooltip-${optionId}" style="display: none;">
                            <div class="tooltip-header">
                                <h4>${option.helpText.title}</h4>
                                <button class="tooltip-close" onclick="assessmentEngine.closeTooltip('${optionId}')">&times;</button>
                            </div>
                            <div class="tooltip-body">
                                ${option.helpText.description || option.helpText.content || ''}
                                ${option.helpText.requirements ? `
                                    <div class="tooltip-requirements">
                                        <strong>דרישות:</strong>
                                        <ul>
                                            ${option.helpText.requirements.map(req => `<li>${req}</li>`).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                                ${option.helpText.reference ? `
                                    <div class="tooltip-reference">
                                        <small>מקור: ${option.helpText.reference}</small>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
        });
        
        // Add script to show help icon for selected option
        html += `
            <script>
                (function() {
                    const select = document.querySelector('select[data-question-id="${question.id}"]');
                    const updateHelpIcon = () => {
                        const helpIcons = select.parentElement.querySelectorAll('.select-option-help');
                        helpIcons.forEach(icon => {
                            icon.style.display = icon.dataset.optionValue === select.value ? 'inline-block' : 'none';
                        });
                    };
                    if (select) {
                        select.addEventListener('change', updateHelpIcon);
                        updateHelpIcon();
                    }
                })();
            </script>
        `;
        
        html += '</div>';
        return html;
    }

    renderMultiselectQuestion(question) {
        let html = '<div class="checkbox-group">';
        
        question.options.forEach((option, index) => {
            const checked = (this.answers[question.id] || []).includes(option.value) ? 'checked' : '';
            const optionId = `${question.id}-${option.value}`;
            
            html += `
                <div class="option-wrapper">
                    <label class="checkbox-label">
                        <input type="checkbox" value="${option.value}" ${checked}
                               data-question-id="${question.id}"
                               onchange="assessmentEngine.handleMultiselectAnswer('${question.id}', this)">
                        <span>${option.label}</span>
                    </label>
                    ${option.helpText ? `
                        <button class="option-help-icon" onclick="assessmentEngine.toggleTooltip('${optionId}')" aria-label="עזרה">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
                                <path d="M8 11c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zM8 3C6.3 3 5 4.3 5 6h2c0-.6.4-1 1-1s1 .4 1 1c0 .3-.1.5-.3.7l-.7.7c-.5.5-.7.9-.7 1.6v.5h2V9c0-.3.1-.5.3-.7l.7-.7c.5-.5.7-1.1.7-1.6 0-1.7-1.3-3-3-3z"/>
                            </svg>
                        </button>
                        <div class="tooltip-content option-tooltip" id="tooltip-${optionId}" style="display: none;">
                            <div class="tooltip-header">
                                <h4>${option.helpText.title}</h4>
                                <button class="tooltip-close" onclick="assessmentEngine.closeTooltip('${optionId}')">&times;</button>
                            </div>
                            <div class="tooltip-body">
                                ${option.helpText.description || option.helpText.content || ''}
                                ${option.helpText.requirements ? `
                                    <div class="tooltip-requirements">
                                        <strong>דרישות:</strong>
                                        <ul>
                                            ${option.helpText.requirements.map(req => `<li>${req}</li>`).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                                ${option.helpText.reference ? `
                                    <div class="tooltip-reference">
                                        <small>מקור: ${option.helpText.reference}</small>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    shouldShowQuestion(question) {
        if (!question.dependsOn) return true;
        
        const dependencyAnswer = this.answers[question.dependsOn];
        if (!dependencyAnswer) return false;
        
        return question.showIf && question.showIf.includes(dependencyAnswer);
    }

    handleAnswer(questionId, value) {
        this.answers[questionId] = value;
        this.saveState();
        
        // Check if we need to update dependent questions
        this.updateDependentQuestions(questionId);
    }

    handleMultiselectAnswer(questionId, checkbox) {
        let current = this.answers[questionId] || [];
        
        if (checkbox.checked) {
            // Handle "none" option
            if (checkbox.value === 'none') {
                current = ['none'];
                // Uncheck all other options
                document.querySelectorAll(`input[data-question-id="${questionId}"]:not([value="none"])`)
                    .forEach(cb => cb.checked = false);
            } else {
                // Remove "none" if other option is selected
                current = current.filter(v => v !== 'none');
                current.push(checkbox.value);
                // Uncheck "none" option
                const noneCheckbox = document.querySelector(`input[data-question-id="${questionId}"][value="none"]`);
                if (noneCheckbox) noneCheckbox.checked = false;
            }
        } else {
            current = current.filter(v => v !== checkbox.value);
        }
        
        this.answers[questionId] = current;
        this.saveState();
    }

    updateDependentQuestions(parentQuestionId) {
        const currentSection = this.questions.sections[this.currentSectionIndex];
        let needsRefresh = false;
        
        currentSection.questions.forEach(question => {
            if (question.dependsOn === parentQuestionId) {
                needsRefresh = true;
            }
        });
        
        if (needsRefresh) {
            this.showSection(this.currentSectionIndex);
        }
    }

    restoreAnswers(section) {
        section.questions.forEach(question => {
            const answer = this.answers[question.id];
            if (!answer) return;
            
            if (question.type === 'select') {
                const select = document.querySelector(`select[data-question-id="${question.id}"]`);
                if (select) select.value = answer;
            } else if (question.type === 'multiselect') {
                const checkboxes = document.querySelectorAll(`input[data-question-id="${question.id}"]`);
                checkboxes.forEach(cb => {
                    cb.checked = answer.includes(cb.value);
                });
            }
        });
    }

    validateSection() {
        const section = this.questions.sections[this.currentSectionIndex];
        let isValid = true;
        let firstError = null;
        
        section.questions.forEach(question => {
            if (!this.shouldShowQuestion(question)) return;
            
            if (question.required && !this.answers[question.id]) {
                isValid = false;
                if (!firstError) firstError = question.id;
                
                // Highlight error
                const questionBlock = document.querySelector(`[data-question-id="${question.id}"]`);
                if (questionBlock) {
                    questionBlock.classList.add('error');
                }
            }
        });
        
        if (!isValid && firstError) {
            alert('אנא מלא את כל השדות החובה המסומנים ב-*');
            document.querySelector(`[data-question-id="${firstError}"]`)?.scrollIntoView({ behavior: 'smooth' });
        }
        
        return isValid;
    }

    nextSection() {
        if (this.validateSection()) {
            this.currentSectionIndex++;
            
            if (this.currentSectionIndex >= this.questions.sections.length) {
                this.calculateAndShowResults();
            } else {
                this.showSection(this.currentSectionIndex);
            }
        }
    }

    previousSection() {
        if (this.currentSectionIndex > 0) {
            this.currentSectionIndex--;
            this.showSection(this.currentSectionIndex);
        }
    }

    calculateAndShowResults() {
        // Show loading
        const container = document.getElementById('assessment-container');
        container.innerHTML = `
            <div class="assessment-loading">
                <div class="spinner"></div>
                <h3>מחשב תוצאות...</h3>
                <p>מנתח ${Object.keys(this.answers).length} תשובות</p>
            </div>
        `;
        
        // Calculate results
        setTimeout(() => {
            const results = this.calculator.calculateCompliance(this.answers, this.questions);
            this.isCompleted = true;
            this.saveResults(results);
            this.displayResults(results);
        }, 1500);
    }

    displayResults(results) {
        const container = document.getElementById('assessment-container');
        const reportGenerator = new AssessmentReportGenerator();
        container.innerHTML = reportGenerator.generateResultsHTML(results, this.answers);
        
        // Scroll to top of results
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    loadSampleData() {
        // Load sample answers for demonstration
        this.answers = {
            org_type: 'public',
            data_subjects_count: '100k_500k',
            sensitive_data: ['medical', 'biometric'],
            annual_revenue: 'large',
            dpo_appointed: 'process',
            database_registered: 'partial',
            database_documentation: 'outdated',
            security_level: 'medium',
            security_measures: ['encryption', 'access_control', 'backup'],
            security_officer: 'yes',
            security_training: 'old',
            privacy_notice: 'partial',
            access_requests: 'partial',
            consent_management: 'no',
            lawful_processing: 'mostly',
            purpose_limitation: 'mostly',
            data_minimization: 'partial',
            third_party_agreements: 'partial'
        };
        
        this.saveState();
        this.calculateAndShowResults();
    }

    // State management
    saveState() {
        const state = {
            answers: this.answers,
            currentSectionIndex: this.currentSectionIndex,
            isCompleted: this.isCompleted,
            startTime: this.startTime,
            lastUpdated: new Date().toISOString()
        };
        
        localStorage.setItem('tikun13_assessment', JSON.stringify(state));
    }

    loadState() {
        const saved = localStorage.getItem('tikun13_assessment');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.answers = state.answers || {};
                this.currentSectionIndex = state.currentSectionIndex || 0;
                this.isCompleted = state.isCompleted || false;
                this.startTime = state.startTime;
            } catch (e) {
                console.error('Failed to load saved state:', e);
            }
        }
    }

    clearState() {
        localStorage.removeItem('tikun13_assessment');
        localStorage.removeItem('tikun13_assessment_results');
        this.answers = {};
        this.currentSectionIndex = 0;
        this.isCompleted = false;
        this.startTime = null;
    }

    saveResults(results) {
        const resultsData = {
            results,
            answers: this.answers,
            timestamp: new Date().toISOString(),
            completionTime: this.startTime ? 
                Math.round((new Date() - new Date(this.startTime)) / 1000 / 60) : null
        };
        
        localStorage.setItem('tikun13_assessment_results', JSON.stringify(resultsData));
    }

    showResults() {
        const saved = localStorage.getItem('tikun13_assessment_results');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.displayResults(data.results);
            } catch (e) {
                console.error('Failed to load saved results:', e);
                this.showWelcome();
            }
        } else {
            this.showWelcome();
        }
    }
    
    // Download HTML Report
    downloadHTML() {
        const reportGenerator = new AssessmentReportGenerator();
        const savedResults = localStorage.getItem('tikun13_assessment_results');
        
        if (!savedResults) {
            alert('אין תוצאות להורדה');
            return;
        }
        
        const data = JSON.parse(savedResults);
        reportGenerator.results = data.results;
        reportGenerator.answers = data.answers;
        
        const htmlContent = reportGenerator.generatePDFContent();
        
        // Create blob and download
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tikun13-assessment-${Date.now()}.html`;
        link.click();
        URL.revokeObjectURL(url);
        
        alert('הדוח הורד בהצלחה כקובץ HTML. ניתן לפתוח אותו בדפדפן או להדפיס כ-PDF.');
    }
    
    // Share Results
    shareResults() {
        const savedResults = localStorage.getItem('tikun13_assessment_results');
        if (!savedResults) return;
        
        const data = JSON.parse(savedResults);
        const shareText = `דוח עמידה בתיקון 13:\nציון: ${data.results.score}%\nרמת סיכון: ${data.results.riskLevel.label}\nהפרות: ${data.results.violations.length}\nקנסות פוטנציאליים: ₪${data.results.totalFines.toLocaleString()}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'דוח עמידה בתיקון 13',
                text: shareText
            }).catch(err => console.log('Error sharing:', err));
        } else {
            // Fallback - copy to clipboard
            navigator.clipboard.writeText(shareText)
                .then(() => alert('התוצאות הועתקו ללוח'))
                .catch(err => console.error('Failed to copy:', err));
        }
    }
    
    // Download Action Plan
    downloadActionPlan() {
        const reportGenerator = new AssessmentReportGenerator();
        const savedResults = localStorage.getItem('tikun13_assessment_results');
        
        if (!savedResults) {
            alert('אין תוצאות ליצירת תוכנית פעולה');
            return;
        }
        
        const data = JSON.parse(savedResults);
        reportGenerator.results = data.results;
        reportGenerator.answers = data.answers;
        
        const actionPlan = reportGenerator.generateActionPlan();
        
        // Download as text file
        const blob = new Blob([actionPlan], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tikun13-action-plan-${Date.now()}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    }
    
    // OCSF Export Methods
    
    // Export as OCSF JSON (Compliance Findings)
    downloadOCSF() {
        const savedResults = localStorage.getItem('tikun13_assessment_results');
        
        if (!savedResults) {
            alert('אין תוצאות לייצוא OCSF');
            return;
        }
        
        const data = JSON.parse(savedResults);
        const exporter = new OCSFExporter();
        const ocsfData = exporter.exportComplianceFindings(data.results, data.answers);
        
        // Download as JSON
        const blob = new Blob([JSON.stringify(ocsfData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tikun13-ocsf-compliance-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        alert('דוח OCSF Compliance Findings יוצא בהצלחה');
    }
    
    // Export as OCSF NDJSON for SIEM ingestion
    downloadOCSFNDJSON() {
        const savedResults = localStorage.getItem('tikun13_assessment_results');
        
        if (!savedResults) {
            alert('אין תוצאות לייצוא OCSF');
            return;
        }
        
        const data = JSON.parse(savedResults);
        const exporter = new OCSFExporter();
        const ocsfData = exporter.exportComplianceFindings(data.results, data.answers);
        
        // Convert to NDJSON (newline-delimited JSON)
        const ndjson = ocsfData.findings.map(finding => JSON.stringify(finding)).join('\n');
        
        // Download as NDJSON
        const blob = new Blob([ndjson], { type: 'application/x-ndjson' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tikun13-ocsf-siem-${Date.now()}.ndjson`;
        link.click();
        URL.revokeObjectURL(url);
        
        alert('דוח OCSF NDJSON ל-SIEM יוצא בהצלחה');
    }
    
    // Export complete OCSF report with all finding types
    downloadOCSFComplete() {
        const savedResults = localStorage.getItem('tikun13_assessment_results');
        
        if (!savedResults) {
            alert('אין תוצאות לייצוא OCSF');
            return;
        }
        
        const data = JSON.parse(savedResults);
        const exporter = new OCSFExporter();
        const completeReport = exporter.exportCombinedReport(data.results, data.answers);
        
        // Download as JSON
        const blob = new Blob([JSON.stringify(completeReport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tikun13-ocsf-complete-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        alert('דוח OCSF מלא יוצא בהצלחה - כולל Compliance ו-Data Security Findings');
    }
    
    // Tooltip management
    toggleTooltip(questionId) {
        const tooltip = document.getElementById(`tooltip-${questionId}`);
        if (!tooltip) return;
        
        // Close all other tooltips first
        document.querySelectorAll('.tooltip-content').forEach(t => {
            if (t.id !== `tooltip-${questionId}`) {
                t.style.display = 'none';
            }
        });
        
        // Toggle current tooltip
        if (tooltip.style.display === 'none' || !tooltip.style.display) {
            tooltip.style.display = 'block';
            // Position tooltip near the help icon
            const helpIcon = tooltip.previousElementSibling.querySelector('.help-icon');
            if (helpIcon) {
                const rect = helpIcon.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                
                // Position to the right of the icon, or below if not enough space
                if (rect.right + tooltipRect.width + 20 < window.innerWidth) {
                    tooltip.style.position = 'absolute';
                    tooltip.style.left = '30px';
                    tooltip.style.top = '-10px';
                } else {
                    tooltip.style.position = 'absolute';
                    tooltip.style.left = '0';
                    tooltip.style.top = '30px';
                }
            }
        } else {
            tooltip.style.display = 'none';
        }
    }
    
    closeTooltip(questionId) {
        const tooltip = document.getElementById(`tooltip-${questionId}`);
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    // Close tooltips when clicking outside
    closeAllTooltips() {
        document.querySelectorAll('.tooltip-content').forEach(tooltip => {
            tooltip.style.display = 'none';
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the assessment page
    if (document.getElementById('assessment-container')) {
        window.assessmentEngine = new AssessmentEngine();
        
        // Close tooltips when clicking outside
        document.addEventListener('click', function(event) {
            if (!event.target.closest('.help-icon') && 
                !event.target.closest('.option-help-icon') && 
                !event.target.closest('.tooltip-content')) {
                if (window.assessmentEngine) {
                    window.assessmentEngine.closeAllTooltips();
                }
            }
        });
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssessmentEngine;
} else {
    window.AssessmentEngine = AssessmentEngine;
}