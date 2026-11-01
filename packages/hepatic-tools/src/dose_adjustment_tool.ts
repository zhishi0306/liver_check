/**
 * Dose Adjustment Tool - Child-Pugh剂量调整
 *
 * 根据Child-Pugh分级输出药物的剂量调整建议
 * 核心功能：药物名称 + Child-Pugh分级 → 剂量建议
 */

import { tool } from "@earendil-works/pi-agent-core";
import knowledgeBase from "./knowledge_base.json";

// 药物类别映射（英文→中文）
const CATEGORY_MAP: Record<string, string> = {
	anticoagulant: "抗凝药",
	analgesic: "镇痛药",
	statin: "他汀类",
	antiviral_hbv: "抗乙肝病毒药",
	kinase_inhibitor: "酪氨酸激酶抑制剂",
	antituberculosis: "抗结核药",
	antifungal: "抗真菌药",
	antiepileptic: "抗癫痫药",
	beta_blocker: "β受体阻滞剂",
	antiviral_hiv: "抗HIV药",
	antiviral_covid: "抗新冠药",
	antiviral: "抗病毒药",
};

// 辅助函数：查找药物（支持中英文名称匹配）
function findDrug(drugName: string) {
	const lowerName = drugName.toLowerCase().trim();
	return knowledgeBase.drugs.find(
		(drug) =>
			drug.name.toLowerCase() === lowerName ||
			drug.name_cn === drugName ||
			drug.name.toLowerCase().includes(lowerName) ||
			lowerName.includes(drug.name.toLowerCase()),
	);
}

// 获取药物类别中文
function getCategoryCN(category: string): string {
	return CATEGORY_MAP[category] || category;
}

// 构建格式化输出
function formatOutput(data: any): string {
	const grade = data.child_pugh_grade;
	const gradeInfo = {
		A: { name: "轻度损害", score: "5-6分" },
		B: { name: "中度损害", score: "7-9分" },
		C: { name: "重度损害", score: "10-15分" },
	}[grade];

	const adjNote = data.adjustment_needed ? "需调整" : "无需调整";
	const warning =
		grade === "C" && data.recommended_dosage.includes("禁用") ? "\n⚠️ 警告：Child-Pugh C级患者禁用此药物\n" : "";

	return `╔══════════════════════════════════════════════════════════════╗
║ 肝病用药剂量调整建议
╚═══════════════════════════════════════════════════════════════

【药物】${data.drug_name} (${data.drug_name_cn})
【类别】${getCategoryCN(data.category)}
【Child-Pugh分级】${grade}级（${gradeInfo.name}，${gradeInfo.score}）

【常规剂量】${data.normal_dosage}
【建议剂量】${data.recommended_dosage}
【调整依据】${data.clinical_note}

【临床注意事项】
${data.additional_notes}

【处方调整参考】
原处方：${data.drug_name} ${data.normal_dosage}
建议调整：${adjNote}

${warning}📌 免责声明：建议仅供参考，最终用药决策需由临床医生根据患者具体情况确定。

【数据来源】${data.reference}`;
}

// Child-Pugh剂量调整工具
export const doseAdjustmentTool = tool({
	name: "child_pugh_dose_adjustment",
	description: "根据Child-Pugh分级查询肝病药物的剂量调整建议",
	parameters: {
		type: "object",
		properties: {
			drug_name: {
				type: "string",
				description: "药物名称（中英文均可）",
			},
			child_pugh_grade: {
				type: "string",
				enum: ["A", "B", "C"],
				description: "Child-Pugh分级：A=轻度(5-6分), B=中度(7-9分), C=重度(10-15分)",
			},
		},
		required: ["drug_name", "child_pugh_grade"],
	},
	handler: async ({ drug_name, child_pugh_grade }) => {
		const drug = findDrug(drug_name);

		if (!drug) {
			const notFoundMsg = `未找到药物"${drug_name}"的肝功能剂量数据，请参考药品说明书。`;
			return {
				found: false,
				drug_name: drug_name,
				message: notFoundMsg,
				suggestion: "本系统当前包含15个代表性药物的数据，未来将扩展到更多药物。",
				available_drugs: knowledgeBase.drugs.map((d) => `${d.name}(${d.name_cn})`).join(", "),
				disclaimer: "建议仅供参考，最终用药决策需由临床医生根据患者具体情况确定。",
			};
		}

		const gradeKey = `child_pugh_${child_pugh_grade.toLowerCase()}` as keyof typeof drug;
		const recommendation = drug[gradeKey] as any;

		const result = {
			found: true,
			drug_name: drug.name,
			drug_name_cn: drug.name_cn,
			category: drug.category,
			child_pugh_grade: child_pugh_grade,
			normal_dosage: drug.dosage_normal,
			recommended_dosage: recommendation.recommendation,
			adjustment_needed: recommendation.adjustment_needed,
			clinical_note: recommendation.note,
			additional_notes: drug.clinical_notes,
			reference: drug.reference,
			disclaimer: "建议仅供参考，最终用药决策需由临床医生根据患者具体情况确定。",
		};

		// 返回结构化结果和格式化输出
		return {
			...result,
			formatted_output: formatOutput(result),
		};
	},
});

// 获取知识库摘要
export const knowledgeBaseSummaryTool = tool({
	name: "hepatic_knowledge_base_summary",
	description: "获取肝病用药知识库的摘要信息",
	parameters: {
		type: "object",
		properties: {},
		noRequired: true,
	},
	handler: async () => {
		const drugs = knowledgeBase.drugs;
		const categories = new Set(drugs.map((d) => d.category));

		return {
			total_drugs: drugs.length,
			categories: Array.from(categories).map((c) => ({
				code: c,
				name: getCategoryCN(c),
				count: drugs.filter((d) => d.category === c).length,
			})),
			drugs_list: drugs.map((d) => ({
				name: d.name,
				name_cn: d.name_cn,
				category: getCategoryCN(d.category),
			})),
			last_updated: "2024-06-06",
			note: "数据来源：FDA Label / 临床药理学 / LiverTox",
		};
	},
});

// 查询特定类别药物
export const drugsByCategoryTool = tool({
	name: "hepatic_drugs_by_category",
	description: "查询特定类别的肝病用药",
	parameters: {
		type: "object",
		properties: {
			category: {
				type: "string",
				description: "药物类别（英文）",
			},
		},
		required: ["category"],
	},
	handler: async ({ category }) => {
		const drugs = knowledgeBase.drugs.filter((d) => d.category.toLowerCase() === category.toLowerCase());

		if (drugs.length === 0) {
			return {
				found: false,
				category: category,
				message: `未找到类别"${category}"的药物`,
				available_categories: Array.from(new Set(knowledgeBase.drugs.map((d) => d.category))),
			};
		}

		return {
			found: true,
			category: category,
			category_name: getCategoryCN(category),
			drugs: drugs.map((d) => ({
				name: d.name,
				name_cn: d.name_cn,
				normal_dosage: d.dosage_normal,
			})),
		};
	},
});

export const doseAdjustmentTools = [doseAdjustmentTool, knowledgeBaseSummaryTool, drugsByCategoryTool];
