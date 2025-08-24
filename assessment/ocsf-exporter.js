// OCSF 1.6.0 Exporter for Amendment 13 Compliance Assessment
// Exports assessment results in Open Cybersecurity Schema Framework format

class OCSFExporter {
    constructor() {
        this.version = "1.6.0";
        this.product = {
            name: "Tikun13 Compliance Checker",
            vendor_name: "Amendment 13 Assessment Tool",
            version: "1.0.0"
        };
    }

    // Export violations as OCSF Compliance Findings (class_uid: 2003)
    exportComplianceFindings(results, answers) {
        const findings = results.violations.map((violation, index) => this.createComplianceFinding(violation, index, results, answers));
        
        return {
            version: this.version,
            metadata: {
                version: this.version,
                profiles: ["compliance", "privacy"],
                extension: {
                    name: "Israeli Privacy Law Amendment 13",
                    version: "2025"
                }
            },
            findings: findings
        };
    }

    // Create individual compliance finding
    createComplianceFinding(violation, index, results, answers) {
        const timestamp = Date.now();
        
        return {
            // Required fields
            activity_id: 1, // Create - new finding
            category_uid: 2, // Findings category
            class_uid: 2003, // Compliance Finding
            time: timestamp,
            severity_id: this.mapSeverity(violation.severity),
            type_uid: 200301, // Compliance Finding: Create
            
            // Compliance context
            compliance: {
                requirements: ["Israeli Privacy Protection Law - Amendment 13"],
                control: violation.law_reference || "General Requirement",
                standards: ["IL-PPL-Amendment-13-2025"],
                status: "Non-Compliant",
                status_detail: violation.description
            },
            
            // Finding details
            finding_info: {
                title: violation.description,
                uid: `tikun13-${timestamp}-${index}`,
                desc: this.getDetailedDescription(violation),
                types: [violation.category],
                created_time: timestamp,
                modified_time: timestamp,
                product_uid: "tikun13-checker"
            },
            
            // Risk and impact
            risk_level_id: this.mapRiskLevel(results.riskLevel?.label),
            impact_id: this.mapImpact(violation.severity),
            confidence_id: 3, // High confidence (based on direct assessment)
            
            // Status tracking
            status_id: 1, // New finding
            disposition_id: 99, // Other (non-compliant)
            
            // Remediation guidance
            remediation: {
                desc: this.getRemediationText(violation, results.recommendations),
                kb_articles: this.getKnowledgeBaseArticles(violation.category)
            },
            
            // Financial impact
            impact_score: violation.fine || 0,
            
            // Metadata
            metadata: {
                version: this.version,
                product: this.product,
                original_time: new Date(timestamp).toISOString(),
                processed_time: timestamp,
                log_name: "Amendment13ComplianceAssessment",
                log_provider: "Tikun13Checker"
            },
            
            // Organization context
            organization: {
                name: this.getOrganizationType(answers.org_type),
                ou_name: this.getDataScale(answers.data_subjects_count)
            },
            
            // Additional context
            unmapped: {
                fine_amount_ils: violation.fine,
                violation_category: violation.category,
                sensitive_data_types: answers.sensitive_data || [],
                compliance_score: results.score,
                assessment_answers: this.sanitizeAnswers(answers)
            }
        };
    }

    // Export data protection violations as Data Security Findings (class_uid: 2006)
    exportDataSecurityFindings(results, answers) {
        const dataCategories = ['data_subjects', 'consent', 'access_rights', 'data_minimization', 'privacy_notice', 'third_party'];
        const dataViolations = results.violations.filter(v => dataCategories.includes(v.category));
        
        if (dataViolations.length === 0) {
            return { version: this.version, findings: [] };
        }
        
        const findings = dataViolations.map((violation, index) => this.createDataSecurityFinding(violation, index, results, answers));
        
        return {
            version: this.version,
            metadata: {
                version: this.version,
                profiles: ["data_security", "privacy"],
                extension: {
                    name: "Israeli Privacy Law Data Protection",
                    version: "2025"
                }
            },
            findings: findings
        };
    }

    // Create individual data security finding
    createDataSecurityFinding(violation, index, results, answers) {
        const timestamp = Date.now();
        const isSuspectedBreach = ['consent', 'data_subjects'].includes(violation.category);
        
        return {
            // Required fields
            activity_id: 2, // Read - data access/processing violation
            category_uid: 2, // Findings category
            class_uid: 2006, // Data Security Finding
            time: timestamp,
            severity_id: this.mapSeverity(violation.severity),
            type_uid: 200602, // Data Security Finding: Read
            
            // Data security context
            data_security: {
                category_name: this.getDataSecurityCategory(violation.category),
                confidentiality_id: this.getConfidentialityLevel(answers.sensitive_data),
                detection_system: "Amendment 13 Compliance Assessment",
                policy: violation.law_reference || "Privacy Protection Policy"
            },
            
            // Finding details
            finding_info: {
                title: violation.description,
                uid: `tikun13-data-${timestamp}-${index}`,
                desc: this.getDataViolationDescription(violation, answers),
                types: ["Privacy Violation", violation.category],
                created_time: timestamp,
                product_uid: "tikun13-checker"
            },
            
            // Breach indication
            is_suspected_breach: isSuspectedBreach,
            
            // Impact assessment
            impact_id: this.mapImpact(violation.severity),
            risk_level_id: this.mapRiskLevel(results.riskLevel?.label),
            
            // Disposition
            disposition_id: isSuspectedBreach ? 2 : 99, // 2: True Positive, 99: Other
            status_id: 1, // New
            
            // Resources affected
            resources: this.getAffectedResources(violation, answers),
            
            // Metadata
            metadata: {
                version: this.version,
                product: this.product,
                original_time: new Date(timestamp).toISOString(),
                processed_time: timestamp
            },
            
            // Additional context
            unmapped: {
                data_subjects_count: answers.data_subjects_count,
                sensitive_data_types: answers.sensitive_data || [],
                violation_details: violation
            }
        };
    }

    // Export combined OCSF report
    exportCombinedReport(results, answers) {
        const timestamp = Date.now();
        
        return {
            version: this.version,
            report_metadata: {
                generated_at: new Date(timestamp).toISOString(),
                assessment_type: "Amendment 13 Compliance Assessment",
                organization_type: this.getOrganizationType(answers.org_type),
                data_scale: this.getDataScale(answers.data_subjects_count)
            },
            summary: {
                compliance_score: results.score,
                risk_level: results.riskLevel?.label || "Unknown",
                total_violations: results.violations.length,
                total_fines: results.totalFines,
                critical_violations: results.violations.filter(v => v.severity === 'critical').length,
                high_violations: results.violations.filter(v => v.severity === 'high').length,
                requires_dpo: this.requiresDPO(answers),
                has_sensitive_data: (answers.sensitive_data && answers.sensitive_data.length > 0)
            },
            compliance_findings: this.exportComplianceFindings(results, answers),
            data_security_findings: this.exportDataSecurityFindings(results, answers),
            recommendations: this.exportRecommendations(results.recommendations),
            compliance_matrix: results.complianceMatrix
        };
    }

    // Export recommendations in OCSF format
    exportRecommendations(recommendations) {
        return recommendations.map((rec, index) => ({
            priority: rec.priority,
            category: rec.category,
            action: rec.action,
            description: rec.description,
            timeline: rec.timeline,
            reference: rec.reference || "Amendment 13 Requirements",
            uid: `rec-${Date.now()}-${index}`
        }));
    }

    // Mapping functions
    mapSeverity(severity) {
        const mapping = {
            'critical': 5, // Fatal
            'high': 4,     // High
            'medium': 3,   // Medium
            'low': 2,      // Low
            'info': 1      // Informational
        };
        return mapping[severity] || 0; // Unknown
    }

    mapImpact(severity) {
        const mapping = {
            'critical': 4, // Critical
            'high': 3,     // High
            'medium': 2,   // Medium
            'low': 1,      // Low
            'info': 0      // None
        };
        return mapping[severity] || 0;
    }

    mapRiskLevel(riskLabel) {
        const mapping = {
            'קריטי': 4,     // Critical
            'גבוה מאוד': 4, // Critical
            'גבוה': 3,      // High
            'בינוני': 2,    // Medium
            'נמוך': 1,      // Low
            'מינימלי': 0    // Info
        };
        return mapping[riskLabel] || 0;
    }

    // Helper functions
    getDetailedDescription(violation) {
        return `${violation.description}. סעיף חוק: ${violation.law_reference || 'כללי'}. קטגוריה: ${violation.category}. קנס פוטנציאלי: ₪${violation.fine?.toLocaleString() || '0'}`;
    }

    getRemediationText(violation, recommendations) {
        const relevantRecs = recommendations.filter(r => r.category === violation.category);
        if (relevantRecs.length > 0) {
            return relevantRecs.map(r => r.action).join('; ');
        }
        return `יש לתקן את ההפרה בהתאם לדרישות ${violation.law_reference || 'תיקון 13'}`;
    }

    getKnowledgeBaseArticles(category) {
        const articles = {
            'dpo': ['https://www.gov.il/he/departments/guides/data_protection_officer'],
            'registration': ['https://www.gov.il/he/service/database_registration'],
            'security': ['https://www.gov.il/he/departments/guides/data_security_regulations'],
            'consent': ['https://www.gov.il/he/departments/guides/consent_management'],
            'access_rights': ['https://www.gov.il/he/departments/guides/data_subject_rights'],
            'privacy_notice': ['https://www.gov.il/he/departments/guides/privacy_policy_requirements']
        };
        return articles[category] || [`tikun13-${category}-guide`];
    }

    getOrganizationType(orgType) {
        const types = {
            'public': 'גוף ציבורי',
            'private': 'חברה פרטית',
            'databroker': 'סוחר נתונים',
            'security': 'גוף ביטחוני',
            'financial': 'מוסד פיננסי',
            'healthcare': 'מוסד רפואי'
        };
        return types[orgType] || 'ארגון';
    }

    getDataScale(dataSubjectsCount) {
        const scales = {
            'less_10k': 'Small (<10K)',
            '10k_100k': 'Medium (10K-100K)',
            '100k_500k': 'Large (100K-500K)',
            '500k_1m': 'Very Large (500K-1M)',
            'over_1m': 'Enterprise (>1M)'
        };
        return scales[dataSubjectsCount] || 'Unknown';
    }

    getDataSecurityCategory(violationCategory) {
        const categories = {
            'consent': 'Consent Management',
            'data_subjects': 'Data Subject Rights',
            'access_rights': 'Access Control',
            'data_minimization': 'Data Minimization',
            'privacy_notice': 'Privacy Notice',
            'third_party': 'Third Party Sharing'
        };
        return categories[violationCategory] || 'Privacy Violation';
    }

    getConfidentialityLevel(sensitiveData) {
        if (!sensitiveData || sensitiveData.length === 0) {
            return 1; // Public
        }
        if (sensitiveData.includes('medical') || sensitiveData.includes('biometric')) {
            return 4; // Secret
        }
        if (sensitiveData.includes('financial') || sensitiveData.includes('criminal')) {
            return 3; // Confidential
        }
        return 2; // Internal
    }

    getDataViolationDescription(violation, answers) {
        let desc = violation.description;
        if (answers.sensitive_data && answers.sensitive_data.length > 0) {
            desc += `. מידע רגיש: ${answers.sensitive_data.join(', ')}`;
        }
        if (answers.data_subjects_count) {
            desc += `. היקף נושאי מידע: ${this.getDataScale(answers.data_subjects_count)}`;
        }
        return desc;
    }

    getAffectedResources(violation, answers) {
        const resources = [];
        
        if (violation.category === 'data_subjects' || violation.category === 'consent') {
            resources.push({
                type: "Database",
                name: "Personal Data Repository",
                uid: "pdr-001",
                criticality: answers.sensitive_data ? 4 : 2
            });
        }
        
        if (violation.category === 'third_party') {
            resources.push({
                type: "Third Party Integration",
                name: "External Data Processors",
                uid: "ext-proc-001",
                criticality: 3
            });
        }
        
        return resources;
    }

    requiresDPO(answers) {
        return answers.org_type === 'public' || 
               answers.org_type === 'databroker' ||
               (answers.sensitive_data && answers.sensitive_data.length > 0 && 
                ['100k_500k', '500k_1m', 'over_1m'].includes(answers.data_subjects_count));
    }

    sanitizeAnswers(answers) {
        // Remove any PII or sensitive information from answers before including in export
        const sanitized = { ...answers };
        delete sanitized.organization_name;
        delete sanitized.contact_details;
        return sanitized;
    }

    // Generate unique identifier
    generateUID() {
        return `tikun13-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export for use in assessment module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OCSFExporter;
}