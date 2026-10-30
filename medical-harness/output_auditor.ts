/**
 * Output Auditor - 输出审核与免责声明
 * 
 * 负责医学输出的审核、免责声明注入、幻觉检测
 */

import { tool } from '@earendil-works/pi-agent-core';

/**
 * 输出审核结果
 */
export interface AuditResult {
  passed: boolean;
  issues: AuditIssue[];
  disclaimer_added: boolean;
  reviewed_at: string;
}

/**
 * 问题严重程度
 */
export type IssueSeverity = 'critical' | 'warning' | 'info';

/**
 * 发现的问题
 */
export interface AuditIssue {
  type: 'missing_disclaimer' | 'missing_evidence' | 'potentially_harmful' | 'hallucination' | 'missing_dose' | 'incomplete_info';
  severity: IssueSeverity;
  message: string;
  suggestion?: string;
}

/**
 * 必需的输出字段
 */
const REQUIRED_FIELDS = [
  'severity',
  'mechanism',
  'management' // 或 recommendations
];

/**
 * 检查输出是否包含必需字段
 */
function checkRequiredFields(content: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const lowerContent = content.toLowerCase();
  
  for (const field of REQUIRED_FIELDS) {
    if (!lowerContent.includes(field)) {
      issues.push({
        type: 'incomplete_info',
        severity: 'warning',
        message: `缺少 "${field}" 信息`,
        suggestion: `请添加${field}相关的详细说明`
      });
    }
  }
  
  return issues;
}

/**
 * 检测潜在的幻觉内容
 */
function detectHallucinations(content: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const lowerContent = content.toLowerCase();
  
  // 检测可疑短语
  const suspiciousPhrases = [
    { phrase: '100%有效', severity: 'warning' as IssueSeverity },
    { phrase: '绝对安全', severity: 'warning' as IssueSeverity },
    { phrase: ' guaranteed', severity: 'warning' as IssueSeverity },
    { phrase: '无任何副作用', severity: 'warning' as IssueSeverity }
  ];
  
  for (const { phrase, severity } of suspiciousPhrases) {
    if (lowerContent.includes(phrase)) {
      issues.push({
        type: 'hallucination',
        severity,
        message: `检测到绝对化表述: "${phrase}"`,
        suggestion: '医学结论应避免绝对化表述'
      });
    }
  }
  
  // 检测证据来源
  const hasEvidence = lowerContent.includes('level') || 
    lowerContent.includes('evidence') ||
    lowerContent.includes('study') ||
    lowerContent.includes('trial') ||
    lowerContent.includes('drugbank');
  
  if (!hasEvidence && content.length > 500) {
    issues.push({
      type: 'missing_evidence',
      severity: 'warning',
      message: '缺少证据等级信息',
      suggestion: '添加证据来源和等级（Level 1/2/3）'
    });
  }
  
  return issues;
}

/**
 * 检测潜在有害建议
 */
function detectHarmfulSuggestions(content: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const lowerContent = content.toLowerCase();
  
  // 检测危险短语
  const harmfulPatterns = [
    { pattern: /停药/i, severity: 'critical' as IssueSeverity },
    { pattern: /自行调整剂量/i, severity: 'critical' as IssueSeverity },
    { pattern: /不需要医生/i, severity: 'critical' as IssueSeverity },
    { pattern: /完全可以/i, severity: 'warning' as IssueSeverity }
  ];
  
  for (const { pattern, severity } of harmfulPatterns) {
    if (pattern.test(lowerContent)) {
      issues.push({
        type: 'potentially_harmful',
        severity,
        message: `检测到可能有害的建议: ${pattern.source}`
      });
    }
  }
  
  return issues;
}

/**
 * 默认免责声明（中英文）
 */
const DEFAULT_DISCLAIMER_ZH = `
📌 免责声明：本分析基于DrugBank数据库，仅供参考。
临床决策应结合患者具体情况，由具有处方权的医师最终确定。
如有任何疑问，请咨询专业药师或医生。
`;

const DEFAULT_DISCLAIMER_EN = `
📌 Disclaimer: This analysis is based on the DrugBank database and is for reference only.
Clinical decisions should be made by a licensed physician based on the patient's specific condition.
Please consult a professional pharmacist or physician if you have any questions.
`;

/**
 * 多语言免责声明
 */
function getDisclaimer(lang: string = 'zh'): string {
  return lang.startsWith('zh') ? DEFAULT_DISCLAIMER_ZH : DEFAULT_DISCLAIMER_EN;
}

/**
 * 向输出添加免责声明
 */
function injectDisclaimer(content: string, lang: string = 'zh'): string {
  if (content.includes('免责声明')) {
    return content;
  }
  
  const disclaimer = getDisclaimer(lang);
  return content + '\n\n' + disclaimer;
}

/**
 * 输出审核工具
 */
export const outputAuditorTool = tool({
  name: 'audit_medical_output',
  description: '审核医学输出：检查必需字段、注入免责声明、检测幻觉',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: '待审核的内容' },
      require_disclaimer: {
        type: 'boolean',
        default: true,
        description: '是否需要注入免责声明'
      },
      lang: {
        type: 'string',
        default: 'zh',
        description: '语言（zh/en）'
      }
    },
    required: ['content']
  },
  handler: async ({ content, require_disclaimer = true, lang = 'zh' }) => {
    console.log(`[Output Auditor] Auditing content (${content.length} chars)`);
    
    const issues: AuditIssue[] = [];
    
    // 检查必需字段
    issues.push(...checkRequiredFields(content));
    
    // 检测幻觉
    issues.push(...detectHallucinations(content));
    
    // 检测有害建议
    issues.push(...detectHarmfulSuggestions(content));
    
    // 检查是否需要免责声明
    if (require_disclaimer && !content.includes('免责声明')) {
      issues.push({
        type: 'missing_disclaimer', 
        severity: 'critical',
        message: '缺少免责声明'
      });
    }
    
    // 确定是否通过
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const passed = criticalIssues.length === 0;
    
    let auditedContent = content;
    if (require_disclaimer) {
      auditedContent = injectDisclaimer(content, lang);
    }
    
    return {
      passed,
      issues,
      disclaimer_added: require_disclaimer,
      reviewed_at: new Date().toISOString(),
      audited_content: auditedContent
    };
  }
});

/**
 * 快速添加免责声明工具
 */
export const disclaimerTool = tool({
  name: 'add_medical_disclaimer',
  description: '快速添加医学免责声明',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: '原始内容' },
      lang: { type: 'string', default: 'zh' }
    },
    required: ['content']
  },
  handler: async ({ content, lang = 'zh' }) => {
    if (content.includes('免责声明')) {
      return { content, already_had_disclaimer: true };
    }
    
    return {
      content: content + '\n\n' + getDisclaimer(lang),
      already_had_disclaimer: false
    };
  }
});

/**
 * Hallucination检测工具（专门用于检测AI幻觉）
 */
export const hallucinationDetectorTool = tool({
  name: 'detect_medical_hallucination',
  description: '专门检测医学内容中的可能幻觉',
  parameters: {
    type: 'object',
    properties: {
      drug_names: { type: 'array', items: { type: 'string' }, description: '涉及的药物' },
      claims: { type: 'array', items: { type: 'string' }, description: '具体的声明/说法' }
    },
    required: ['drug_names', 'claims']
  },
  handler: async ({ drug_names, claims }) => {
    const detected: Array<{ claim: string; risk_level: 'high' | 'medium' | 'low'; reason: string }> = [];
    
    // 已知的可靠信息映射
    const knownInteractions: Record<string, string[]> = {
      'warfarin+sulfamethoxazole': ['major', 'CYP2C9抑制，增强抗凝'],
      'clopidogrel+omeprazole': ['moderate', 'CYP2C19抑制'] 
    };
    
    for (const claim of claims) {
      const lowerClaim = claim.toLowerCase();
      let riskLevel: 'high' | 'medium' | 'low' = 'low';
      let reason = '无法验证该声称';
      
      // 检测不确定的声称
      if (lowerClaim.includes('never') || lowerClaim.includes('always')) {
        riskLevel = 'medium';
        reason = '医学结论不应使用绝对化语言';
      }
      if (lowerClaim.includes('100%') || lowerClaim.includes('guaranteed')) {
        riskLevel = 'high';
        reason = '不可能有100%的保证';
      }
      if (lowerClaim.includes('cure') && !lowerClaim.includes('may')) {
        riskLevel = 'medium';
        reason = '避免使用"治愈"等绝对化用语';
      }
      
      detected.push({ claim, risk_level: riskLevel, reason });
    }
    
    const highRiskCount = detected.filter(d => d.risk_level === 'high').length;
    
    return {
      has_hallucination_risk: highRiskCount > 0,
      detected,
      summary: {
        high_risk: highRiskCount,
        medium_risk: detected.filter(d => d.risk_level === 'medium').length,
        low_risk: detected.filter(d => d.risk_level === 'low').length
      }
    };
  }
});

export const auditorTools = [
  outputAuditorTool,
  disclaimerTool,
  hallucinationDetectorTool
];