# 🧬 肝病用药智能决策 Agent · liver_check

一个面向**肝病场景**的用药安全助手，基于 DeepSeek V4 大模型，覆盖三类临床问题：

| 功能 | 说明 |
|---|---|
| 药物肝毒性评估 | 按 LiverTox 分级（A–E）给出肝毒性等级、临床表型与管理建议，并结合 Child-Pugh 评分给出剂量调整 |
| Child-Pugh 评分 | 由胆红素、白蛋白、凝血酶原时间延长、腹水、肝性脑病五项算出 5–15 分与 A/B/C 分级，并映射到减量/禁用建议 |
| 肝病药物推荐 | 按适应证（慢乙肝、慢丙肝、保肝、肝硬化、胆汁淤积、脂肪肝）与分级推荐药物 |

同一个启动器 `run-medical-agent.bat` 分流两种使用方式：

| 模式 | 入口 | 依赖 |
|---|---|---|
| **GUI 模式** | `medical-agent.html` | 只需浏览器，双击即用 |
| **CLI 模式** | pi coding-agent 一次性问答（`--system-prompt` + `--print`） | 需要 Node.js ≥ 22.19.0，并先构建 |

> ⚠️ **免责声明**：本项目仅用于技术演示与学习，全部输出**不构成医疗建议**，实际用药决策必须由具备资质的临床医生作出。

---

## 快速开始

### 1. 准备环境（仅 CLI 模式需要）

安装 Node.js 22.19.0 或更高版本，然后在本目录双击：

```bat
setup.bat
```

它会依次执行 `npm install` 与 `npm run build`，完成后生成 `packages/coding-agent/dist/cli.js`。

构建只编译四个引擎包（`tui → ai → agent → coding-agent`），**不联网**、不依赖本地已有的 `dist`，从零 clone 即可复现。

### 2. 启动

```bat
run-medical-agent.bat
```

- 选 `1` → 用默认浏览器打开 GUI 界面（首次打开按页面提示填入自己的 API Key）
- 选 `2` → 进入 CLI 模式，再选 `1 / 2 / 3` 对应上面三大功能（需先设好 `DEEPSEEK_API_KEY`，详见[「关于 API Key」](#-关于-api-key必读)）

CLI 交互示例（药物肝毒性检查）：

```
Select (1/2): 2
Select (1/2/3): 1
Enter drug name (English): Acetaminophen
Enter daily dose (mg): 4000
Enter Child-Pugh score (5-15): 8
```

CLI 会以 `deepseek-v4-pro` 模型、一次性（`--print`）方式调用 Agent，把答案直接打印到终端。

---

## 目录结构

```
liver_check/
├── run-medical-agent.bat        # 启动器（GUI / CLI 分流）
├── setup.bat                    # 一键安装依赖并构建
├── medical-agent.html           # GUI 界面（单文件，直连 DeepSeek API）
│
├── MEDICAL-AGENT.md             # 医学扩展的设计说明与工具清单
├── medical-config.json          # 药物相互作用 / 患者约束 / 报告与安全开关
├── hepatic-config.json          # 肝病知识库的数据源与扩展计划
├── medical-scripts.json         # 评估脚本的包声明
├── hepatic_knowledge_base.json  # 肝病用药知识库（根级副本）
│
├── hepatic/                     # 肝病专属资产
│   └── web/
│       ├── index.html           # 独立的肝病知识库浏览器页面
│       └── knowledge_base_cn.json
├── hepatic-harness/
│   └── child_pugh_calculator.ts # Child-Pugh 评分计算器
├── medical-harness/             # 医疗 Agent 治理层
│   ├── input_sanitizer.ts       # 输入校验与脱敏
│   ├── output_auditor.ts        # 输出审核与免责声明
│   └── evaluation_runner.ts     # 评估基准运行器
├── tests/                       # 评测基准用例
│   ├── med_safety_benchmark.json
│   ├── hepatic_benchmark.json
│   └── hepatic_dose_benchmark.json
├── scripts/
│   └── run-medical-eval.ts      # 评估测试入口
├── .pi/prompts/                 # 医学 / 肝病系统提示词
│   ├── medical/system_prompt.md
│   └── hepatic/system_prompt.md
│
└── packages/                    # Agent 引擎与医学工具包
    ├── agent/                   #   通用 Agent 内核
    ├── ai/                      #   模型提供方与流式接口（含 deepseek-v4-pro 定义）
    ├── tui/                     #   终端 UI 组件
    ├── coding-agent/            #   CLI 入口（run-medical-agent.bat 调用的就是它）
    ├── medical-tools/           #   药物相互作用、替代药、患者约束过滤（早期原型）
    └── hepatic-tools/           #   肝毒性分级、剂量调整、肝病用药知识库（早期原型）
```

`packages/agent`、`packages/ai`、`packages/tui`、`packages/coding-agent` 来自上游 pi-mono，可直接构建运行；`packages/medical-tools`、`packages/hepatic-tools` 是早期原型，尚未接入 CLI，也不在默认构建链路里（见「已知限制」）。

---

## 工作原理

**GUI 模式**是完全自包含的单文件网页：表单 → 拼接提示词 → 浏览器直接请求 `https://api.deepseek.com/v1/chat/completions` → 渲染结果。页面内另带一份本地肝毒性 / 肝病用药速查表（`DRUG_DB`、`LIVER_DRUGS`）作为备用数据。

**CLI 模式**不新增后端：启动器把用户输入拼成一段结构化的系统提示词，交给 `packages/coding-agent/dist/cli.js`（pi coding-agent），由它以 `--model deepseek-v4-pro --print` 单轮执行并打印结果。医学判断力来自**系统提示词 + 模型知识**，这一层不依赖任何外部服务。

另有 `medical-harness/` 承担输入脱敏、输出审核与免责声明、评测基准运行，把「模型能力」和「医疗安全边界」分开，供后续接入时使用。

---

## 🔑 关于 API Key（必读）

**本仓库不包含任何 API Key**，两种模式都需要你自己申请一个：

> 申请地址：<https://platform.deepseek.com/api_keys>

### GUI 模式

双击 `medical-agent.html` 打开后，页面顶部会亮一条黄色提示。点「这里填入你自己的 Key」，或用页脚的「设置 / 更换 API Key」，粘贴你的 Key 即可。

- Key 只保存在**本机浏览器的 localStorage**，不会上传到任何服务器，也不在仓库里。
- 换电脑、换浏览器要重新填；点「设置 / 更换 API Key」后留空并确定 = 清除已保存的 Key。
- 没配置就直接点查询，会提示你先去配置，而不是抛一个看不懂的 401。

### CLI 模式

启动器会检查环境变量 `DEEPSEEK_API_KEY`，**没有就打印设置说明并退出**，不会静默失败：

```
[ERROR] 未检测到 DEEPSEEK_API_KEY 环境变量
  申请地址: https://platform.deepseek.com/api_keys
  1) 临时（只对当前窗口有效）：set DEEPSEEK_API_KEY=sk-你的key
  2) 永久（推荐）：sysdm.cpl → 高级 → 环境变量 → 新建用户变量
```

设置完重开一个终端（或重开 `run-medical-agent.bat`）即可。GUI 模式不需要这个环境变量。


---

## 已知限制

1. `packages/medical-tools`、`packages/hepatic-tools` 是按「假想的工具 API」写的原型，`tool` 工厂在 `pi-agent-core@0.76` 里并不存在，另有若干拼写错误（`anticoagANTS`、`aler`），因此**当前不能编译**，也未接入 CLI。它们保留下来作为设计参考，构建脚本默认跳过。
2. `--model deepseek-v4-pro` 需要在 `packages/ai` 的模型表里存在，并配置 `DEEPSEEK_API_KEY` 才能被解析；两者都已随仓库提供。
3. GUI 模式的请求在浏览器里发起，受 CORS 与网络环境影响；离线时只能看内置速查表。

---

## 评测基准

```bash
# 需要 tsx
node --import tsx scripts/run-medical-eval.ts
```

用例分三类：药物相互作用安全检查（`med_safety_benchmark.json`）、肝毒性分级（`hepatic_benchmark.json`）、肝病剂量调整（`hepatic_dose_benchmark.json`）。

---

## 开发

```bash
npm ci
npm run build        # 构建 tui → ai → agent → coding-agent
npx biome check .    # 静态检查
npx biome check --write .   # 自动修
pip install pre-commit && pre-commit install   # 可选：提交前自动检查
```

`.github/workflows/ci.yml` 在每次推送时跑两遍：一遍 biome 检查，一遍 `npm ci` + `npm run build` + CLI 冒烟测试。

---

## 致谢与许可

Agent 引擎（`packages/agent`、`packages/ai`、`packages/tui`、`packages/coding-agent`）来自 MIT 许可的 [pi-mono](https://github.com/earendil-works/pi-mono) 项目；肝病 / 医学扩展、GUI、启动器与评测用例是在此基础上新增的。整体以 MIT 许可发布，详见 [LICENSE](LICENSE)。
