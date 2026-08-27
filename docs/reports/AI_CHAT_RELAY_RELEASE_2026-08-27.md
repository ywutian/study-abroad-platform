# 专用聊天 Relay 发布记录

## 范围与状态

用户已确认生产聊天使用此前测试的 Relay，配置独立 Secret，保持
Embedding 不变。本记录不把聊天恢复等同于共享申请分析候选通过。
当前状态：实现、合约与完整API回归通过，发布门禁进行中，尚未部署。

## 已验证的边界

- 当前生产100%仍为 `study-abroad-api-00992-zin`。
- 新建 `openai-chat-api-key:1`，内存内比对已授权凭据一致；不记录值。
- 原 `openai-api-key` 仍只有原有版本1/2，未覆盖或新增版本。
- 部署/运行身份已有必要读取权限，没有修改IAM。
- 聊天采用GPT-5.4、专用地址和SSE；Embedding保持当前线上地址、
  `text-embedding-3-small`及原密钥绑定。保持配置不代表已修复Embedding。
- Native Claude、任务路由、共享分析仍未启用；24k token/120秒上限未增加。

## 真实合约

使用项目实际 `OpenAIProvider` 和合成输入，无业务工具执行，无生产账号写入。
专用SSE模式复用现有严格解析器，普通调用在服务端收集流式结果。

| 场景             | 结果 | Provider报告tokens | 耗时ms |
| ---------------- | ---- | -----------------: | -----: |
| 普通响应         | PASS |               2518 |   1557 |
| 流式响应         | PASS |               2518 |   1120 |
| strict JSON输出  | PASS |               2568 |   1751 |
| 惰性工具调用合同 | PASS |               2581 |   1511 |

每项检查自报型号、完整结束和usage；结构化输出检查字段和值，工具仅返回
调用对象，绝不执行。自报型号不是独立供应商身份证明；tokens不是账单。
四个小合约不证明真实用户答案质量、录取准确率或模型最优。

保留失败：同一Relay的非流式请求HTTP400，不能仅换地址上线；因此明确配置
SSE，不在遇错后静默改变传输或换模型。此前共享申请分析矩阵79/80完整的
记录仍为失败/未完成，不重分类为通过。

## 工程验证

- 专用三元组缺项、空值、不安全URL启动拒绝，禁止混用旧key。
- HTTP mock证明聊天使用新地址/key，Embedding仍使用原地址/key/model。
- 上游正文及网络错误原文不出现在Provider日志/错误对象。
- 旧流式用量测试先失败：返回2501 tokens却结算4；修复为使用终态usage，
  没有usage的旧Provider保留原估算行为。
- 本轮定向配置/Provider/LLM测试167项通过；CI脚本16项通过。
- 完整API：338 suites / 4456 tests，全通过；全部CI辅助脚本48项通过。
- TypeScript、API质量、部署配置、环境文档、any及文件规模检查通过。
- 36/36门禁负向证明通过，含专用聊天地址/Secret错配必失败。
- 同时识别旧接口与严格SSE的DEFAULT级别错误前缀；仅返回固定错误分类，
  不输出原始错误正文。补充日志规则后须以最终head CI为准。
- 首次测试fixture缺少Redis mock方法、随后类型导入路径错误均已修正。

## 发布门禁

既有main CI：完整回归、构建/来源证明、备份PITR、迁移、0流量健康/Cron、
0流量完整Harness验收，通过后直接100%，再稳定URL验收、清理与告警。
失败保留证据和旧Revision，不把API/数据库健康冒充AI功能健康。

最终commit、CI、目标Revision、生产验收和回滚记录在实际完成后补齐。
未提交本地评测JSON、凭据或用户目录；没有更改现有Embedding服务代码。

## 首次发布阻断与修复

PR #633 CI `33093731391` 全绿，合并为
`0982c5de53fa33ffbcc77645b4234796e5f9b527`。main CI `33095225453`
镜像扫描发现 CVE-2026-14456：三个OpenSSL系统包仍为3.5.7-r0，
Trivy报告3个HIGH、0个CRITICAL。没有添加忽略项或重跑掩盖失败。

原流水线GCP任务没有依赖Docker扫描，因此扫描失败时迁移已开始；主动取消CI，
生产仍00992-zin100%，无新Revision。云迁移`study-abroad-migrate-pc2b2`
于2026-08-27 17:11:40Z自行成功结束，没有数据库恢复操作。

FR-008修复两阶段包下限为3.5.8-r0，部署依赖Docker/SBOM，并在迁移前扫描
实际Artifact Registry不可变摘要。main和手动发布使用相同资格条件。
本机linux/amd64容器实际确认三个包均3.5.8-r0；CI辅助65项通过，含16项
发布策略测试。首次两个负例误替换了其他扫描步骤，限定测试意图后修正；
这不是生产修复失败或漏洞扫描通过的证据。完整新镜像扫描仍需新CI确认。

修复依据：[OpenSSL发布说明](https://mirror.openssl-library.org/news/openssl-3.5-notes/)、
[Alpine x86_64包](https://pkgs.alpinelinux.org/package/v3.23/main/x86_64/openssl)。
上游严重度与Trivy不同，不降低现有发布门槛。
