/**
 * Therapeutic Alternatives Tool - 治疗替代品查询
 * 
 * 查找同治疗类别的替代药物，用于处理药物过敏、禁忌或相互作用情况
 */

import { tool } from '@earendil-works/pi-agent-core';

/**
 * 替代药物信息
 */
export interface TherapeuticAlternative {
  drugbank_id: string;
  name: string;
  therapeutic_category: string;
  mechanism: string;
  route?: string;
  common_dosage?: string;
  contraindications?: string[];
  interaction_risk?: 'low' | 'moderate' | 'high';
}

/**
 * 替代品查询结果
 */
export interface AlternativesResult {
  original_drug: string;
  alternatives: TherapeuticAlternative[];
  match_count: number;
}

/**
 * 治疗替代品映射数据（基于DrugBank分类）
 */
const therapeuticAlternativesMap: Record<string, TherapeuticAlternative[]> = {
  // 华法林替代品（抗凝药）
  'DB00682': [
    {
      drugbank_id: 'DB00288',
      name: 'Apixaban (阿哌沙班)',
      therapeutic_category: 'Direct Factor Xa Inhibitor',
      mechanism: '直接抑制FXa酶，不需要定期监测INR',
      route: '口服',
      common_dosage: '5mg每日两次',
      contraindications: ['活动性出血', '严重肝病'],
      interaction_risk: 'low'
    },
    {
      drugbank_id: 'DB01295',
      name: 'Rivaroxaban (利伐沙班)',
      therapeutic_category: 'Direct Factor Xa Inhibitor',
      mechanism: '直接抑制FXa酶，口服方便',
      route: '口服',
      common_dosage: '20mg每日一次',
      contraindications: ['活动性出血', '机械心脏瓣膜'],
      interaction_risk: 'low'
    },
    {
      drugbank_id: 'DB06268',
      name: 'Dabigatran (达比加群)',
      therapeutic_category: 'Direct Thrombin Inhibitor',
      mechanism: '直接抑制凝血酶',
      route: '口服',
      common_dosage: '150mg每日两次',
      contraindications: ['活动性出血', '严重肾功能不全'],
      interaction_risk: 'moderate'
    }
  ],
  // 氯吡格雷替代品（抗血小板药）
  'DB01109': [
    {
      drugbank_id: 'DB01242',
      name: 'Prasugrel (普拉格雷)',
      therapeutic_category: 'P2Y12 Receptor Antagonist',
      mechanism: 'P2Y12受体拮抗剂，起效更快',
      route: '口服',
      common_dosage: '10mg每日一次',
      contraindications: ['既往卒中/TIA', '活动性出血'],
      interaction_risk: 'low'
    },
    {
      drugbank_id: 'DB09136',
      name: 'Ticagrelor (替格瑞洛)',
      therapeutic_category: 'P2Y12 Receptor Antagonist',
      mechanism: '可逆性P2Y12受体拮抗剂',
      route: '口服',
      common_dosage: '90mg每日两次',
      contraindications: ['活动性出血', '颅内出血史'],
      interaction_risk: 'moderate'
    },
    {
      drugbank_id: 'DB00945',
      name: 'Aspirin (阿司匹林)',
      therapeutic_category: 'Antiplatelet Agent',
      mechanism: '不可逆抑制COX-1',
      route: '口服',
      common_dosage: '81-325mg每日一次',
      contraindications: ['活动性出血', '阿司匹林哮喘'],
      interaction_risk: 'moderate'
    }
  ],
  // 奥美拉唑替代品（PPI）
  'DB00338': [
    {
      drugbank_id: 'DBDB00267',
      name: 'Pantoprazole (泮托拉唑)',
      therapeutic_category: 'Proton Pump Inhibitor',
      mechanism: '抑制H+/K+-ATP酶',
      route: '口服/静脉',
      common_dosage: '40mg每日一次',
      contraindications: ['已知对PPI过敏'],
      interaction_risk: 'low'
    },
    {
      drugbank_id: 'DBDB00305',
      name: 'Esomeprazole (艾司奥美拉唑)',
      therapeutic_category: 'Proton Pump Inhibitor',
      mechanism: '抑制H+/K+-ATP酶（S-奥美拉唑）',
      route: '口��/静脉',
      common_dosage: '20-40mg每日一次',
      contraindications: ['已知对PPI过敏'],
      interaction_risk: 'low'
    },
    {
      drugbank_id: 'DBDB00309',
      name: 'Rabeprazole (雷贝拉唑)',
      therapeutic_category: 'Proton Pump Inhibitor',
      mechanism: '抑制H+/K+-ATP酶',
      route: '口服',
      common_dosage: '20mg每日一次',
      contraindications: ['已知对PPI过敏'],
      interaction_risk: 'low'
    }
  ],
  // 复方新诺明替代品（抗生素）
  'DB00338_SM': [
    {
      drugbank_id: 'DBDB00605',
      name: 'Nitrofurantoin (呋喃妥因)',
      therapeutic_category: 'Antibacterial',
      mechanism: '干扰细菌DNA和蛋白质合成',
      route: '口服',
      common_dosage: '50-100mg每日三次',
      contraindications: ['妊娠晚期', '严重肾功能不全'],
      interaction_risk: 'low'
    },
    {
      drugbank_id: 'DBDB00494',
      name: 'Fosfomycin (磷霉素)',
      therapeutic_category: 'Antibacterial',
      mechanism: '抑制细菌细胞壁合成',
      route: '口服',
      common_dosage: '3g单次给药',
      contraindications: ['已知对本药过敏'],
      interaction_risk: 'very_low'
    },
    {
      drugbank_id: 'DBDB01571',
      name: 'Ciprofloxacin (环丙沙星)',
      therapeutic_category: 'Quinolone Antibacterial',
      mechanism: '抑制DNA旋转酶',
      route: '口服/静脉',
      common_dosage: '250-500mg每日两次',
      contraindications: ['对喹诺酮类过敏', '妊娠期'],
      interaction_risk: 'moderate'
    }
  ]
};

/**
 * 根据DrugBank ID获取替代品
 */
async function getAlternativesFromDrugBank(drugId: string): Promise<TherapeuticAlternative[]> {
  const apiKey = process.env.DRUGBANK_API_KEY;
  
  if (!apiKey) {
    return therapeuticAlternativesMap[drugId] || [];
  }

  try {
    const baseUrl = process.env.DRUGBANK_API_BASE || 'https://api.drugbank.com/v1';
    const response = await fetch(`${baseUrl}/drugs/${drugId}/therapeutic_alternatives`, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`DrugBank API error: ${response.status}`);
    }

    const data = await response.json();
    return data.alternatives || [];
  } catch (error) {
    console.error('[Alternatives Tool] API call failed:', error);
    return therapeuticAlternativesMap[drugId] || [];
  }
}

/**
 * 治疗替代品查询工具
 */
export const alternativesTool = tool({
  name: 'find_therapeutic_alternatives',
  description: '查找同治疗类别的替代药物，用于处理药物过敏、禁忌或相互作用情况',
  parameters: {
    type: 'object',
    properties: {
      drug_id: { type: 'string', description: 'DrugBank ID或药物名称' },
      include_details: {
        type: 'boolean',
        default: false,
        description: '是否包含详细药物信息'
      },
      exclude_interacting_drug: {
        type: 'string',
        description: '需要排除的相互作用药物（可选）'
      }
    },
    required: ['drug_id']
  },
  handler: async ({ drug_id, include_details = false, exclude_interacting_drug }) => {
    console.log(`[Alternatives Tool] Finding alternatives for: ${drug_id}`);
    
    let alternatives = await getAlternativesFromDrugBank(drug_id);
    
    // 如果没有找到替代品，尝试通过药物名称查找
    if (alternatives.length === 0) {
      const nameKey = Object.keys(therapeuticAlternativesMap).find(k => 
        k.toLowerCase() === drug_id.toLowerCase()
      );
      if (nameKey) {
        alternatives = therapeuticAlternativesMap[nameKey];
      }
    }

    // 如果指定了要排除的相互作用的药物，过滤掉有相互作用的替代品
    if (exclude_interacting_drug && alternatives.length > 0) {
      // 需要调用DDI API来验证排除，这里简化处理
      const filteredAlternatives = alternatives.filter(alt => {
        // 这里的逻辑可以后续完善
        return alt.interaction_risk !== 'high';
      });
      alternatives = filteredAlternatives;
    }

    return {
      original_drug: drug_id,
      alternatives,
      match_count: alternatives.length
    };
  }
});

/**
 * 按治疗类别查找药物
 */
export const categorySearchTool = tool({
  name: 'search_by_category',
  description: '按治疗类别查找药物',
  parameters: {
    type: 'object',
    properties: {
      therapeutic_category: { type: 'string', description: '治疗类别（如：Anticoagulant, Antiplatelet）' },
      max_results: {
        type: 'number',
        default: 5,
        description: '最大返回数量'
      }
    },
    required: ['therapeutic_category']
  },
  handler: async ({ therapeutic_category, max_results = 5 }) => {
    console.log(`[Category Tool] Searching for category: ${therapeutic_category}`);
    
    const categoryMap: Record<string, string[]> = {
      'Anticoagulant': ['DB00682', 'DB00288', 'DB01295', 'DB06268'],  // Warfarin, Apixaban, Rivaroxaban, Dabigatran
      'Antiplatelet': ['DB01109', 'DB01242', 'DB09136', 'DB00945'],  // Clopidogrel, Prasugrel, Ticagrelor, Aspirin
      'PPI': ['DB00338', 'DB00267', 'DB00305', 'DB00309'],  // Omeprazole, Pantoprazole, Esomeprazole, Rabeprazole
      'Antibiotic': ['DB00338_SM', 'DB00605', 'DB00494', 'DB01571']  // SMX/TMP, Nitrofurantoin, Fosfomycin, Ciprofloxacin
    };

    const drugIds = categoryMap[therapeutic_category] || [];
    return {
      category: therapeutic_category,
      drug_ids: drugIds.slice(0, max_results),
      count: drugIds.length
    };
  }
});

export const therapeuticTools = [
  alternativesTool,
  categorySearchTool
];