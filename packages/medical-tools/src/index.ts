/**
 * Medical Tools Package - 用药安全智能Agent工具集
 *
 * 提供药物相互作用检查、治疗替代品查询、患者约束过滤等功能
 */

// 药物相互作用工具
export {
	type DDInteraction,
	type DDIRequest,
	type DDIResult,
	drugAliasTool,
	drugInteractionPairTool,
	drugInteractionTool,
	medicalTools,
} from "./drug_interaction_tool";
// 患者约束过滤工具
export {
	type DrugToFilter,
	type ExcludedDrug,
	type FilterResult,
	filterTools,
	type PatientInfo,
	patientFilterTool,
	quickFilterTool,
} from "./patient_constraint_filter";
// 治疗替代品工具
export {
	type AlternativesResult,
	alternativesTool,
	categorySearchTool,
	type TherapeuticAlternative,
	therapeuticTools,
} from "./therapeutic_alternatives_tool";

// Re-export all tools as combined array
import { medicalTools } from "./drug_interaction_tool";
import { filterTools } from "./patient_constraint_filter";
import { therapeuticTools } from "./therapeutic_alternatives_tool";

/**
 * 所有医学工具的组合导出
 */
export const allMedicalTools = [...medicalTools, ...therapeuticTools, ...filterTools];
