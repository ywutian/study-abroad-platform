# 数据获取方案 - 商用级别

## 概述

本项目的数据分为两类：

1. **学校数据** - 来自官方数据源
2. **案例数据** - 用户生成内容 (UGC)

---

## 1. 学校数据 - College Scorecard API

### 数据源

- **来源**: 美国教育部 (U.S. Department of Education)
- **API**: https://collegescorecard.ed.gov/data/documentation/
- **授权**: 完全免费，支持商用
- **获取 API Key**: https://api.data.gov/signup/

### 包含数据（完整字段映射）

| API 字段                                                        | DB 字段 (School) | DB 字段 (SchoolMetric key) | 说明               |
| --------------------------------------------------------------- | ---------------- | -------------------------- | ------------------ |
| `latest.admissions.admission_rate.overall`                      | `acceptanceRate` | `acceptance_rate`          | 录取率 (×100)      |
| `latest.admissions.sat_scores.average.overall`                  | `satAvg`         | `avg_sat`                  | SAT 总分平均       |
| `latest.admissions.sat_scores.25th_percentile.critical_reading` | `satReading25`   | `sat_reading_25`           | SAT 阅读 25th      |
| `latest.admissions.sat_scores.75th_percentile.critical_reading` | `satReading75`   | `sat_reading_75`           | SAT 阅读 75th      |
| `latest.admissions.sat_scores.25th_percentile.math`             | `satMath25`      | `sat_math_25`              | SAT 数学 25th      |
| `latest.admissions.sat_scores.75th_percentile.math`             | `satMath75`      | `sat_math_75`              | SAT 数学 75th      |
| `latest.admissions.act_scores.midpoint.cumulative`              | `actAvg`         | `avg_act`                  | ACT 综合中位数     |
| `latest.admissions.act_scores.25th_percentile.cumulative`       | `act25`          | `act_25`                   | ACT 25th           |
| `latest.admissions.act_scores.75th_percentile.cumulative`       | `act75`          | `act_75`                   | ACT 75th           |
| `latest.cost.tuition.out_of_state`                              | `tuition`        | —                          | 州外学费 (USD)     |
| `latest.student.size`                                           | `studentCount`   | —                          | 在校生规模         |
| `latest.completion.completion_rate_4yr_150nt`                   | `graduationRate` | —                          | 4年毕业率 (×100)   |
| `latest.earnings.10_yrs_after_entry.median`                     | `avgSalary`      | —                          | 毕业10年后中位薪资 |
| _(计算)_ satReading25 + satMath25                               | `sat25`          | `sat_25`                   | SAT 综合 25th      |
| _(计算)_ satReading75 + satMath75                               | `sat75`          | `sat_75`                   | SAT 综合 75th      |

> **双写策略**: 最新值写入 School 模型字段（用于实时评分），年度快照写入 SchoolMetric 表（用于趋势分析）。

### 使用方式

```bash
# 1. 配置 API Key
echo "COLLEGE_SCORECARD_API_KEY=your_key_here" >> .env

# 2. 运行同步 (管理员)
curl -X POST http://localhost:3000/api/schools/sync/scorecard?limit=500 \
  -H "Authorization: Bearer <admin_token>"
```

### 同步服务

```typescript
// apps/api/src/modules/school/school-data.service.ts
@Injectable()
export class SchoolDataService {
  async syncSchoolsFromScorecard(limit = 100) {
    // 从 College Scorecard 获取并更新数据库
  }
}
```

---

## 2. 案例数据 - 用户生成内容 (UGC)

### 为什么用 UGC？

1. **合规性** - 避免爬虫的法律风险
2. **真实性** - 用户自己的申请经历
3. **可持续性** - 数据随用户增长
4. **社区性** - 建立用户粘性

### 激励机制

```
┌─────────────────────────────────────────────┐
│             积分获取                          │
├─────────────────────────────────────────────┤
│ 提交案例           +50 积分                   │
│ 案例被验证         +100 积分                  │
│ 案例被标记"有帮助"  +10 积分                   │
│ 完善个人档案        +30 积分                  │
│ 推荐新用户注册      +50 积分                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│             积分消耗                          │
├─────────────────────────────────────────────┤
│ 查看案例详情        -20 积分                  │
│ AI 分析            -30 积分                  │
│ 私信认证用户        -10 积分                  │
└─────────────────────────────────────────────┘
```

### 数据验证流程

```
用户提交案例
     ↓
  自动标记 "待验证"
     ↓
  ┌────────────────────────┐
  │ 验证方式 (任选其一):      │
  │ 1. 上传 Offer Letter   │
  │ 2. 学校邮箱验证         │
  │ 3. 管理员人工审核       │
  └────────────────────────┘
     ↓
  验证通过 → 标记 ✓ 已验证
     ↓
  案例进入公开案例库
```

### 隐私保护

- **匿名化**: GPA 显示为范围 (3.7-3.9)，不显示具体数值
- **可见性控制**: 用户可选择 PRIVATE / ANONYMOUS / VERIFIED_ONLY
- **数据脱敏**: 敏感信息自动打码

---

## 3. 其他数据源 (可选扩展)

### US News 排名

- **方式**: 手动更新或购买数据授权
- **频率**: 每年更新一次
- **用途**: 学校排名展示

### QS 排名

- **方式**: 同上
- **用途**: 国际排名参考

### Common Data Set (CDS)

- **来源**: 各学校官网的 Institutional Research 页面
- **数据**: 比 Scorecard 更详细 — GPA 分布、班级排名、录取因素权重（"Very Important" / "Important" / "Considered" / "Not Considered"）
- **合规性**: CDS 是学校自愿公开的事实性数据，可商业使用
- **与 Scorecard 对比**:

| 数据维度       | College Scorecard | Common Data Set                   |
| -------------- | ----------------- | --------------------------------- |
| SAT/ACT 百分位 | ✅ 25th/75th      | ✅ 25th/75th                      |
| GPA 分布       | ❌                | ✅ (4.0+/3.75-3.99/3.5-3.74/...)  |
| 班级排名       | ❌                | ✅ (Top 10%/25%/50%)              |
| 录取因素权重   | ❌                | ✅ (16+ 因素，含活动/推荐信/面试) |
| API 可用性     | ✅ RESTful API    | ❌ PDF/HTML 需手动收集或爬取      |
| 数据粒度       | 学校级            | 学校+专业级                       |

- **状态**: 计划未来集成，优先使用 College Scorecard 已有数据

### 竞赛数据库

- **来源**: 专家策划清单 + 用户提交
- **数据**: 90+ 高中学术竞赛，含名称（中英文）、分类（12 大类）、等级、声望层级（1-5）
- **模型**: `Competition` 表（见 `prisma/schema.prisma`）
- **种子脚本**: `prisma/seed-competitions.ts`
- **更新策略**: 每年审查层级分配，接受社区贡献

---

## 4. 数据更新策略

```
┌──────────────────────────────────────────────┐
│                 定时任务                       │
├──────────────────────────────────────────────┤
│ College Scorecard 同步    每月 1 日凌晨        │
│ 排名数据更新              每年 9 月 (新排名发布) │
│ 案例数据统计              每日凌晨              │
└──────────────────────────────────────────────┘
```

---

## 5. 商业合作方案 (可选)

### 与留学机构合作

```
┌─────────────────────────────────────────────┐
│              合作模式                         │
├─────────────────────────────────────────────┤
│                                              │
│  留学机构提供:                                 │
│  - 脱敏的历史申请案例数据                       │
│  - 顾问入驻提供专业建议                         │
│                                              │
│  平台提供:                                    │
│  - 精准用户导流                                │
│  - 品牌曝光位                                  │
│  - 数据分析报告                                │
│                                              │
└─────────────────────────────────────────────┘
```

---

## 6. 法律合规

| 数据类型          | 来源             | 合规性        |
| ----------------- | ---------------- | ------------- |
| College Scorecard | 美国政府公开数据 | ✅ 完全合规   |
| 用户案例          | 用户自愿提交     | ✅ 需用户协议 |
| US News 排名      | 手动/授权        | ⚠️ 需注明来源 |
| 爬虫数据          | 第三方网站       | ❌ 法律风险   |

### 用户协议要点

1. 用户确认案例真实性
2. 用户授权平台展示 (匿名化)
3. 用户可随时删除自己的案例
4. 平台不对案例真实性负责

---

## 快速开始

```bash
# 1. 获取 College Scorecard API Key
# 访问: https://api.data.gov/signup/

# 2. 配置环境变量
echo "COLLEGE_SCORECARD_API_KEY=your_key" >> apps/api/.env

# 3. 运行数据库迁移
pnpm --filter api prisma migrate dev

# 4. 同步学校数据
pnpm --filter api cli sync:schools

# 5. 启动服务
pnpm dev
```
