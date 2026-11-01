/**
 * Patient Constraint Filter Tool - 患者因素约束过滤器
 *
 * 根据患者年龄、肾功能(eGFR)、肝功能(Child-Pugh分级)等因素过滤药物推荐
 */

import { tool } from "@earendil-works/pi-agent-core";

/**
 * 患者信息输入
 */
export interface PatientInfo {
	age?: number; // 年龄（岁）
	eGFR?: number; // 估算肾小球滤过率 (mL/min/1.73m²)
	child_pugh?: "A" | "B" | "C"; // Child-Pugh肝功能分级
	pregnancy?: boolean; // 是否怀孕
	breastfeeding?: boolean; // 是否哺乳
	weight?: number; // 体重 (kg)
	allergy?: string[]; // 过敏药物列表
}

/**
 * 待过滤的药物信息
 */
export interface DrugToFilter {
	drugbank_id: string;
	name: string;
	therapeutic_category?: string;
	renal_clearance?: "low" | "medium" | "high";
	hepatic_metabolism?: "negligible" | "minimal" | "extensive";
	recommended_dosage?: string;
	contraindications?: string[];
	warnings?: string[];
}

/**
 * 过滤结果
 */
export interface FilterResult {
	original_count: number;
	filtered_count: number;
	excluded_drugs: ExcludedDrug[];
	filtered_drugs: DrugToFilter[];
	warnings: string[];
	recommendations: string[];
}

/**
 * 被排除的药物信息
 */
export interface ExcludedDrug {
	drug: DrugToFilter;
	reason: string;
	severity: "contraindicated" | "use_with_caution" | "adjust_dosage";
}

/**
 * 默认过滤阈值
 */
const DEFAULT_THRESHOLDS = {
	age_elderly: 75,
	age_pediatric: 18,
	egfr_severe: 30,
	egfr_moderate: 60,
	child_pugh_c: "C",
};

/**
 * 药物清除途径分类（简化版）
 * 实际应用中应该从DrugBank获取详细数据
 */
const DRUG_RENAL_CLEARANCE: Record<string, "low" | "medium" | "high"> = {
	// 经肾排泄为主的药物（高）
	DB00303: "high", // Metformin (二甲双胍)
	DB00575: "medium", // Amlodipine (氨氯地平)
	DB00237: "high", // Trimethoprim (甲氧苄啶)

	// 经肾排泄较少的药物（中/低）
	DB00682: "low", // Warfarin (华法林)
	DB01109: "low", // Clopidogrel (氯吡格雷)
	DB00338: "low", // Omeprazole (奥美拉唑)
};

const DRUG_HEPATIC_METABOLISM: Record<string, "negligible" | "minimal" | "extensive"> = {
	// 主要经肝脏代谢的药物
	DB00338: "extensive", // Omeprazole (奥美拉唑)
	DB01076: "extensive", // Atorvastatin (阿托伐他汀)
	DB00641: "extensive", // Simvastatin (辛伐他汀)
	DB01109: "extensive", // Clopidogrel (氯吡格雷) - 需要CYP2C19活化

	// 主要经肾脏代谢的药物
	DB00303: "negligible", // Metformin (二甲双胍)
	DB00237: "negligible", // Trimethoprim (甲氧苄啶)

	// 两者都有
	DB00682: "minimal", // Warfarin (华法林)
};

/**
 * 检查药物是否需要调整剂量或避免使用
 */
function checkDrugContraindications(
	drug: DrugToFilter,
	patient: PatientInfo,
): {
	shouldExclude: boolean;
	reason: string;
	severity: "contraindicated" | "use_with_caution" | "adjust_dosage";
} | null {
	const _warnings: string[] = [];
	let shouldExclude = false;
	let reason = "";
	let severity: "contraindicated" | "use_with_caution" | "adjust_dosage" = "use_with_caution";

	// 检查年龄
	if (patient.age !== undefined) {
		if (patient.age > DEFAULT_THRESHOLDS.age_elderly) {
			// 老年人（>75岁）
			const _anticoagulants = ["Anticoagulant", "Direct Factor Xa Inhibitor"];
			if (drug.therapeutic_category?.some((cat) => anticoagANTS.includes(cat))) {
				shouldExclude = true;
				reason = "老年患者（>75岁）使用抗凝药出血风险增高";
				severity = "use_with_caution";
			}

			// 老年���避免使用某些镇静催眠药
			if (drug.warnings?.includes("elderly_sensitivity")) {
				shouldExclude = true;
				reason = "老年人对中枢神经系统作用敏感";
				severity = "use_with_caution";
			}
		}

		if (patient.age < DEFAULT_THRESHOLDS.age_pediatric) {
			// 儿童（<18岁）- 这里简化处理，实际需要更详细分类
			if (drug.warnings?.includes("not_for_children")) {
				shouldExclude = true;
				reason = "该药物不适用于儿童";
				severity = "contraindicated";
			}
		}
	}

	// 检查肾功能 (eGFR)
	if (patient.eGFR !== undefined) {
		const renalClearance = drug.renal_clearance || DRUG_RENAL_CLEARANCE[drug.drugbank_id] || "medium";

		if (patient.eGFR < DEFAULT_THRESHOLDS.egfr_severe) {
			// eGFR < 30，严重肾功能不全
			if (renalClearance === "high") {
				shouldExclude = true;
				reason = `严重肾功能不全（eGFR=${patient.eGFR}）应避免使用经肾排泄的药物`;
				severity = "contraindicated";
			} else if (renalClearance === "medium") {
				reason = `中度肾功能不全（eGFR=${patient.eGFR}）需调整剂量`;
				severity = "adjust_dosage";
			}
		} else if (patient.eGFR < DEFAULT_THRESHOLDS.egfr_moderate) {
			// eGFR 30-60，中度肾功能不全
			if (renalClearance === "high") {
				reason = `轻中度肾功能不全（eGFR=${patient.eGFR}）可能需要调整剂量`;
				severity = "adjust_dosage";
			}
		}
	}

	// 检查肝功能 (Child-Pugh)
	if (patient.child_pugh !== undefined) {
		const hepaticMetabolism = drug.hepatic_metabolism || DRUG_HEPATIC_METABOLISM[drug.drugbank_id] || "minimal";

		if (patient.child_pugh === "C") {
			// 严重肝功能不全
			if (hepaticMetabolism === "extensive") {
				shouldExclude = true;
				reason = `严重肝功能不全（Child-Pugh C级）应避免使用经肝代谢的药物`;
				severity = "contraindicated";
			}
		} else if (patient.child_pugh === "B") {
			// 中度肝功能不全
			if (hepaticMetabolism === "extensive") {
				reason = `中度肝功能不全（Child-Pugh B级）需谨慎使用并调整剂量`;
				severity = "adjust_dosage";
			}
		}
	}

	// 检查过敏
	if (patient.allergy && patient.allergy.length > 0) {
		const drugAllergies = drug.name.toLowerCase();
		for (const aller of patient.allergy) {
			if (drugAllergies.includes(aller.toLowerCase())) {
				shouldExclude = true;
				reason = `患者对${aler}过敏`;
				severity = "contraindicated";
				break;
			}
		}
	}

	// 检查妊娠
	if (patient.pregnancy) {
		if (drug.contraindications?.includes("pregnancy")) {
			shouldExclude = true;
			reason = "该药物在妊娠期禁用";
			severity = "contraindicated";
		}
	}

	// 检查哺乳
	if (patient.breastfeeding) {
		if (drug.warnings?.includes("not_while_breastfeeding")) {
			shouldExclude = true;
			reason = "该药物在哺乳期禁用";
			severity = "contraindicated";
		}
	}

	if (shouldExclude || reason) {
		return { shouldExclude, reason, severity };
	}

	return null;
}

/**
 * 患者约束过滤器工具
 */
export const patientFilterTool = tool({
	name: "apply_patient_constraints",
	description: "根据患者年龄/肾功能/肝功能过滤药物推荐",
	parameters: {
		type: "object",
		properties: {
			drugs: {
				type: "array",
				items: {
					type: "object",
					properties: {
						drugbank_id: { type: "string" },
						name: { type: "string" },
						therapeutic_category: { type: "string" },
						renal_clearance: { type: "string", enum: ["low", "medium", "high"] },
						hepatic_metabolism: { type: "string", enum: ["negligible", "minimal", "extensive"] },
					},
				},
				description: "待过滤的药物列表",
			},
			patient: {
				type: "object",
				properties: {
					age: { type: "number", description: "患者年龄（岁）" },
					eGFR: { type: "number", description: "估算肾小球滤过率" },
					child_pugh: { type: "string", enum: ["A", "B", "C"], description: "Child-Pugh分级" },
					pregnancy: { type: "boolean", description: "是否怀孕" },
					breastfeeding: { type: "boolean", description: "是否哺乳" },
					allergy: { type: "array", items: { type: "string" }, description: "过敏药物" },
				},
				description: "患者信息",
			},
		},
		required: ["drugs", "patient"],
	},
	handler: async ({ drugs, patient }) => {
		console.log(`[Patient Filter] Filtering ${drugs.length} drugs for patient:`, patient);

		const excludedDrugs: ExcludedDrug[] = [];
		const filteredDrugs: DrugToFilter[] = [];
		const warnings: string[] = [];
		const recommendations: string[] = [];

		// 生成患者相关警告
		if (patient.age !== undefined) {
			if (patient.age > DEFAULT_THRESHOLDS.age_elderly) {
				warnings.push(`⚠️ 老年患者（${patient.age}岁）：注意跌倒和出血风险`);
			}
		}
		if (patient.eGFR !== undefined) {
			if (patient.eGFR < DEFAULT_THRESHOLDS.egfr_severe) {
				warnings.push(`⚠️ 严重肾功能不全（eGFR=${patient.eGFR}）：避免使用经肾排泄的药物`);
			} else if (patient.eGFR < DEFAULT_THRESHOLDS.egfr_moderate) {
				warnings.push(`ℹ️ 轻中度肾功能不全（eGFR=${patient.eGFR}）：可能需要调整剂量`);
			}
		}
		if (patient.child_pugh !== undefined) {
			if (patient.child_pugh === "C") {
				warnings.push(`⚠️ 严重肝功能不全（Child-Pugh C级）：避免使用经肝代谢的药物`);
			} else if (patient.child_pugh === "B") {
				warnings.push(`ℹ️ 中度肝功能不全（Child-Pugh B级）：谨慎使用`);
			}
		}

		// 逐个检查药物
		for (const drug of drugs) {
			const contraindication = checkDrugContraindications(drug, patient);

			if (contraindication?.shouldExclude) {
				excludedDrugs.push({
					drug,
					reason: contraindication.reason,
					severity: contraindication.severity,
				});
			} else {
				filteredDrugs.push(drug);

				// 添加剂量调整建议
				if (contraindication?.severity === "adjust_dosage") {
					recommendations.push(`${drug.name}: ${contraindication.reason}`);
				}
			}
		}

		// 生成总体建议
		if (excludedDrugs.some((e) => e.severity === "contraindicated")) {
			recommendations.unshift("⚠️ 注意：有禁忌药物需要替换");
		}

		const result: FilterResult = {
			original_count: drugs.length,
			filtered_count: filteredDrugs.length,
			excluded_drugs: excludedDrugs,
			filtered_drugs: filteredDrugs,
			warnings,
			recommendations,
		};

		console.log(`[Patient Filter] Result: ${filteredDrugs.length}/${drugs.length} drugs passed`);
		return result;
	},
});

/**
 * 快速检查单一药物是否符合患者条件
 */
export const quickFilterTool = tool({
	name: "check_drug_for_patient",
	description: "快速检查药物是否适合特定患者",
	parameters: {
		type: "object",
		properties: {
			drug: {
				type: "object",
				properties: {
					drugbank_id: { type: "string" },
					name: { type: "string" },
					therapeutic_category: { type: "string" },
				},
			},
			patient: {
				type: "object",
				properties: {
					age: { type: "number" },
					eGFR: { type: "number" },
					child_pugh: { type: "string", enum: ["A", "B", "C"] },
				},
			},
		},
		required: ["drug", "patient"],
	},
	handler: async ({ drug, patient }) => {
		const result = checkDrugContraindications(drug as DrugToFilter, patient);

		if (result?.shouldExclude) {
			return {
				suitable: false,
				reason: result.reason,
				severity: result.severity,
			};
		}

		return {
			suitable: true,
			reason: "该药物可以使用",
			severity: "normal",
		};
	},
});

export const filterTools = [patientFilterTool, quickFilterTool];
