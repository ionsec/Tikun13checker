// Scoring Engine for Amendment 13 Compliance Assessment (Version 2)
// Enhanced calculator with complete coverage of Amendment 13 requirements

class ComplianceCalculatorV2 {
    constructor() {
        this.violations = [];
        this.recommendations = [];
        this.totalScore = 0;
        this.maxScore = 0;
        this.riskScore = 0;
    }

    calculateCompliance(answers, questions) {
        this.reset();
        
        questions.sections.forEach(sec => {
            sec.questions.forEach(q => {
                const a = answers[q.id];
                if (a !== undefined && a !== null) {
                    this.processAnswer(q, a, answers);
                }
            });
        });
        
        this.generateViolations(answers);
        this.generateRecommendations(answers);
        
        const compliancePercentage = this.maxScore > 0 ? Math.round((this.totalScore / this.maxScore) * 100) : 0;
        const riskLevel = this.getRiskLevel(this.riskScore);
        const totalFines = this.violations.reduce((s, v) => s + v.fine, 0);
        
        return {
            score: compliancePercentage,
            riskLevel,
            riskScore: this.riskScore,
            violations: this.violations,
            recommendations: this.recommendations,
            totalFines,
            complianceMatrix: this.generateComplianceMatrix(answers)
        };
    }

    reset() {
        this.violations = [];
        this.recommendations = [];
        this.totalScore = 0;
        this.maxScore = 0;
        this.riskScore = 0;
    }

    processAnswer(question, answer, answers) {
        const weight = question.weight || 1;
        this.maxScore += weight * 5;
        let risk = 0;
        
        if (question.type === 'multiselect') {
            risk = question.calculateRisk ? question.calculateRisk(answer) : this.calculateMultiselectRisk(answer, question);
        } else {
            risk = (question.riskFactor && question.riskFactor[answer]) ? question.riskFactor[answer] : 0;
        }
        
        const rm = this.calculateRiskMultiplier(question, answers);
        const adj = Math.min(5, risk * rm);
        this.riskScore += adj * weight;
        this.totalScore += Math.max(0, (5 - adj)) * weight;
    }

    calculateRiskMultiplier(question, answers) {
        let m = 1.0;
        const orgType = answers.org_type;
        
        if (orgType === 'public') m *= 1.3;
        else if (orgType === 'databroker') m *= 1.4;
        else if (orgType === 'financial' || orgType === 'healthcare') m *= 1.2;
        
        if (this.hasSensitiveData(answers.sensitive_data)) m *= 1.2;
        
        const dataCount = answers.data_subjects_count;
        if (dataCount === 'over_1m') m *= 1.3;
        else if (dataCount === '500k_1m' || dataCount === '100k_500k') m *= 1.1;
        
        if (question.id && question.id.includes('dpo') && this.requiresDPO(orgType, dataCount) && answers.dpo_appointed === 'no') m *= 1.5;
        
        return m;
    }

    calculateMultiselectRisk(selected) {
        if (!selected || selected.length === 0) return 5;
        if (selected.includes('none')) return 0;
        return Math.max(0, 5 - selected.length);
    }

    generateViolations(answers) {
        const hasSensitive = this.hasSensitiveData(answers.sensitive_data);
        
        // DPO
        if (answers.dpo_appointed === 'no' && this.requiresDPO(answers.org_type, answers.data_subjects_count)) {
            this.violations.push({
                severity: 'high',
                category: 'dpo',
                description: 'חובת מינוי ממונה הגנת פרטיות לא מולאה',
                fine: this.calculateDPOFine(answers.org_type, answers.data_subjects_count, hasSensitive),
                law_reference: 'סעיף 17ב1'
            });
        }
        
        // Registration
        if ((answers.database_registered === 'no' || answers.database_registered === 'partial') && this.requiresRegistration(answers.org_type)) {
            this.violations.push({
                severity: 'high',
                category: 'registration',
                description: 'מאגרי מידע לא רשומים כנדרש',
                fine: this.calculateRegistrationFine(answers.org_type, answers.data_subjects_count),
                law_reference: 'סעיף 8'
            });
        }
        
        // Large DB notice
        if (answers.large_database_notification === 'no') {
            this.violations.push({
                severity: 'medium',
                category: 'notification',
                description: 'הפרת חובת הודעה על מאגר מידע גדול עם מידע רגיש',
                fine: this.calculateRegistrationFine(answers.org_type, answers.data_subjects_count),
                law_reference: 'סעיף 8א(ב)'
            });
        }

        // Transparency / Privacy notice
        if (answers.privacy_notice === 'no') {
            this.violations.push({
                severity: 'medium',
                category: 'transparency',
                description: 'הודעת פרטיות חסרה - הפרת חובת היידוע',
                fine: this.calculateInformationNoticeFine(answers.data_subjects_count, hasSensitive),
                law_reference: 'סעיף 11'
            });
        } else if (answers.privacy_notice === 'outdated' || answers.privacy_notice === 'partial') {
            this.violations.push({
                severity: 'low',
                category: 'transparency',
                description: 'הודעת פרטיות לא מלאה או מעודכנת',
                fine: Math.round(this.calculateInformationNoticeFine(answers.data_subjects_count, hasSensitive) * 0.5),
                law_reference: 'סעיף 11'
            });
        }
        
        // Missing mandatory items in privacy notice contents
        const reqNoticeItems = ['purpose', 'legal_basis_or_obligation', 'recipients', 'rights_access', 'rights_correction'];
        if (Array.isArray(answers.privacy_notice_contents)) {
            const missing = reqNoticeItems.filter(k => !answers.privacy_notice_contents.includes(k));
            if (missing.length > 0) {
                this.violations.push({
                    severity: 'medium',
                    category: 'transparency',
                    description: `חסרים רכיבים בהודעת הפרטיות: ${missing.join(', ')}`,
                    fine: 25000,
                    law_reference: 'סעיף 11'
                });
            }
        }

        // Rights – access/correction
        if (answers.access_requests === 'no') {
            this.violations.push({
                severity: 'medium',
                category: 'rights',
                description: 'אין תהליך למימוש זכות עיון',
                fine: this.calculateDataSubjectRightsFine(),
                law_reference: 'סעיף 13'
            });
        }
        
        if (answers.correction_process === 'no') {
            this.violations.push({
                severity: 'medium',
                category: 'rights',
                description: 'אין תהליך לתיקון/מחיקת מידע לפי בקשה',
                fine: this.calculateDataSubjectRightsFine(),
                law_reference: 'סעיף 14'
            });
        }
        
        if (answers.refusal_notification === 'never') {
            this.violations.push({
                severity: 'low',
                category: 'rights',
                description: 'אין הודעה מנומקת במקרה של סירוב לבקשה',
                fine: 15000,
                law_reference: 'סעיף 14(ג)'
            });
        }
        
        if (answers.direct_marketing_optout === 'no') {
            this.violations.push({
                severity: 'medium',
                category: 'rights',
                description: 'אין מנגנון הסרה מדיוור ישיר',
                fine: 40000,
                law_reference: 'סעיף 17ו'
            });
        }

        // Processing principles / prohibitions
        if (answers.lawful_processing === 'no' || answers.lawful_processing === 'unknown') {
            this.violations.push({
                severity: 'high',
                category: 'processing',
                description: 'עיבוד ללא בסיס חוקי ברור',
                fine: this.calculateDataProcessingFine(answers.data_subjects_count, hasSensitive),
                law_reference: 'סעיף 2'
            });
        }
        
        if (answers.indirect_collection_notice === 'never') {
            this.violations.push({
                severity: 'medium',
                category: 'transparency',
                description: 'אין יידוע באיסוף עקיף',
                fine: 30000,
                law_reference: 'סעיף 23ד'
            });
        }
        
        if (answers.data_accuracy_governance === 'no') {
            this.violations.push({
                severity: 'low',
                category: 'principles',
                description: 'אין מנגנוני דיוק ועדכניות',
                fine: 10000,
                law_reference: 'סעיף 14'
            });
        }
        
        if (answers.third_party_correction_propagation === 'never') {
            this.violations.push({
                severity: 'low',
                category: 'principles',
                description: 'לא נשלחות הודעות על תיקון לגורמים שקיבלו את המידע',
                fine: 15000,
                law_reference: 'סעיף 14(ב)'
            });
        }

        if (answers.illegal_data_source === 'no') {
            this.violations.push({
                severity: 'high',
                category: 'processing',
                description: 'סיכון לעיבוד מידע שנאסף באופן לא חוקי',
                fine: this.calculateDataProcessingFine(answers.data_subjects_count, hasSensitive),
                law_reference: 'סעיף 8(ד)'
            });
        }
        
        if (answers.unauthorized_processing === 'no' || answers.unauthorized_processing === 'partial') {
            const sev = answers.unauthorized_processing === 'no' ? 'high' : 'medium';
            this.violations.push({
                severity: sev,
                category: 'processing',
                description: 'עיבוד מידע ללא הרשאה מבעל השליטה במאגר',
                fine: this.calculateDataProcessingFine(answers.data_subjects_count, hasSensitive),
                law_reference: 'סעיף 8(ג)'
            });
        }
        
        if (answers.purpose_limitation_general === 'no' || answers.purpose_limitation_general === 'sometimes' || 
            answers.purpose_limitation_prohibitions === 'no' || answers.purpose_limitation_prohibitions === 'sometimes') {
            this.violations.push({
                severity: 'medium',
                category: 'processing',
                description: 'שימוש בנתונים מעבר למטרה המקורית',
                fine: this.calculateDataProcessingFine(answers.data_subjects_count, hasSensitive),
                law_reference: 'סעיף 8(ב)'
            });
        }

        // Security
        if (answers.security_level === 'unknown' || answers.security_level === 'basic') {
            this.violations.push({
                severity: 'high',
                category: 'security',
                description: 'רמת אבטחה לא מספקת - הפרת תקנות אבטחת מידע',
                fine: this.calculateSecurityRegulationFine(answers.security_level, hasSensitive),
                law_reference: 'תקנות 2017'
            });
        }
        
        if (answers.breach_notification_timeline === 'no') {
            this.violations.push({
                severity: 'high',
                category: 'security',
                description: 'אין נוהל דיווח תוך 72 שעות על אירועי אבטחה חמורים',
                fine: this.calculateBreachNotificationFine(answers.org_type, hasSensitive),
                law_reference: 'סעיף דיווח אירוע'
            });
        } else if (answers.breach_notification_timeline === 'yes_partial') {
            this.violations.push({
                severity: 'medium',
                category: 'security',
                description: 'נוהל דיווח קיים אך לא מיושם במלואו',
                fine: Math.round(this.calculateBreachNotificationFine(answers.org_type, hasSensitive) * 0.5),
                law_reference: 'סעיף דיווח אירוע'
            });
        }

        // Third parties
        if (answers.third_party_agreements === 'no' && answers.third_party_agreements !== 'na') {
            this.violations.push({
                severity: 'medium',
                category: 'processing',
                description: 'חסרים הסכמים עם מעבדי משנה',
                fine: 60000,
                law_reference: 'סעיף 17ד'
            });
        }

        // Public body routine interchange
        if (answers.public_body_interchange_notice === 'no') {
            this.violations.push({
                severity: 'medium',
                category: 'notification',
                description: 'גוף ציבורי לא דיווח על קבלת מידע שוטפת',
                fine: 30000,
                law_reference: 'סעיף 23ד(ג)'
            });
        }

        // EU
        if (answers.receives_eu_data === 'yes') {
            if (answers.eu_data_deletion_mechanism === 'no') {
                this.violations.push({
                    severity: 'medium',
                    category: 'eu_transfer',
                    description: 'חסר מנגנון למחיקת מידע מהאיחוד האירופי',
                    fine: 15000,
                    law_reference: 'תקנות מידע מה-EEA'
                });
            }
            if (answers.eu_data_subject_notifications === 'no') {
                this.violations.push({
                    severity: 'medium',
                    category: 'eu_transfer',
                    description: 'אי הודעה לנושאי מידע מהאיחוד האירופי על העברות לצד שלישי',
                    fine: 15000,
                    law_reference: 'תקנות מידע מה-EEA'
                });
            }
            if (Array.isArray(answers.eu_regulation_compliance) && answers.eu_regulation_compliance.length < 3) {
                this.violations.push({
                    severity: 'medium',
                    category: 'eu_transfer',
                    description: 'אי עמידה בתקנות מידע מה-EEA',
                    fine: this.calculateEUTransferFine(answers.data_subjects_count),
                    law_reference: 'תקנות מידע מה-EEA'
                });
            }
        }
    }

    generateRecommendations(answers) {
        const hasSensitive = this.hasSensitiveData(answers.sensitive_data);
        
        if (answers.dpo_appointed === 'no' && this.requiresDPO(answers.org_type, answers.data_subjects_count)) {
            this.recommendations.push({
                priority: 'critical',
                category: 'dpo',
                action: 'מנו ממונה על הגנת הפרטיות',
                timeline: 'מיידי',
                description: 'חובה חוקית'
            });
        }

        if (answers.database_registered !== 'yes' && answers.database_registered !== 'exempt') {
            this.recommendations.push({
                priority: 'high',
                category: 'registration',
                action: 'השלימו רישום מאגרים',
                timeline: '30 ימים',
                description: 'נדרש לפי החוק'
            });
        }

        if (answers.privacy_notice !== 'yes') {
            this.recommendations.push({
                priority: (answers.privacy_notice === 'no' ? 'high' : 'medium'),
                category: 'transparency',
                action: (answers.privacy_notice === 'no' ? 'צרו הודעת פרטיות מקיפה' : 'עדכנו/השלימו הודעת פרטיות'),
                timeline: '60 ימים',
                description: 'שקיפות'
            });
        }

        if (Array.isArray(answers.privacy_notice_contents)) {
            const must = ['purpose', 'legal_basis_or_obligation', 'recipients', 'rights_access', 'rights_correction', 'contact_dpo'];
            const miss = must.filter(k => !answers.privacy_notice_contents.includes(k));
            if (miss.length > 0) {
                this.recommendations.push({
                    priority: 'medium',
                    category: 'transparency',
                    action: `השלימו רכיבים חסרים בהודעת הפרטיות: ${miss.join(', ')}`,
                    timeline: '45 ימים',
                    description: 'עמידה מלאה בסעיף 11'
                });
            }
        }

        if (answers.access_requests !== 'yes') {
            this.recommendations.push({
                priority: 'high',
                category: 'rights',
                action: 'הקימו תהליך למענה לבקשות עיון',
                timeline: '30 ימים',
                description: 'סעיף 13'
            });
        }
        
        if (answers.correction_process !== 'yes') {
            this.recommendations.push({
                priority: 'high',
                category: 'rights',
                action: 'הטמיעו תהליך תיקון/מחיקה עם SLA',
                timeline: '30-60 ימים',
                description: 'סעיף 14'
            });
        }
        
        if (answers.refusal_notification !== 'always' && answers.refusal_notification !== 'na') {
            this.recommendations.push({
                priority: 'medium',
                category: 'rights',
                action: 'הטמיעו הודעה מנומקת על סירוב',
                timeline: '30 ימים',
                description: 'סעיף 14(ג)'
            });
        }
        
        if (answers.direct_marketing_optout && answers.direct_marketing_optout !== 'yes' && answers.direct_marketing_optout !== 'na') {
            this.recommendations.push({
                priority: 'medium',
                category: 'rights',
                action: 'הוסיפו מנגנון הסרה קל מדיוור ישיר',
                timeline: '30 ימים',
                description: 'סעיף 17ו'
            });
        }

        if (answers.security_measures) {
            const missing = this.getMissingSecurityMeasures(answers.security_measures);
            if (missing.length > 0) {
                this.recommendations.push({
                    priority: 'high',
                    category: 'security',
                    action: `יישמו אמצעי אבטחה חסרים: ${this.translateSecurityMeasures(missing).join(', ')}`,
                    timeline: '90 ימים',
                    description: 'חיזוק אבטחת מידע'
                });
            }
        }

        if (answers.security_training === 'never') {
            this.recommendations.push({
                priority: 'medium',
                category: 'training',
                action: 'בצעו הדרכת אבטחת מידע',
                timeline: '30 ימים',
                description: 'תקנה 7'
            });
        } else if (answers.security_training === 'old') {
            this.recommendations.push({
                priority: 'medium',
                category: 'training',
                action: 'רעננו הדרכת אבטחת מידע',
                timeline: '60 ימים',
                description: 'תקנה 7'
            });
        }

        if (answers.deletion_policy === 'no') {
            this.recommendations.push({
                priority: 'medium',
                category: 'policy',
                action: 'גבשו מדיניות מחיקה ושמירת מידע',
                timeline: '60 ימים',
                description: 'מחזור חיי המידע'
            });
        }

        if (answers.breach_notification_timeline === 'no') {
            this.recommendations.push({
                priority: 'critical',
                category: 'security',
                action: 'הקימו נוהל דיווח 72 שעות',
                timeline: 'מיידי',
                description: 'חשיפה לקנסות'
            });
        } else if (answers.breach_notification_timeline === 'yes_partial') {
            this.recommendations.push({
                priority: 'high',
                category: 'security',
                action: 'השלימו יישום נוהל דיווח 72 שעות',
                timeline: '30 ימים',
                description: 'סיכון לקנסות'
            });
        }

        if (answers.third_party_agreements === 'no' && answers.third_party_agreements !== 'na') {
            this.recommendations.push({
                priority: 'high',
                category: 'processing',
                action: 'חתמו/עדכנו הסכמי עיבוד נתונים עם ספקים',
                timeline: '45 ימים',
                description: 'סעיף 17ד'
            });
        }

        if (answers.indirect_collection_notice === 'never') {
            this.recommendations.push({
                priority: 'medium',
                category: 'transparency',
                action: 'הטמיעו הודעה באיסוף עקיף',
                timeline: '30 ימים',
                description: 'סעיף 23ד'
            });
        }
        
        if (answers.data_accuracy_governance !== 'yes') {
            this.recommendations.push({
                priority: 'low',
                category: 'principles',
                action: 'הקימו מנגנוני בקרת דיוק ועדכון',
                timeline: '90 ימים',
                description: 'שיפור איכות נתונים'
            });
        }

        if (answers.receives_eu_data === 'yes') {
            if (answers.eu_data_deletion_mechanism !== 'yes') {
                this.recommendations.push({
                    priority: 'high',
                    category: 'eu_transfer',
                    action: 'הקימו מנגנון מחיקה/שימור מוגבל לנתוני EU',
                    timeline: '45 ימים',
                    description: 'תקנות מידע מה-EEA'
                });
            }
            if (answers.eu_data_subject_notifications !== 'yes' && answers.eu_data_subject_notifications !== 'no_transfers') {
                this.recommendations.push({
                    priority: 'medium',
                    category: 'eu_transfer',
                    action: 'הטמיעו הודעה על Onward Transfer',
                    timeline: '45 ימים',
                    description: 'שקיפות'
                });
            }
        }

        // Timeline reminder
        const implementationDate = new Date('2025-08-14');
        const today = new Date();
        const daysUntil = Math.ceil((implementationDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        
        if (daysUntil > 0) {
            const urgency = daysUntil < 30 ? 'critical' : daysUntil < 90 ? 'high' : 'medium';
            const timelineText = daysUntil < 30 ? 'מיידי - החוק נכנס לתוקף בקרוב!' : 
                               daysUntil < 90 ? `דחוף - ${daysUntil} ימים נותרו` : 
                               `${daysUntil} ימים לכניסת החוק לתוקף`;
            this.recommendations.push({
                priority: urgency,
                category: 'timeline',
                action: `השלימו היערכות לתיקון 13 - נותרו ${daysUntil} ימים`,
                timeline: timelineText,
                description: 'תאריך יישום: 14 באוגוסט 2025'
            });
        }
    }

    // Helper functions
    requiresDPO(orgType, dataCount) {
        if (orgType === 'public') return true;
        if (orgType === 'databroker' && dataCount !== 'less_10k') return true;
        if ((orgType === 'financial' || orgType === 'healthcare') && 
            (dataCount === '100k_500k' || dataCount === '500k_1m' || dataCount === 'over_1m')) return true;
        return false;
    }

    requiresRegistration(orgType) {
        return orgType === 'public' || orgType === 'databroker';
    }

    hasSensitiveData(arr) {
        if (!arr || arr.length === 0) return false;
        return !arr.includes('none');
    }

    calculateDPOFine(orgType, dataCount, hasSensitive = false) {
        const map = {
            less_10k: 10000,
            "10k_100k": 50000,
            "100k_500k": 250000,
            "500k_1m": 750000,
            over_1m: 1000000
        };
        const n = map[dataCount] || 50000;
        const per = hasSensitive ? 4 : 2;
        const min = hasSensitive ? 40000 : 20000;
        return Math.max(n * per, min);
    }

    calculateRegistrationFine(orgType, dataCount) {
        const base = 150000;
        return dataCount === 'over_1m' ? base * 2 : base;
    }

    calculateDataProcessingFine(dataCount, hasSensitive = false) {
        const map = {
            less_10k: 10000,
            "10k_100k": 50000,
            "100k_500k": 250000,
            "500k_1m": 750000,
            over_1m: 1000000
        };
        const n = map[dataCount] || 50000;
        const per = hasSensitive ? 8 : 4;
        const min = 200000;
        return Math.max(n * per, min);
    }

    calculateInformationNoticeFine(dataCount, hasSensitive = false) {
        const map = {
            less_10k: 10000,
            "10k_100k": 50000,
            "100k_500k": 250000,
            "500k_1m": 750000,
            over_1m: 1000000
        };
        const n = map[dataCount] || 50000;
        const per = hasSensitive ? 100 : 50;
        const min = 30000;
        return Math.max(n * per, min);
    }

    calculateDataSubjectRightsFine() {
        return 15000;
    }

    calculateSecurityRegulationFine(level, hasSensitive = false) {
        const base = {
            basic_violation: hasSensitive ? 80000 : 20000,
            medium_violation: hasSensitive ? 160000 : 40000,
            high_violation: hasSensitive ? 320000 : 80000
        };
        if (level === 'unknown' || level === 'basic') return base.high_violation;
        if (level === 'medium') return base.medium_violation;
        return base.basic_violation;
    }

    calculateBreachNotificationFine(orgType, hasSensitive = false) {
        let base = 100000;
        if (orgType === 'public') base *= 1.5;
        else if (orgType === 'databroker') base *= 2.0;
        else if (orgType === 'financial' || orgType === 'healthcare') base *= 1.3;
        if (hasSensitive) base *= 1.5;
        return Math.min(base, 500000);
    }

    calculateEUTransferFine(dataCount) {
        const map = {
            less_10k: 10000,
            "10k_100k": 50000,
            "100k_500k": 250000,
            "500k_1m": 750000,
            over_1m: 1000000
        };
        const n = map[dataCount] || 50000;
        return n * 4;
    }

    // Aligned to questionnaire options
    getMissingSecurityMeasures(implemented) {
        const all = ['system_structure', 'system_protection', 'personnel_management', 'access_permissions', 
                    'access_monitoring', 'incident_handling', 'system_separation', 'network_security', 
                    'outsourcing_control', 'periodic_audit'];
        return all.filter(m => !(implemented || []).includes(m));
    }

    translateSecurityMeasures(measures) {
        const map = {
            system_structure: 'מבנה המאגר',
            system_protection: 'הגנת מערכות',
            personnel_management: 'ניהול כוח אדם',
            access_permissions: 'הרשאות',
            access_monitoring: 'בקרה ותיעוד גישה',
            incident_handling: 'טיפול באירועים',
            system_separation: 'מידור',
            network_security: 'אבטחת רשת',
            outsourcing_control: 'פיקוח על ספקים',
            periodic_audit: 'ביקורת תקופתית'
        };
        return measures.map(m => map[m] || m);
    }

    getRiskLevel(score) {
        if (score < 15) return {
            level: 'low',
            label: 'נמוך',
            color: '#4CAF50',
            description: 'הארגון בסיכון נמוך לאי עמידה',
            actionRequired: 'המשך מעקב'
        };
        if (score < 30) return {
            level: 'medium',
            label: 'בינוני',
            color: '#FF9800',
            description: 'נדרשים שיפורים נקודתיים',
            actionRequired: 'תוכנית התאמה תוך 6 חודשים'
        };
        if (score < 50) return {
            level: 'high',
            label: 'גבוה',
            color: '#FF5722',
            description: 'נדרשת פעולה מיידית לתיקון ליקויים',
            actionRequired: 'תיקון דחוף תוך 90 יום'
        };
        if (score < 70) return {
            level: 'critical',
            label: 'קריטי',
            color: '#F44336',
            description: 'מצב קריטי - חשיפה לקנסות',
            actionRequired: 'פעולה מיידית תוך 30 יום'
        };
        return {
            level: 'emergency',
            label: 'חירום',
            color: '#B71C1C',
            description: 'הפרות מרובות ומשמעותיות',
            actionRequired: 'הפסקת פעילות עד לתיקון'
        };
    }

    generateComplianceMatrix(answers) {
        return {
            dpo: {
                status: this.getDPOStatus(answers),
                requirement: this.getDPORequirement(answers),
                compliant: answers.dpo_appointed === 'yes'
            },
            registration: {
                status: this.getRegistrationStatus(answers),
                requirement: this.getRegistrationRequirement(answers),
                compliant: (answers.database_registered === 'yes' || answers.database_registered === 'exempt')
            },
            security: {
                status: this.getSecurityStatus(answers),
                requirement: 'רמת אבטחה ' + this.getSecurityLevelText(answers.security_level),
                compliant: (answers.security_level === 'high' || answers.security_level === 'medium')
            },
            rights: {
                status: this.getRightsStatus(answers),
                requirement: 'הודעת פרטיות + תהליכי זכויות',
                compliant: (answers.privacy_notice === 'yes' && answers.access_requests === 'yes' && answers.correction_process === 'yes')
            },
            documentation: {
                status: this.getDocumentationStatus(answers),
                requirement: 'מסמכי הגדרת מאגר מעודכנים',
                compliant: answers.database_documentation === 'yes'
            },
            consent: {
                status: this.getConsentStatus(answers),
                requirement: 'מנגנון ניהול הסכמות',
                compliant: answers.consent_management === 'yes'
            }
        };
    }

    // Status helpers
    getDPOStatus(a) {
        if (a.dpo_appointed === 'yes') return 'תקין';
        if (a.dpo_appointed === 'process') return 'בתהליך';
        return 'נדרש טיפול';
    }

    getDPORequirement(a) {
        const t = a.org_type, c = a.data_subjects_count;
        if (t === 'public') return 'חובה לגוף ציבורי';
        if (t === 'databroker' && c !== 'less_10k') return 'חובה לסוחר נתונים';
        if ((t === 'financial' || t === 'healthcare') && (c === '100k_500k' || c === '500k_1m' || c === 'over_1m')) return 'חובה - היקף גדול';
        return 'מומלץ';
    }

    getRegistrationStatus(a) {
        if (a.database_registered === 'yes' || a.database_registered === 'exempt') return 'תקין';
        if (a.database_registered === 'partial') return 'חלקי';
        return 'נדרש טיפול';
    }

    getRegistrationRequirement(a) {
        if (a.org_type === 'public') return 'חובת רישום לכל המאגרים';
        if (a.org_type === 'databroker') return 'חובת רישום מעל 10,000';
        return 'פטור מרישום';
    }

    getSecurityStatus(a) {
        if (a.security_level === 'high') return 'תקין';
        if (a.security_level === 'medium') return 'סביר';
        return 'נדרש שיפור';
    }

    getSecurityLevelText(l) {
        const m = { high: 'גבוהה', medium: 'בינונית', basic: 'בסיסית', unknown: 'לא ידועה' };
        return m[l] || 'לא מוגדרת';
    }

    getRightsStatus(a) {
        if (a.privacy_notice === 'yes' && a.access_requests === 'yes' && a.correction_process === 'yes') return 'תקין';
        if (a.privacy_notice === 'partial' || a.access_requests === 'partial') return 'חלקי';
        return 'נדרש שיפור';
    }

    getDocumentationStatus(a) {
        if (a.database_documentation === 'yes') return 'תקין';
        if (a.database_documentation === 'partial' || a.database_documentation === 'outdated') return 'נדרש עדכון';
        return 'חסר';
    }

    getConsentStatus(a) {
        if (a.consent_management === 'yes') return 'תקין';
        if (a.consent_management === 'partial') return 'חלקי';
        return 'חסר';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComplianceCalculatorV2;
} else {
    // Keep compatibility with existing code by creating an alias
    window.ComplianceCalculator = ComplianceCalculatorV2;
    window.ComplianceCalculatorV2 = ComplianceCalculatorV2;
}