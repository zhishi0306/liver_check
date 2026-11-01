/**
 * Hepatic Drug Filter - 肝相关药物筛选
 *
 * 从药物列表中筛选出与肝功能相关的药物
 */

import { tool } from "@earendil-works/pi-agent-core";

export interface HepaticDrug {
	name: string;
	name_zh: string;
	category: "hepatotoxic" | "liver_drug" | "dose_adjustment" | "unknown";
	rank?: string;
	reason: string;
	indications?: string[];
}

/**
 * 肝毒性药物数据库
 */
const HEPATOTOXIC_DRUGS: Record<string, { name_zh: string; rank: string; reason: string }> = {
	acetaminophen: { name_zh: "对乙酰氨基酚", rank: "A", reason: "高概率肝毒性" },
	phenytoin: { name_zh: "苯妥英", rank: "A", reason: "高概率肝毒性" },
	isoniazid: { name_zh: "异烟肼", rank: "A", reason: "高概率肝毒性" },
	rifampicin: { name_zh: "利福平", rank: "A", reason: "高概率肝毒性" },
	methotrexate: { name_zh: "甲氨蝶呤", rank: "A", reason: "导致肝纤维化" },
	valproic_acid: { name_zh: "丙戊酸", rank: "A", reason: "急性肝损伤" },
	tamoxifen: { name_zh: "他莫昔芬", rank: "B", reason: "可能导致脂肪肝" },
	amiodarone: { name_zh: "胺碘酮", rank: "B", reason: "可能导致肝损伤" },
	flucloxacillin: { name_zh: "氟氯西林", rank: "B", reason: "胆汁淤积风险" },
	nitrofurantoin: { name_zh: "呋喃妥因", rank: "B", reason: "可能导致慢性肝损伤" },
	minocycline: { name_zh: "米诺环素", rank: "B", reason: "自身免疫性肝炎" },
	ketoconazole: { name_zh: "酮康唑", rank: "B", reason: "肝酶升高" },
	azathioprine: { name_zh: "硫唑嘌呤", rank: "C", reason: "可能引起肝酶升高" },
	efavirenz: { name_zh: "依非韦伦", rank: "B", reason: "肝酶升高" },
	nevirapine: { name_zh: "奈韦拉平", rank: "B", reason: "严重肝毒性" },
};

/**
 * 肝病治疗药物数据库
 */
const LIVER_DRUGS: Record<string, { name_zh: string; indications: string[] }> = {
	enecvir: { name_zh: "恩替卡韦", indications: ["慢性乙肝", "HBV感染"] },
	tenofovir: { name_zh: "替诺福韦", indications: ["慢性乙肝", "HIV感染"] },
	lamivudine: { name_zh: "拉米夫定", indications: ["慢性乙肝", "HIV感染"] },
	adefovir: { name_zh: "阿德福韦", indications: ["慢性乙肝"] },
	telbivudine: { name_zh: "替比夫定", indications: ["慢性乙肝"] },
	silymarin: { name_zh: "水飞蓟素", indications: ["肝保护", "酒精性肝病", "病毒性肝炎"] },
	ursodeoxycholic_acid: { name_zh: "熊去氧胆酸", indications: ["原发性胆汁性胆管炎", "胆汁淤积"] },
	" bicyclol": { name_zh: "双环醇", indications: ["肝保护", "降低转氨酶"] },
	" reduced_glutathione": { name_zh: "还原型谷胱甘肽", indications: ["肝保护", "解毒"] },
	"s-adenosylmethionine": { name_zh: "腺苷蛋氨酸", indications: ["肝保护", "胆汁淤积"] },
	glycyrrhizin: { name_zh: "甘草酸制剂", indications: ["肝保护", "降低转氨酶"] },
};

/**
 * 需要根据肝功能调整剂量的药物
 */
const DOSE_ADJUSTMENT_DRUGS: Record<string, { name_zh: string; reason: string }> = {
	morphine: { name_zh: "吗啡", reason: "经肝脏代谢，清除减少" },
	fentanyl: { name_zh: "芬太尼", reason: "经肝脏代谢" },
	lorazepam: { name_zh: "劳拉西泮", reason: "经肝脏代谢" },
	diazepam: { name_zh: "地西泮", reason: "经肝脏代谢" },
	" warfarin": { name_zh: "华法林", reason: "经肝脏代谢" },
	" clopidogrel": { name_zh: "氯吡格雷", reason: "经肝脏活化" },
	metformin: { name_zh: "二甲双胍", reason: "严重肝功能不全禁忌" },
	pravastatin: { name_zh: "普伐他汀", reason: "经肝脏代谢" },
	rosuvastatin: { name_zh: "瑞舒伐他汀", reason: "经肝脏代谢" },
};

/**
 * 判断药物是否为肝相关药物
 */
function classifyHepaticDrug(drugName: string): HepaticDrug | null {
	const normalized = drugName.toLowerCase().trim();

	// 1. 检查肝毒性药物
	if (HEPATOTOXIC_DRUGS[normalized]) {
		const info = HEPATOTOXIC_DRUGS[normalized];
		return {
			name: drugName,
			name_zh: info.name_zh,
			category: "hepatotoxic",
			rank: info.rank,
			reason: info.reason,
		};
	}

	// 2. 检查肝病治疗药物
	if (LIVER_DRUGS[normalized]) {
		const info = LIVER_DRUGS[normalized];
		return {
			name: drugName,
			name_zh: info.name_zh,
			category: "liver_drug",
			reason: "肝病治疗药物",
			indications: info.indications,
		};
	}

	// 3. 检查需要调整剂量的药物
	if (DOSE_ADJUSTMENT_DRUGS[normalized]) {
		const info = DOSE_ADJUSTMENT_DRUGS[normalized];
		return {
			name: drugName,
			name_zh: info.name_zh,
			category: "dose_adjustment",
			reason: info.reason,
		};
	}

	return null;
}

/**
 * 肝相关药物筛选工具
 */
export const hepaticDrugFilterTool = tool({
	name: "filter_hepatic_drugs",
	description: "从药物列表中筛选出与肝功能相关的药物（肝毒性/肝病治疗/需调整剂量）",
	parameters: {
		type: "object",
		properties: {
			drug_list: {
				type: "array",
				items: { type: "string" },
				description: "待筛选的药物名称列表",
			},
			include_unknown: {
				type: "boolean",
				default: false,
				description: "是否包含无法分类的药物",
			},
		},
		required: ["drug_list"],
	},
	handler: async ({ drug_list, include_unknown = false }) => {
		console.log(`[Hepatic Filter] Filtering ${drug_list.length} drugs`);

		const hepaticDrugs: HepaticDrug[] = [];
		const nonHepaticDrugs: string[] = [];

		for (const drug of drug_list) {
			const classified = classifyHepaticDrug(drug);
			if (classified) {
				hepaticDrugs.push(classified);
			} else {
				nonHepaticDrugs.push(drug);
			}
		}

		// 排序：肝毒性 > 剂量调整 > 肝病治疗
		hepaticDrugs.sort((a, b) => {
			const order = { hepatotoxic: 0, dose_adjustment: 1, liver_drug: 2 };
			return order[a.category] - order[b.category];
		});

		const result = {
			total_input: drug_list.length,
			hepatic_count: hepaticDrugs.length,
			non_hepatic_count: nonHepaticDrugs.length,
			hepatic_drugs: hepaticDrugs,
			non_hepatic_drugs: nonHepaticDrugs,
			high_risk: hepaticDrugs.filter((d) => d.category === "hepatotoxic" && d.rank === "A").length,
			message:
				nonHepaticDrugs.length > 0 && !include_unknown
					? `以下${nonHepaticDrugs.length}种药物暂无肝毒性数据：${nonHepaticDrugs.join(", ")}`
					: "所有药物均已分类",
		};

		return result;
	},
});

/**
 * 检查单一药物是否为肝毒性药物
 */
export const checkHepatotoxicTool = tool({
	name: "check_is_hepatotoxic",
	description: "检查药物是否为肝毒性药物",
	parameters: {
		type: "object",
		properties: {
			drug_name: { type: "string", description: "药物名称" },
		},
		required: ["drug_name"],
	},
	handler: async ({ drug_name }) => {
		const result = classifyHepaticDrug(drug_name);

		if (!result) {
			return {
				is_hepatic_related: false,
				drug_name,
				reason: "暂无肝毒性数据",
			};
		}

		return {
			is_hepatic_related: true,
			...result,
		};
	},
});

/**
 * 推荐肝病治疗药物
 */
export const recommendLiverDrugsTool = tool({
	name: "recommend_liver_drugs",
	description: "根据适应症推荐肝病治疗药物",
	parameters: {
		type: "object",
		properties: {
			indication: {
				type: "string",
				description: "治疗适应症（如 chronic_hepatitis_b, liver_protection）",
			},
			child_pugh_grade: {
				type: "string",
				enum: ["A", "B", "C"],
				description: "Child-Pugh分级（可选）",
			},
			max_results: {
				type: "number",
				default: 5,
				description: "最大返回数量",
			},
		},
		required: ["indication"],
	},
	handler: async ({ indication, child_pugh_grade, max_results = 5 }) => {
		const lowerInd = indication.toLowerCase();
		const recommendations: Array<{ name: string; name_zh: string; suitability: string }> = [];

		for (const [key, info] of Object.entries(LIVER_DRUGS)) {
			if (
				info.indications.some((ind) => lowerInd.includes(ind.toLowerCase()) || ind.toLowerCase().includes(lowerInd))
			) {
				let suitability = "✅ 适用";

				// 如果提供了Child-Pugh分级，给出特别建议
				if (child_pugh_grade) {
					if (key === "silymarin" || key === "ursodeoxycholic_acid") {
						suitability = "✅ 推荐用于Child-Pugh各级";
					} else if (child_pugh_grade === "C") {
						suitability = "⚠️ 需谨慎评估";
					}
				}

				recommendations.push({
					name: key,
					name_zh: info.name_zh,
					suitability,
				});
			}
		}

		return {
			indication,
			recommendations: recommendations.slice(0, max_results),
			matched_count: recommendations.length,
		};
	},
});

export const hepaticFilterTools = [hepaticDrugFilterTool, checkHepatotoxicTool, recommendLiverDrugsTool];
