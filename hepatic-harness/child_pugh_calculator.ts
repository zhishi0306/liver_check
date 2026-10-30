/**
 * Child-Pugh Calculator - Child-Pugh评分计算器
 * 
 * 肝病患者的Child-Pugh分级计算和剂量调整建议
 */

import { tool } from '@earendil-works/pi-agent-core';

export interface ChildPughScoreResult {
  score: number;
  grade: 'A' | 'B' | 'C';
  grade_name: string;
  score_breakdown: {
    ascites: number;
    encephalopathy: number;
    bilirubin: number;
    albumin: number;
    prothrombin_time: number;
  };
  interpretation: string;
  dosage_recommendation: 'full_dose' | 'half_dose' | 'avoid';
}

/**
 * Child-Pugh评分标准（5项各1-3分）
 */
const SCORING = {
  ascites: { none: 1, mild: 2, moderate: 3 },
  encephalopathy: { none: 1, grade1_2: 2, grade3_4: 3 },
  bilirubin: { '<34': 1, '34-51': 2, '>51': 3 },
  albumin: { '>35': 1, '28-35': 2, '<28': 3 },
  pt_inr: { '<4': 1, '4-6': 2, '>6': 3 }
};

/**
 * 中文参数名称映射
 */
const PARAM_ZH: Record<string, Record<string, string>> = {
  ascites: { none: '无', mild: '轻度', moderate: '中重度' },
  encephalopathy: { none: '无', grade1_2: '1-2级', grade3_4: '3-4级' }
};

/**
 * 评分参数名称（数值转换）
 */
const getBilirubinScore = (value: number): number => {
  if (value < 34) return 1;
  if (value <= 51) return 2;
  return 3;
};

const getAlbuminScore = (value: number): number => {
  if (value > 35) return 1;
  if (value >= 28) return 2;
  return 3;
};

const getPTScore = (seconds: number): number => {
  if (seconds < 4) return 1;
  if (seconds <= 6) return 2;
  return 3;
};

/**
 * 计算Child-Pugh评分
 */
export function calculateChildPughScore(params: {
  ascites?: 'none' | 'mild' | 'moderate';
  encephalopathy?: 'none' | 'grade1_2' | 'grade3_4';
  bilirubin_umol?: number;
  albumin_g?: number;
  pt_seconds?: number;
}): ChildPughScoreResult {
  // 计算各项分数
  const ascitesScore = params.ascites ? SCORING.ascites[params.ascites] : 1;  // 默认为1
  const encScore = params.encephalopathy ? SCORING.encephalopathy[params.encephalopathy] : 1;
  const biliScore = params.bilirubin_umol ? getBilirubinScore(params.bilirubin_umol) : 1;
  const albScore = params.albumin_g ? getAlbuminScore(params.albumin_g) : 1;
  const ptScore = params.pt_seconds ? getPTScore(params.pt_seconds) : 1;
  
  const scores = {
    ascites: ascitesScore,
    encephalopathy: encScore,
    bilirubin: biliScore,
    albumin: albScore,
    prothrombin_time: ptScore
  };
  
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  
  // 确定分级
  let grade: 'A' | 'B' | 'C';
  let gradeName: string;
  let recommendation: 'full_dose' | 'half_dose' | 'avoid';
  let interp: string;
  
  if (totalScore <= 6) {
    grade = 'A';
    gradeName = '轻度肝功能损害';
    recommendation = 'full_dose';
    interp = 'Child-Pugh A级，肝功能代偿良好，多数药物可正常使用常规剂量';
  } else if (totalScore <= 9) {
    grade = 'B';
    gradeName = '中度肝功能损害';
    recommendation = 'half_dose';
    interp = 'Child-Pugh B级，肝功能部分失代偿，建议减量或选择安全性更高的药物';
  } else {
    grade = 'C';
    gradeName = '重度肝功能损害';
    recommendation = 'avoid';
    interp = 'Child-Pugh C级，肝功能失代偿，应避免使用潜在肝毒性药物';
  }
  
  return {
    score: totalScore,
    grade,
    grade_name: gradeName,
    score_breakdown: scores,
    interpretation: interp,
    dosage_recommendation: recommendation
  };
}

/**
 * 通过实验室指标直接计算的简化版
 */
export function calculateFromLabValues(
  bilirubin: number,
  albumin: number,
  pt_seconds: number
): ChildPughScoreResult {
  return calculateChildPughScore({
    bilirubin_umol: bilirubin,
    albumin_g: albumin,
    pt_seconds: pt_seconds
  });
}

/**
 * Child-Pugh评分计算工具（完整参数）
 */
export const childPughCalcTool = tool({
  name: 'calculate_child_pugh_full',
  description: '根据临床指标计算Child-Pugh评分（完整参数）',
  parameters: {
    type: 'object',
    properties: {
      ascites: { type: 'string', enum: ['none', 'mild', 'moderate'], description: '腹水程度' },
      encephalopathy: { type: 'string', enum: ['none', 'grade1_2', 'grade3_4'], description: '肝性脑病' },
      bilirubin_umol: { type: 'number', description: '血清胆红素（μmol/L）' },
      albumin_g: { type: 'number', description: '血清白蛋白（g/L）' },
      pt_seconds: { type: 'number', description: '凝血酶时间（秒）' }
    }
  },
  handler: async (params) => {
    return calculateChildPughScore(params);
  }
});

/**
 * Child-Pugh简化计算工具（仅实验室指标）
 */
export const childPughSimpleTool = tool({
  name: 'calculate_child_pugh_simple',
  description: '根据实验室指标计算Child-Pugh分级（简化版）',
  parameters: {
    type: 'object',
    properties: {
      bilirubin: { type: 'number', description: '血清胆红素（μmol/L）' },
      albumin: { type: 'number', description: '血清白蛋白（g/L）' },
      prothrombin_time: { type: 'number', description: '凝血酶时间延长（秒）' }
    },
    required: ['bilirubin', 'albumin']
  },
  handler: async ({ bilirubin, albumin, prothrombin_time }) => {
    return calculateFromLabValues(bilirubin, albumin, prothrombin_time);
  }
});

/**
 * 查询Child-Pugh分级对应的剂量建议
 */
export const childPughAdviceTool = tool({
  name: 'get_child_pugh_advice',
  description: '查询Child-Pugh各级别的用药建议',
  parameters: {
    type: 'object',
    properties: {
      grade: { type: 'string', enum: ['A', 'B', 'C'] }
    },
    required: ['grade']
  },
  handler: async ({ grade }) => {
    const advice: Record<string, {name: string; dose: string; note: string}> = {
      A: { name: '轻度', dose: '正常剂量', note: '多数药物可按正常剂量使用，定期监测肝功能' },
      B: { name: '中度', dose: '减量50%', note: '建议减量使用，选择肝毒性低的药物，每2周监测' },
      C: { name: '重度', dose: '避免使用', note: '禁止使用任何潜在肝毒性药物，只用必需药物' }
    };
    
    return {
      grade,
      ...advice[grade]
    };
  }
});

/**
 * 判断药物是否适用于特定Child-Pugh分级
 */
export const checkSuitabilityTool = tool({
  name: 'check_drug_suitability',
  description: '判断药物是否适用于特定Child-Pugh分级',
  parameters: {
    type: 'object',
    properties: {
      drug_name: { type: 'string', description: '药物名称' },
      drug_hepatotoxicity_rank: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'], description: '药物肝毒性等级' },
      target_grade: { type: 'string', enum: ['A', 'B', 'C'], description: '目标Child-Pugh分级' }
    },
    required: ['drug_name', 'drug_hepatotoxicity_rank', 'target_grade']
  },
  handler: async ({ drug_name, drug_hepatotoxicity_rank, target_grade }) => {
    let suitable = true;
    let reason = '';

    // A级肝毒性药物（高风险）在C级患者禁用
    if (drug_hepatotoxicity_rank === 'A' && target_grade === 'C') {
      suitable = false;
      reason = 'A级肝毒性药物在Child-Pugh C级患者禁用';
    } else if (drug_hepatotoxicity_rank === 'A' && target_grade === 'B') {
      suitable = false;
      reason = 'A级肝毒性药物在Child-Pugh B级患者不建议使用';
    } else if (drug_hepatotoxicity_rank === 'B' && target_grade === 'C') {
      suitable = false;
      reason = 'B级肝毒性药物在Child-Pugh C级患者需谨慎评估';
    } else {
      reason = `${drug_hepatotoxicity_rank}级肝毒性药物在Child-Pugh ${target_grade}级患者可以使用`;
    }
    
    return {
      drug_name,
      hepatotoxicity_rank: drug_hepatotoxicity_rank,
      target_grade,
      suitable,
      reason
    };
  }
});

export const childPughTools = [
  childPughCalcTool,
  childPughSimpleTool,
  childPughAdviceTool,
  checkSuitabilityTool
];