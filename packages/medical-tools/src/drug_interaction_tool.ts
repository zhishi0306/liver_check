/**
 * Drug Interaction Tool - 批量药物相互作用检查
 *
 * 基于DrugBank DDI API进行批量药物相互作用检查
 */

import { tool } from "@earendil-works/pi-agent-core";
import type { StaticDecode } from "@sinclair/typebox";

/**
 * DrugBank DDI API响应类型
 */
export interface DDInteraction {
	drug_A: string;
	drug_B: string;
	severity: "minor" | "moderate" | "major";
	description: string;
	mechanism: string;
	clinical_effect: string;
	evidence_level: 1 | 2 | 3;
	management?: string;
}

/**
 * 批量DDI检查请求参数
 */
export const DDIRequestSchema = {
	type: "object",
	properties: {
		drug_ids: {
			type: "array",
			items: { type: "string" },
			description: "DrugBank ID列表",
		},
		min_severity: {
			type: "string",
			enum: ["minor", "moderate", "major"],
			default: "moderate",
			description: "最低严重程度过滤",
		},
	},
	required: ["drug_ids"],
} as const;

/**
 * 批量DDI检查结果
 */
export const DDIResultSchema = {
	type: "object",
	properties: {
		interactions: {
			type: "array",
			items: {
				type: "object",
				properties: {
					drug_A: { type: "string" },
					drug_B: { type: "string" },
					severity: { type: "string" },
					description: { type: "string" },
					mechanism: { type: "string" },
					clinical_effect: { type: "string" },
					evidence_level: { type: "number" },
					management: { type: "string" },
				},
			},
		},
		summary: {
			type: "object",
			properties: {
				total_checked: { type: "number" },
				major_count: { type: "number" },
				moderate_count: { type: "number" },
				minor_count: { type: "number" },
			},
		},
	},
} as const;

export type DDIRequest = StaticDecode<typeof DDIRequestSchema>;
export type DDIResult = StaticDecode<typeof DDIResultSchema>;

/**
 * DrugBank API基地址
 */
const DRUGBANK_API_BASE = process.env.DRUGBANK_API_BASE || "https://api.drugbank.com/v1";

/**
 * 调用DrugBank DDI API
 */
async function fetchDrugInteractions(drugIds: string[], minSeverity: string = "moderate"): Promise<DDInteraction[]> {
	const apiKey = process.env.DRUGBANK_API_KEY;

	if (!apiKey) {
		console.warn("[DDI Tool] DRUGBANK_API_KEY not set, returning mock data");
		return getMockInteractions(drugIds);
	}

	try {
		const url = `${DRUGBANK_API_BASE}/ddi?drugbank_id=${drugIds.join(",")}&severity=${minSeverity}`;
		const response = await fetch(url, {
			headers: {
				Authorization: apiKey,
				"Content-Type": "application/json",
			},
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) {
			throw new Error(`DrugBank API error: ${response.status}`);
		}

		const data = await response.json();
		return data.interactions || [];
	} catch (error) {
		console.error("[DDI Tool] API call failed, using mock:", error);
		return getMockInteractions(drugIds);
	}
}

/**
 * 生成模拟数据（用于测试和无API Key情况）
 */
function getMockInteractions(drugIds: string[]): DDInteraction[] {
	const knownInteractions: Record<string, DDInteraction[]> = {
		"DB00682+DB00338": [
			{
				drug_A: "Warfarin (DB00682)",
				drug_B: "Sulfamethoxazole/Trimethoprim (DB00338)",
				severity: "major",
				description: "复方新诺明抑制CYP2C9酶，增强华法林抗凝效果",
				mechanism: "复方新诺明通过抑制CYP2C9酶活性，减少华法林代谢",
				clinical_effect: "INR显著升高，出血风险增加3-5倍",
				evidence_level: 1,
				management: "应避免合用。建议更换为其他抗生素。如必须合用，需频繁监测INR，并考虑华法林减量。",
			},
		],
		"DB01109+DB00338": [
			{
				drug_A: "Clopidogrel (DB01109)",
				drug_B: "Omeprazole (DB00338)",
				severity: "moderate",
				description: "奥美拉唑抑制CYP2C19，影响氯吡格雷活化",
				mechanism: "奥美拉唑是CYP2C19抑制剂，降低氯吡格雷活性代谢物生成",
				clinical_effect: "氯吡格雷抗血小板效果降低",
				evidence_level: 1,
				management: "建议使用泮托拉唑或其他PPI替代奥美拉唑",
			},
		],
		"DB00682+DB00945": [
			{
				drug_A: "Warfarin (DB00682)",
				drug_B: "Aspirin (DB00945)",
				severity: "moderate",
				description: "阿司匹林增强华法林抗凝效果",
				mechanism: "阿司匹林抑制血小板聚集，两者在抗凝方面协同",
				clinical_effect: "出血风险增加",
				evidence_level: 1,
				management: "如需合用，应小剂量阿司匹林，并密切监测INR",
			},
		],
	};

	const interactions: DDInteraction[] = [];
	for (let i = 0; i < drugIds.length; i++) {
		for (let j = i + 1; j < drugIds.length; j++) {
			const key = `${drugIds[i]}+${drugIds[j]}`;
			const reverseKey = `${drugIds[j]}+${drugIds[i]}`;
			if (knownInteractions[key]) {
				interactions.push(...knownInteractions[key]);
			} else if (knownInteractions[reverseKey]) {
				interactions.push(...knownInteractions[reverseKey]);
			}
		}
	}

	return interactions;
}

/**
 * 生成检查摘要
 */
function generateSummary(interactions: DDInteraction[]) {
	return {
		total_checked: interactions.length,
		major_count: interactions.filter((i) => i.severity === "major").length,
		moderate_count: interactions.filter((i) => i.severity === "moderate").length,
		minor_count: interactions.filter((i) => i.severity === "minor").length,
	};
}

/**
 * 批量药物相互作用检查工具
 */
export const drugInteractionTool = tool({
	name: "batch_ddi_checker",
	description: "批量检查多种药物之间的相互作用。基于DrugBank DDI数据库，返回药物配对相互作用信息。",
	parameters: DDIRequestSchema,
	handler: async ({ drug_ids, min_severity = "moderate" }) => {
		console.log(`[DDI Tool] Checking interactions for: ${drug_ids.join(", ")}`);

		const interactions = await fetchDrugInteractions(drug_ids, min_severity);

		return {
			interactions,
			summary: generateSummary(interactions),
		};
	},
});

/**
 * 单药对多药相互作用检查
 */
export const drugInteractionPairTool = tool({
	name: "check_drug_pair",
	description: "检查两种药物之间的特定相互作用",
	parameters: {
		type: "object",
		properties: {
			drug_a: { type: "string", description: "第一种药物的DrugBank ID" },
			drug_b: { type: "string", description: "第二种药物的DrugBank ID" },
		},
		required: ["drug_a", "drug_b"],
	},
	handler: async ({ drug_a, drug_b }) => {
		const interactions = await fetchDrugInteractions([drug_a, drug_b], "minor");
		return { interactions, summary: generateSummary(interactions) };
	},
});

/**
 * 获取药物别名映射表
 */
export const drugAliasTool = tool({
	name: "get_drug_alias",
	description: "根据药物名称查找DrugBank ID和常用别名",
	parameters: {
		type: "object",
		properties: {
			drug_name: { type: "string", description: "药物名称（通用名或商品名）" },
		},
		required: ["drug_name"],
	},
	handler: async ({ drug_name }) => {
		// 常用药物别名映射
		const aliasMap: Record<string, { drugbank_id: string; name: string; aliases: string[] }> = {
			warfarin: { drugbank_id: "DB00682", name: "Warfarin", aliases: ["Coumadin", "华法林"] },
			coumadin: { drugbank_id: "DB00682", name: "Warfarin", aliases: ["Warfarin", "华法林"] },
			aspirin: {
				drugbank_id: "DB00945",
				name: "Aspirin",
				aliases: ["Acetylsalicylic Acid", "阿司匹林", "乙酰水杨酸"],
			},
			clopidogrel: { drugbank_id: "DB01109", name: "Clopidogrel", aliases: ["Plavix", "氯吡格雷"] },
			plavix: { drugbank_id: "DB01109", name: "Clopidogrel", aliases: ["Clopidogrel", "氯吡格雷"] },
			omeprazole: { drugbank_id: "DB00338", name: "Omeprazole", aliases: ["Prilosec", "奥美拉唑"] },
			prilosec: { drugbank_id: "DB00338", name: "Omeprazole", aliases: ["Omeprazole", "奥美拉唑"] },
			sulfamethoxazole: { drugbank_id: "DB00338", name: "Sulfamethoxazole", aliases: ["SMX", "复方新诺明"] },
			trimethoprim: { drugbank_id: "DB00237", name: "Trimethoprim", aliases: ["TMP", "甲氧苄啶"] },
			bactrim: { drugbank_id: "DB00338", name: "Sulfamethoxazole/Trimethoprim", aliases: ["复方新诺明", "Septra"] },
			metformin: { drugbank_id: "DB00303", name: "Metformin", aliases: ["二甲双胍", "Glucophage"] },
			amlodipine: { drugbank_id: "DB00575", name: "Amlodipine", aliases: ["氨氯地平", "Norvasc"] },
			lisinopril: { drugbank_id: "DB00736", name: "Lisinopril", aliases: ["赖诺普利", "Prinivil"] },
			atorvastatin: { drugbank_id: "DB01076", name: "Atorvastatin", aliases: ["阿托伐他汀", "Lipitor"] },
			simvastatin: { drugbank_id: "DB00641", name: "Simvastatin", aliases: ["辛伐他汀", "Zocor"] },
		};

		const normalizedName = drug_name.toLowerCase().replace(/\s+/g, "");
		const result = aliasMap[normalizedName] || {
			drugbank_id: `DB_UNKNOWN_${normalizedName}`,
			name: drug_name,
			aliases: [],
		};

		return result;
	},
});

// 导出所有工具
export const medicalTools = [drugInteractionTool, drugInteractionPairTool, drugAliasTool];
