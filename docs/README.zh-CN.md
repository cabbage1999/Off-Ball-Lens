# Off-Ball Lens：看见触球之前的接应机会

新版沿实际跑动展示球员何时拥有危险接应空间、空间如何变化，以及一次机会后来是否被传球利用。数值来自论文作者的 `accessible-space==2.1.0`，已停止默认使用旧版自拟0–100指数和两条预设路线比较。

[完整在线演示](https://offball-lens-hackathon-2026.azurewebsites.net/) · [静态回放备份](https://cabbage1999.github.io/Off-Ball-Lens/) · [完整方法](method.md) · [场景说明](scenarios.md) · [Foundry开通与本机配置](foundry-setup.zh-CN.md) · [公网部署与验收](deployment.zh-CN.md)

当前状态更新于**2026年10月28日（北京时间）**：完整在线演示已接通真实 MAF/Azure 解释，无需评委登录或自备密钥。初次部署及重启后的两次公网调用均通过，见[部署验收记录](../deploy/verification.json)。113.40秒英文字幕演示已在[YouTube](https://youtu.be/ejo0cYWsC94)公开发布，YouTube Studio 已确认公开范围及10月28日发布日期，且已通过未登录播放检查。参赛页必需材料已保存，项目已列入赛事 Projects；页面未提供独立 Submit/Finalize 按钮或正式回执，详见[交付记录](submission/submission-record.json)。下文保留各次历史检查的日期和范围。

## 本机运行

安装Node.js 22或以上，在项目目录运行 `npm start`，然后打开 `http://127.0.0.1:4173`。回放读取已附带的预计算数据，不需要Python、GPU或云端密钥。重新生成数值时，按[英文README](../README.md)安装Python 3.12隔离环境及固定版本依赖。

## Microsoft Agent Framework 解释

服务器现已接入真正的 Microsoft Agent Framework（MAF）：每次解释请求启动一个 Python 子进程，由**一个 Agent**执行原生工具循环。它只注册 `analyze_window` 和 `get_evidence` 两个工具，均向 Node 读取已有分析。Node 校验所选球员、过去时间范围和已取回的引用，并用规范事实生成中英文解释；模型不计算或改写 DAS。当前实现没有第二个审查 Agent，也没有 MAF Workflow。

安装 Python 3.12 后，在项目根目录运行：

```sh
npm run setup:agent
npm run test:agent
```

安装脚本使用 `requirements-agent.lock` 创建独立的 `.venv-maf`，其中 MAF core 为 `1.23.0`、OpenAI provider 为 `1.17.0`。将 `.env.example` 复制为被 Git 忽略的本机 `.env`，按[配置说明](foundry-setup.zh-CN.md)填写自己的授权凭证，然后运行 `npm run start:agent`。需要指定解释器时，安装阶段使用 `MAF_BOOTSTRAP_PYTHON`，运行阶段使用绝对路径 `MAF_PYTHON`。

**2026年10月27日，完整本机 Node → MAF → Azure 链路已通过真实 smoke 和8项扩展检查。** 使用的端点为 `https://westus3.api.cognitive.microsoft.com/openai/v1/responses`，模型为 `gpt-5-mini`。脱敏的[单次记录](../artifacts/agent-framework-trace.json)与[8项记录](../artifacts/agent-framework-suite.json)均为 `mock:false`。早先失败的是模型部署创建请求；这些结果不推断 Azure 未公开的后台路由，也不保证其他账号具有相同权限。

扩展检查覆盖三个场景的英文分析师与中文球迷模式、局限问题和对抗性问题。记录包含每项请求的耗时、模型请求、原生工具调用与修复次数。这是实际运行记录，不是延迟保证，也不替代人工对回答相关性和足球解释的评审。

`npm run smoke:agent` 会通过 Node HTTP 接口执行真正的 MAF/Azure 检查并保存脱敏记录；可选的 `npm run smoke:agent -- --suite` 增加三个场景、两种语言、局限问题和对抗性问题。这些命令会产生真实云端用量。`test:agent` 的内存模拟提供方只用于本地工程验证，不计为 Azure 通过。原有 `FOUNDRY_ORCHESTRATOR=native` 模式仍可配合 `npm start` 和 `npm run smoke:foundry` 使用。

每项 MAF 请求共享 40 秒、6 次模型请求和10次工具调用的上限；一次候选修复也计入这些上限。单次提供方或工具等待不超过12秒，SDK不自动重试。取消请求会终止对应子进程。模型没有可见的文件系统或命令执行工具，但这不等于操作系统级文件访问隔离。

10月27日本机验收时已复核 Free Trial 的 `spendingLimit=On`；那次检查没有新建资源、升级订阅或购买 Marketplace 模型。10月28日已另行完成 Azure App Service F1 免费层部署，并保持试用支出上限开启。托管免费不代表推理没有用量；Azure 推理使用项目方的试用额度，评委无需自备订阅或密钥。密钥只保存在本机 `.env` 或服务端环境设置中，不放入聊天、前端、录像或 GitHub。完整在线演示提供公开 MAF 后端；GitHub Pages 备份仍使用确定性本地解释。

## 体验内容

三段独立编排的32、34、30秒进攻包含22名球员、足球、明确球权和同步事件。球员分阶段承担压迫、盯人、补位、接应、拉开和远侧保护等角色；场景生成器不读取DAS结果。

新版传球飞行速度为10.20–20.09米/秒，带球时足球仍跟随持球者。第一段A7加入回撤、减速转弯、弧线向内和再加速；具体时刻、速度和限制见[场景说明](scenarios.md)。这些是经过运动约束检查的合成编排，不是职业比赛校准结果。

球迷模式以球场为主，右侧保留球员视角与问答。球场边线下方的“预设场景解说”讲解已经发生的关键移动，不遮挡球员，也不自动调用云模型。A队使用蓝白配色和深色号码；危险空间色标统一使用紫、橙至浅黄。分析师模式保留机会曲线、事件、接应窗口、AS/DAS数值、单位、帧来源和工具记录。点击任意球员可查看最近3秒轨迹；两种语言共用事实。点击已出现的机会或解释证据，可以回看对应帧；播放过程中不会提前显示未来峰值和传球结局。更多修改与验收见[回放改进记录](replay-v3.md)。

AS是模型中的有效可接应面积，单位平方米；DAS是危险度加权面积。热图使用全局固定色阶。它们都不是进球概率，也不是球员的真实贡献分数。持球者、防守方、越位筛选及飞行中的球会显示对应状态，不把“不适用”伪装成零分。

第三段不是“全程没有机会”：它包含先有机会、越位、重新获得接应空间，再发生拦截的过程。合成剧情只是待分析的输入，不是算法必须证明的结论。

## 科学与工程边界

作者算法也含假设。网格密度、位置扰动和采样率会影响数值与机会提示时刻，部分变化较大；当前结果适合探索和解释，不应据此给职业球员精确排名。个人接应空间下降也可能伴随有效牵制，不能直接给跑动打差评。十个定性例子和完整敏感性报告见[模型集成说明](das-integration.md)。尚无独立足球专家验收或职业比赛校准。

MAF 当前使用 Responses API 和严格结构化的最终计划。旧版 native 模式另支持显式选择的 Chat Completions；JSON 模式并不替代本地证据校验。配置齐全、直接推理成功、完整 MAF 工具调用通过和公网服务可用是不同的验收项。

本项目已完成本机和公网 MAF 真实调用检查，并录制113.40秒的当前版本演示。录像在公网部署前使用本机版本完成，包含真实 Azure 支持的 MAF 调用；不能将录像当作公网部署验收。视频已公开发布并通过未登录播放检查，官网必需材料已保存；独立人工评估未作完成声明，平台也未显示单独的提交回执，见[交付清单](handoff.md)。

公网验收已核对14个应用与数据文件、HTTP 路由、两项原生工具和证据，并记录对应时段的 Azure 请求指标。HTTP 检查器本身不能独立鉴证 Azure 后端，资源级指标也不是逐响应鉴证；范围说明见[部署验收记录](../deploy/verification.json)。F1 服务可能休眠，现有验收不等于整个评审期的可用性保证；需保持服务至北京时间11月11日15:59。[团队人工审查记录](team-review.zh-CN.md)仍待填写，供足球合理性与两位初次使用者的易懂性检查分别使用。
