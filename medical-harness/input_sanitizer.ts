/**
 * Input Sanitizer - 输入校验与脱敏
 * 
 * 医学场景输入验证：药物名称标准化、剂量单位校验、患者隐私保护
 */

import { tool } from '@earendil-works/pi-agent-core';

/**
 * 药物名称标准化映射
 */
const STANDARD_DRUG_NAMES: Record<string, { standard: string; drugbank_id: string; category: string }> = {
  'warfarin': { standard: 'Warfarin', drugbank_id: 'DB00682', category: 'Anticoagulant' },
  'coumadin': { standard: 'Warfarin', drugbank_id: 'DB00682', category: 'Anticoagulant' },
  '华法林': { standard: 'Warfarin', drugbank_id: 'DB00682', category: 'Anticoagulant' },
  'aspirin': { standard: 'Aspirin', drugbank_id: 'DB00945', category: 'Antiplatelet' },
  'acetylsalicylic acid': { standard: 'Aspirin', drugbank_id: 'DB00945', category: 'Antiplatelet' },
  '阿司匹林': { standard: 'Aspirin', drugbank_id: 'DB00945', category: 'Antiplatelet' },
  '乙酰水杨酸': { standard: 'Aspirin', drugbank_id: 'DB00945', category: 'Antiplatelet' },
  'clopidogrel': { standard: 'Clopidogrel', drugbank_id: 'DB01109', category: 'Antiplatelet' },
  'plavix': { standard: 'Clopidogrel', drugbank_id: 'DB01109', category: 'Antiplatelet' },
  '氯吡格雷': { standard: 'Clopidogrel', drugbank_id: 'DB01109', category: 'Antiplatelet' },
  'omeprazole': { standard: 'Omeprazole', drugbank_id: 'DB00338', category: 'PPI' },
  'prilosec': { standard: 'Omeprazole', drugbank_id: 'DB00338', category: 'PPI' },
  '奥美拉唑': { standard: 'Omeprazole', drugbank_id: 'DB00338', category: 'PPI' },
  'sulfamethoxazole': { standard: 'Sulfamethoxazole', drugbank_id: 'DB00338', category: 'Antibiotic' },
  'trimethoprim': { standard: 'Trimethoprim', drugbank_id: 'DB00237', category: 'Antibiotic' },
  'bactrim': { standard: 'Sulfamethoxazole/Trimethoprim', drugbank_id: 'DB00338', category: 'Antibiotic' },
  '复方新诺明': { standard: 'Sulfamethoxazole/Trimethoprim', drugbank_id: 'DB00338', category: 'Antibiotic' },
  'septa': { standard: 'Sulfamethoxazole/Trimethoprim', drugbank_id: 'DB00338', category: 'Antibiotic' },
  
  // 常见慢性病药物
  'metformin': { standard: 'Metformin', drugbank_id: 'DB00303', category: 'Antidiabetic' },
  '二甲双胍': { standard: 'Metformin', drugbank_id: 'DB00303', category: 'Antidiabetic' },
  'glucophage': { standard: 'Metformin', drugbank_id: 'DB00303', category: 'Antidiabetic' },
  'amlodipine': { standard: 'Amlodipine', drugbank_id: 'DB00575', category: 'Calcium Channel Blocker' },
  '氨氯地平': { standard: 'Amlodipine', drugbank_id: 'DB00575', category: 'Calcium Channel Blocker' },
  'norvasc': { standard: 'Amlodipine', drugbank_id: 'DB00575', category: 'Calcium Channel Blocker' },
  'lisinopril': { standard: 'Lisinopril', drugbank_id: 'DB00736', category: 'ACE Inhibitor' },
  '赖诺普利': { standard: 'Lisinopril', drugbank_id: 'DB00736', category: 'ACE Inhibitor' },
  'prinivil': { standard: 'Lisinopril', drugbank_id: 'DB00736', category: 'ACE Inhibitor' },
  'atorvastatin': { standard: 'Atorvastatin', drugbank_id: 'DB01076', category: 'Statin' },
  '阿托伐他汀': { standard: 'Atorvastatin', drugbank_id: 'DB01076', category: 'Statin' },
  'lipitor': { standard: 'Atorvastatin', drugbank_id: 'DB01076', category: 'Statin' },
  'simvastatin': { standard: 'Simvastatin', drugbank_id: 'DB00641', category: 'Statin' },
  '辛伐他汀': { standard: 'Simvastatin', drugbank_id: 'DB00641', category: 'Statin' },
  'zocor': { standard: 'Simvastatin', drugbank_id: 'DB00641', category: 'Statin' }
};

/**
 * 标准化药物名称
 */
function normalizeDrugName(input: string): { standard: string; drugbank_id: string; category: string } | null {
  const normalized = input.toLowerCase().trim().replace(/\s+/g, '');
  return STANDARD_DRUG_NAMES[normalized] || null;
}

/**
 * 验证药物名称格式
 */
function validateDrugName(name: string): { valid: boolean; normalized?: string; warning?: string } {
  const result = normalizeDrugName(name);
  
  if (result) {
    return { valid: true, normalized: result.standard };
  }
  
  // 尝试模糊匹配
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(STANDARD_DRUG_NAMES)) {
    if (key.includes(lowerName) || lowerName.includes(key)) {
      return { 
        valid: true, 
        normalized: value.standard,
        warning: `可能是 "${value.standard}" 的别名？`
      };
    }
  }
  
  return { 
    valid: false, 
    warning: `未知的药物名称: "${name}"` 
  };
}

/**
 * 剂量单位标准化
 */
const DOSAGE_PATTERNS = [
  { pattern: /(\d+(?:\.\d+)?)\s*mg/i, unit: 'mg' },
  { pattern: /(\d+(?:\.\d+)?)\s*g/i, unit: 'g', factor: 1000 },
  { pattern: /(\d+(?:\.\d+)?)\s*mcg/i, unit: 'mcg', factor: 0.001 },
  { pattern: /(\d+(?:\.\d+)?)\s*iu/i, unit: 'IU' },
  { pattern: /(\d+(?:\.\d+)?)\s*u\b/i, unit: 'U' }
];

/**
 * 解析剂量字符串
 */
function parseDosage(dosageStr: string): { value: number; unit: string; mgEquivalent?: number } | null {
  for (const { pattern, unit, factor } of DOSAGE_PATTERNS) {
    const match = dosageStr.match(pattern);
    if (match) {
      let value = parseFloat(match[1]);
      return { 
        value, 
        unit, 
        mgEquivalent: factor ? value * factor : value 
      };
    }
  }
  return null;
}

/**
 * 验证患者参数范围
 */
function validatePatientParams(params: {
  age?: number;
  eGFR?: number;
  child_pugh?: string;
}): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (params.age !== undefined) {
    if (params.age < 0 || params.age > 120) {
      errors.push(`无效的年龄值: ${params.age} (应在0-120之间)`);
    } else if (params.age > 100) {
      warnings.push(`年龄 ${params.age} 岁属于极高龄`);
    }
  }
  
  if (params.eGFR !== undefined) {
    if (params.eGFR < 0 || params.eGFR > 200) {
      errors.push(`无效的eGFR值: ${params.eGFR} (应在0-200之间)`);
    } else if (params.eGFR < 30) {
      warnings.push(`eGFR ${params.eGFR} 表示严重肾功能不全`);
    }
  }
  
  if (params.child_pugh && !['A', 'B', 'C'].includes(params.child_pugh)) {
    errors.push(`无效的Child-Pugh分级: ${params.child_pugh} (应为A/B/C)`);
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 输入整洁工具
 */
export const inputSanitizerTool = tool({
  name: 'sanitize_medical_input',
  description: '标准化和验证医学输入：药物名称、患者参数',
  parameters: {
    type: 'object',
    properties: {
      medications: {
        type: 'array',
        items: { type: 'string' },
        description: '药物名称列表'
      },
      patient_params: {
        type: 'object',
        properties: {
          age: { type: 'number' },
          eGFR: { type: 'number' },
          child_pugh: { type: 'string' }
        },
        description: '患者参数'
      }
    },
    required: ['medications']
  },
  handler: async ({ medications, patient_params }) => {
    console.log(`[Input Sanitizer] Processing ${medications.length} medications`);
    
    // 标准化药物名称
    const normalizedMeds: Array<{
      original: string;
      standard: string;
      drugbank_id: string;
      category: string;
      warning?: string;
    }> = [];
    const unknownMeds: string[] = [];
    
    for (const med of medications) {
      const validation = validateDrugName(med);
      if (validation.valid && validation.normalized) {
        const normalized = normalizeDrugName(validation.normalized);
        normalizedMeds.push({
          original: med,
          standard: validation.normalized,
          drugbank_id: normalized?.drugbank_id || 'UNKNOWN',
          category: normalized?.category || 'Unknown',
          warning: validation.warning
        });
      } else {
        unknownMeds.push(med);
      }
    }
    
    // 验证患者参数
    const paramValidation = patient_params 
      ? validatePatientParams(patient_params)
      : { valid: true, errors: [], warnings: [] };
    
    // 构建结果
    const warnings: string[] = [];
    if (unknownMeds.length > 0) {
      warnings.push(`未识别的药物: ${unknownMeds.join(', ')}`);
    }
    warnings.push(...normalizedMeds.filter(m => m.warning).map(m => m.warning!));
    warnings.push(...paramValidation.warnings);
    
    const hasErrors = unknownMeds.length > 0 || !paramValidation.valid;
    
    return {
      success: !hasErrors,
      normalized_medications: normalizedMeds.map(m => ({
        name: m.standard,
        drugbank_id: m.drugbank_id,
        category: m.category
      })),
      unknown_medications: unknownMeds,
      patient_validation: paramValidation.valid ? 'valid' : 'invalid',
      errors: paramValidation.errors,
      warnings,
      drugbank_ids: normalizedMeds.map(m => m.drugbank_id).filter(id => id !== 'UNKNOWN')
    };
  }
});

/**
 * 快速药物查询工具
 */
export const quickLookupTool = tool({
  name: 'lookup_drug',
  description: '快速查询药物的标准名称和DrugBank ID',
  parameters: {
    type: 'object',
    properties: {
      drug_name: { type: 'string', description: '药物名称' }
    },
    required: ['drug_name']
  },
  handler: async ({ drug_name }) => {
    const result = normalizeDrugName(drug_name);
    
    if (result) {
      return {
        found: true,
        standard_name: result.standard,
        drugbank_id: result.drugbank_id,
        category: result.category
      };
    }
    
    // 模糊搜索
    const lowerName = drug_name.toLowerCase();
    const suggestions = Object.entries(STANDARD_DRUG_NAMES)
      .filter(([key]) => key.includes(lowerName))
      .slice(0, 5)
      .map(([, value]) => value.standard);
    
    return {
      found: false,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }
});

export const sanitizerTools = [inputSanitizerTool, quickLookupTool];