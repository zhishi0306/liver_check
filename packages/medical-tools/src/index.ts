/**
 * Medical Tools Package - 用药安全智能Agent工具集
 * 
 * 提供药物相互作用检查、治疗替代品查询、患者约束过滤等功能
 */

// 药物相互作用工具
export {
  drugInteractionTool,
  drugInteractionPairTool,
  drugAliasTool,
  medicalTools,
  type DDInteraction,
  type DDIRequest,
  type DDIResult
} from './drug_interaction_tool';

// 治疗替代品工具
export {
  alternativesTool,
  categorySearchTool,
  therapeuticTools,
  type TherapeuticAlternative,
  type AlternativesResult
} from './therapeutic_alternatives_tool';

// 患者约束过滤工具
export {
  patientFilterTool,
  quickFilterTool,
  filterTools,
  type PatientInfo,
  type DrugToFilter,
  type FilterResult,
  type ExcludedDrug
} from './patient_constraint_filter';

// Re-export all tools as combined array
import { medicalTools } from './drug_interaction_tool';
import { therapeuticTools } from './therapeutic_alternatives_tool';
import { filterTools } from './patient_constraint_filter';

/**
 * 所有医学工具的组合导出
 */
export const allMedicalTools = [
  ...medicalTools,
  ...therapeuticTools,
  ...filterTools
];