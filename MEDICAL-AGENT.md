# Medical Agent Extension - 用药安全智能Agent系统

基于Pi框架(@earendil-works/pi-coding-agent)的医学用药安全扩展。

## 安装与构建

```bash
# 已经在monorepo中配置，直接构建
npm run build

# 或单独构建medical-tools
npm run build:medical
```

## 环境变量

```bash
# DrugBank API密钥（可选，未设置时使用模拟数据）
export DRUGBANK_API_KEY=your_key_here

# 医学配置文件路径
export MEDICAL_CONFIG_PATH=./medical-config.json
```

## 新增文件清单

```
pi-mono/
├── .pi/
│   └── prompts/
│       ├── medical/
│       │   └── system_prompt.md    # 医学专用系统提示词
│       └── pr.md                 # 链接到medical提示词
├── packages/
│   └── medical-tools/             # 新增：医学工具包
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts           # 入口/导出
│           ├── drug_interaction_tool.ts    # 药物相互作用检查
│           ├── therapeutic_alternatives_tool.ts  # 治疗替代品
│           └── patient_constraint_filter.ts        # 患者约束过滤
├── medical-harness/               # 新增：Harness治理
│   ├── input_sanitizer.ts       # 输入校验与脱敏
│   ├── output_auditor.ts      # 输出审核与免责声明
│   └── evaluation_runner.ts   # 评估基准运行器
├── tests/
│   └── med_safety_benchmark.json  # 20个测试用例
└── medical-config.json         # 医学配置文件
```

## 医学工具列表

### P0（核心工具）

| 工具名称 | 功能 |
|---------|------|
| `batch_ddi_checker` | 批量药物相互作用检查 |
| `check_drug_pair` | 单药物对检查 |
| `get_drug_alias` | 药物别名/DrugBank ID查询 |
| `find_therapeutic_alternatives` | 治疗替代品查询 |
| `search_by_category` | 按治疗类别查找药物 |

### P1（患者因素过滤）

| 工具名称 | 功能 |
|---------|------|
| `apply_patient_constraints` | 根据患者年龄/肾功能/肝功能过滤 |
| `check_drug_for_patient` | 快速检查药物适合性 |

### P2（Harness治理）

| 工具名称 | 功能 |
|---------|------|
| `sanitize_medical_input` | 输入标准化和验证 |
| `lookup_drug` | 快速药物查询 |
| `audit_medical_output` | 输出审核与免责声明 |
| `add_medical_disclaimer` | 添加免责声明 |
| `detect_medical_hallucination` | 幻觉检测 |
| `run_medical_evaluation` | 评估测试运行 |
| `list_medical_tests` | 列出测试用例 |

## 使用示例

### 药物相互作用检查

```
输入: 患者72岁，eGFR=45，在用华法林5mg和阿司匹林100mg，要开复方新诺明

输出:
⚠️ 严重相互作用 - Warfarin + Sulfamethoxazole/Trimethoprim
【机制】复方新诺明抑制CYP2C9酶，增强华法林抗凝效果
【风险】INR显著升高，出血风险增加3-5倍
【证据等级】Level 1
【管理建议】应避免合用，建议更换抗生素

📌 免责声明：建议仅供参考，需医生最终确认
```

## 运行测试

```bash
# 运行评估测试集
npm run eval:medical

# 或使用工具
> 运行测试集合
```

## 配置说明

`medical-config.json`配置项：

- `drugbank.*` - DrugBank API配置
- `patient_constraints.*` - 患者参数阈值
- `report.*` - 报告输出设置
- `safety.*` - 安全相关设置
- `tools.*` - 工具开关
- `logging.*` - 日志配置
- `features.*` - 特性开关

## 代码统计

| 模块 | 行数 | 说明 |
|-----|------|------|
| medical-tools/src | ~800 | 3个核心工具 |
| medical-harness | ~700 | Harness治理 |
| tests | ~200 | 20个测试用例 |
| configs | ~100 | 配置和提示词 |
| **总计** | **~1800** | 增量改造 |

## 注意事项

1. DrugBank API Key为可选，未设置时使用模拟数据
2. 严重相互作用需要用户输入CONFIRM才能继续
3. 所有输出自动添加免责声明
4. 支持中英文双语