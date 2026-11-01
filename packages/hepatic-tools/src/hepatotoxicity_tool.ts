/**
 * Hepatotoxicity Tool - LiverTox肝毒性查询
 *
 * 基于LiverTox数据库查询药物的肝毒性等级和临床特征
 */

import { tool } from "@earendil-works/pi-agent-core";

export interface HepatotoxicityResult {
	source: string;
	name: string;
	name_zh?: string;
	hepatotoxicity_rank: "A" | "B" | "C" | "D" | "E";
	rank_meaning: string;
	clinical_pattern?: string;
	typical_latency?: string;
	management?: string;
	case_reports?: number;
	DrugBank_id?: string;
	risk_level: "high" | "moderate" | "low" | "very_low" | "none";
}

// LiverTox API 地址
const LIVERTOX_API = "https://livertox.nlm.nih.gov/api/v1";

/**
 * 肝毒性等级含义
 */
const RANK_MEANINGS: Record<string, string> = {
	A: "高概率肝毒性（>50%病例相关）",
	B: "可能肝毒性（10-50%病例相关）",
	C: "疑似肝毒性（1-10%病例相关）",
	D: "罕见肝毒性（<1%病例相关）",
	E: "无明确肝毒性报告",
};

/**
 * 中英文药物名映射
 */
const DRUG_NAME_ZH: Record<string, string> = {
	acetaminophen: "对乙酰氨基酚",
	phenytoin: "苯妥英",
	isoniazid: "异烟肼",
	rifampicin: "利福平",
	methotrexate: "甲氨蝶呤",
	valproic_acid: "丙戊酸",
	tamoxifen: "他莫昔芬",
	amiodarone: "胺碘酮",
	flucloxacillin: "氟氯西林",
	nitrofurantoin: "呋喃妥因",
	minocycline: "米诺环素",
	ertac: "依曲康唑",
	ketoconazole: "酮康唑",
	azathioprine: "硫唑嘌呤",
	enecvir: "恩替卡韦",
	tenofovir: "替诺福韦",
	silymarin: "水飞蓟素",
	ursodeoxycholic_acid: "熊去氧胆酸",
	lamivudine: "拉米夫定",
	adefovir: "阿德福韦",
};

/**
 * 从LiverTox API查询肝毒性
 */
async function queryLiverTox(drugName: string): Promise<HepatotoxicityResult | null> {
	try {
		const url = `${LIVERTOX_API}/drugs?name=${encodeURIComponent(drugName)}`;
		const response = await fetch(url, {
			signal: AbortSignal.timeout(5000),
		});

		if (!response.ok) {
			console.warn("[Hepatotoxicity] LiverTox API error:", response.status);
			return null;
		}

		const data = await response.json();
		if (data.drugs && data.drugs.length > 0) {
			const drug = data.drugs[0];
			return {
				source: "LiverTox",
				name: drug.drugName,
				name_zh: DRUG_NAME_ZH[drug.drugName.toLowerCase()] || DRUG_NAME_ZH[drugName.toLowerCase()],
				hepatotoxicity_rank: drug.hepatotoxicity_rank as HepatotoxicityResult["hepatotoxicity_rank"],
				rank_meaning: RANK_MEANINGS[drug.hepatotoxicity_rank] || "未知",
				clinical_pattern: drug.clinical_pattern,
				typical_latency: drug.latency_days
					? `${drug.latency_days.min || 1}-${drug.latency_days.max || 30}天`
					: undefined,
				management: drug.management,
				case_reports: drug.case_reports_count || 0,
				risk_level: getRiskLevel(drug.hepatotoxicity_rank),
			};
		}
	} catch (error) {
		console.error("[Hepatotoxicity] LiverTox API error:", error);
	}
	return null;
}

/**
 * 根据肝毒性等级获取风险级别
 */
function getRiskLevel(rank: string): HepatotoxicityResult["risk_level"] {
	if (rank === "A") return "high";
	if (rank === "B") return "moderate";
	if (rank === "C") return "low";
	if (rank === "D") return "very_low";
	return "none";
}

/**
 * 查询本地知识库（Offline Fallback）
 */
function queryLocalKnowledgeBase(drugName: string): HepatotoxicityResult | null {
	const localData = LOCAL_KNOWLEDGE_BASE[drugName.toLowerCase()];
	if (localData) {
		return {
			source: "Local Knowledge Base",
			name: localData.name,
			name_zh: localData.name_zh,
			hepatotoxicity_rank: localData.rank as HepatotoxicityResult["hepatotoxicity_rank"],
			rank_meaning: RANK_MEANINGS[localData.rank],
			clinical_pattern: localData.pattern,
			management: localData.management,
			risk_level: getRiskLevel(localData.rank),
		};
	}
	return null;
}

/**
 * 本地肝毒性知识库（Offline Fallback）
 * 包含常见肝毒性药物信息
 */
const LOCAL_KNOWLEDGE_BASE: Record<
	string,
	{ name: string; name_zh: string; rank: string; pattern: string; management: string }
> = {
	acetaminophen: {
		name: "Acetaminophen",
		name_zh: "对乙酰氨基酚",
		rank: "A",
		pattern: "急性肝细胞损伤",
		management: "N-乙酰半胱氨酸（NAC）解毒，早期足量使用",
	},
	isoniazid: {
		name: "Isoniazid",
		name_zh: "异烟肼",
		rank: "A",
		pattern: "急性肝细胞损伤",
		management: "立即停药，NAC治疗，监测肝功能",
	},
	rifampicin: {
		name: "Rifampicin",
		name_zh: "利福平",
		rank: "A",
		pattern: "急性肝细胞损伤/胆汁淤积",
		management: "监测肝功能，避免与异烟肼合用",
	},
	methotrexate: {
		name: "Methotrexate",
		name_zh: "甲氨蝶呤",
		rank: "A",
		pattern: "慢性肝纤维化",
		management: "长期监测，避免用于严重肝病患者",
	},
	valproic_acid: {
		name: "Valproic Acid",
		name_zh: "丙戊酸",
		rank: "A",
		pattern: "急性肝细胞损伤/胰腺炎",
		management: "监测血药浓度，肝功能异常时停药",
	},
	tamoxifen: {
		name: "Tamoxifen",
		name_zh: "他莫昔芬",
		rank: "B",
		pattern: "脂肪肝/肝酶升高",
		management: "定期监测肝功能",
	},
	amiodarone: {
		name: "Amiodarone",
		name_zh: "胺碘酮",
		rank: "B",
		pattern: "慢性肝细胞损伤/脂肪肝",
		management: "监测肝功能，长期使用需评估",
	},
	flucloxacillin: {
		name: "Flucloxacillin",
		name_zh: "氟氯西林",
		rank: "B",
		pattern: "胆汁淤积",
		management: "监测胆红素",
	},
	nitrofurantoin: {
		name: "Nitrofurantoin",
		name_zh: "呋喃妥因",
		rank: "B",
		pattern: "慢性肝损伤/肺纤维化",
		management: "长期监测",
	},
	minocycline: {
		name: "Minocycline",
		name_zh: "米诺环素",
		rank: "B",
		pattern: "自身免疫性肝炎",
		management: "监测自身抗体",
	},
	" ketoconazole": {
		name: "Ketoconazole",
		name_zh: "酮康唑",
		rank: "B",
		pattern: "肝酶升高",
		management: "监测肝功能",
	},
	azathioprine: {
		name: "Azathioprine",
		name_zh: "硫唑嘌呤",
		rank: "C",
		pattern: "肝酶升高/胆汁淤积",
		management: "监测血TPMT活性",
	},
	enecvir: {
		name: "Entecavir",
		name_zh: "恩替卡韦",
		rank: "B",
		pattern: "肝酶升高（罕见）",
		management: "抗乙肝一线药物，需监测HBV DNA",
	},
	tenofovir: {
		name: "Tenofovir",
		name_zh: "替诺福韦",
		rank: "B",
		pattern: "肾毒性>肝毒性",
		management: "监测肾功能和骨密度",
	},
	silymarin: {
		name: "Silymarin",
		name_zh: "水飞蓟素",
		rank: "E",
		pattern: "保肝辅助用药",
		management: "安全性良好",
	},
	ursodeoxycholic_acid: {
		name: "Ursodeoxycholic Acid",
		name_zh: "熊去氧胆酸",
		rank: "E",
		pattern: "原发性胆汁性胆管炎",
		management: "一线治疗药物",
	},
	lamivudine: {
		name: "Lamivudine",
		name_zh: "拉米夫定",
		rank: "B",
		pattern: "肝酶升高（罕见）",
		management: "抗乙肝药物，需监测",
	},
	phenytoin: {
		name: "Phenytoin",
		name_zh: "苯妥英",
		rank: "A",
		pattern: "急性肝细胞损伤",
		management: "监测血药浓度",
	},
};

/**
 * 查询药物肝毒性���函数
 */
async function queryHepatotoxicity(drugName: string, _drugbankId?: string): Promise<HepatotoxicityResult> {
	// 1. 尝试LiverTox API
	const livertoxResult = await queryLiverTox(drugName);
	if (livertoxResult) {
		return livertoxResult;
	}

	// 2. 查询本地知识库
	const localResult = queryLocalKnowledgeBase(drugName);
	if (localResult) {
		return localResult;
	}

	// 3. 返回未知
	return {
		source: "Unknown",
		name: drugName,
		hepatotoxicity_rank: "E",
		rank_meaning: "无明确数据",
		risk_level: "none",
		management: "暂无该药物的肝毒性数据，请参考药品说明书",
	};
}

/**
 * 肝毒性查询工具
 */
export const hepatotoxicityTool = tool({
	name: "check_hepatotoxicity",
	description: "查询药物的肝毒性等级和临床特征（基于LiverTox数据库）",
	parameters: {
		type: "object",
		properties: {
			drug_name: { type: "string", description: "药物通用名（英文）" },
			drugbank_id: { type: "string", description: "DrugBank ID，可选" },
		},
		required: ["drug_name"],
	},
	handler: async ({ drug_name, drugbank_id }) => {
		console.log(`[Hepatotoxin] Checking: ${drug_name}`);
		return queryHepatotoxicity(drug_name, drugbank_id);
	},
});

/**
 * 批量肝毒性查询
 */
export const batchHepatotoxicityTool = tool({
	name: "batch_check_hepatotoxicity",
	description: "批量查询多种药物的肝毒性",
	parameters: {
		type: "object",
		properties: {
			drug_list: {
				type: "array",
				items: { type: "string" },
				description: "药物名称列表",
			},
		},
		required: ["drug_list"],
	},
	handler: async ({ drug_list }) => {
		const results = await Promise.all(drug_list.map((drug) => queryHepatotoxicity(drug)));

		return {
			drugs: results,
			summary: {
				high_risk: results.filter((r) => r.risk_level === "high").length,
				moderate_risk: results.filter((r) => r.risk_level === "moderate").length,
				low_risk: results.filter((r) => r.risk_level === "low").length,
				unknown: results.filter((r) => r.risk_level === "none").length,
			},
		};
	},
});

/**
 * 搜索肝毒性药物
 */
export const searchHepatotoxicDrugsTool = tool({
	name: "search_hepatotoxic_drugs",
	description: "按肝毒性等级搜索药物",
	parameters: {
		type: "object",
		properties: {
			min_rank: {
				type: "string",
				enum: ["A", "B", "C", "D", "E"],
				description: "最低肝毒性等级",
			},
			indication: {
				type: "string",
				description: "治疗用途筛选（如 hepatitis, anti-HBV）",
			},
		},
		required: ["min_rank"],
	},
	handler: async ({ min_rank, indication }) => {
		// 从本地知识库筛选
		const ranksOrder = ["A", "B", "C", "D", "E"];
		const minIdx = ranksOrder.indexOf(min_rank);

		const matched = Object.entries(LOCAL_KNOWLEDGE_BASE)
			.filter(([_, v]) => ranksOrder.indexOf(v.rank) <= minIdx)
			.map(([_, v]) => ({ name: v.name, name_zh: v.name_zh, rank: v.rank }));

		return {
			matched_count: matched.length,
			drugs: matched.slice(0, 20),
		};
	},
});

export const hepaticTools = [hepatotoxicityTool, batchHepatotoxicityTool, searchHepatotoxicDrugsTool];
