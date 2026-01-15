import * as fs from 'fs';
import * as path from 'path';

// 学校申请轮次规则
const SCHOOL_ROUND_RULES: Record<string, string[]> = {
  // Ivy League
  'Princeton University': ['REA', 'RD'],
  'Harvard University': ['REA', 'RD'],
  'Yale University': ['REA', 'RD'],
  'Columbia University': ['ED', 'RD'],
  'University of Pennsylvania': ['ED', 'RD'],
  'Cornell University': ['ED', 'RD'],
  'Brown University': ['ED', 'RD'],
  'Dartmouth College': ['ED', 'RD'],

  // Top Private
  'Massachusetts Institute of Technology': ['EA', 'RD'], // MIT EA 不绑定
  'Stanford University': ['REA', 'RD'],
  'California Institute of Technology': ['EA', 'RD'],
  'Duke University': ['ED', 'RD'],
  'Northwestern University': ['ED', 'RD'],
  'Johns Hopkins University': ['ED', 'ED2', 'RD'],
  'Rice University': ['ED', 'RD'],
  'Vanderbilt University': ['ED', 'ED2', 'RD'],
  'Washington University in St. Louis': ['ED', 'ED2', 'RD'],
  'Emory University': ['ED', 'ED2', 'RD'],
  'Georgetown University': ['REA', 'RD'],
  'Carnegie Mellon University': ['ED', 'RD'],
  'University of Southern California': ['EA', 'RD'], // USC 无 ED
  'New York University': ['ED', 'ED2', 'RD'],
  'University of Notre Dame': ['REA', 'RD'],
  'Boston University': ['ED', 'ED2', 'RD'],
  'Boston College': ['EA', 'ED', 'RD'],
  'Tufts University': ['ED', 'ED2', 'RD'],
  'Wake Forest University': ['ED', 'ED2', 'RD'],

  // Top Public (UC 系统无 EA/ED)
  'University of California, Berkeley': ['RD'],
  'University of California, Los Angeles': ['RD'],
  'University of California, San Diego': ['RD'],
  'University of California, Davis': ['RD'],
  'University of California, Irvine': ['RD'],
  'University of California, Santa Barbara': ['RD'],

  // 其他公立
  'University of Michigan, Ann Arbor': ['EA', 'RD'],
  'University of Virginia': ['ED', 'EA', 'RD'],
  'University of North Carolina at Chapel Hill': ['EA', 'RD'],
  'Georgia Institute of Technology': ['EA', 'EA2', 'RD'], // GT 无 ED
  'University of Illinois Urbana-Champaign': ['EA', 'RD'], // UIUC 无 ED
  'University of Wisconsin-Madison': ['EA', 'RD'], // 无 REA/ED
  'University of Washington': ['RD'], // UW 无 EA/ED
  'University of Texas at Austin': ['EA', 'RD'],
  'University of Florida': ['EA', 'RD'],
  'Ohio State University': ['EA', 'RD'],
  'Penn State University': ['EA', 'RD'],
  'Purdue University': ['EA', 'RD'],
  'University of Maryland, College Park': ['EA', 'RD'],

  // 文理学院
  'Williams College': ['ED', 'RD'],
  'Amherst College': ['ED', 'RD'],
  'Swarthmore College': ['ED', 'ED2', 'RD'],
  'Pomona College': ['ED', 'ED2', 'RD'],
  'Wellesley College': ['ED', 'ED2', 'RD'],
  'Bowdoin College': ['ED', 'ED2', 'RD'],
  'Middlebury College': ['ED', 'ED2', 'RD'],
  'Carleton College': ['ED', 'ED2', 'RD'],
  'Claremont McKenna College': ['ED', 'ED2', 'RD'],
  'Hamilton College': ['ED', 'ED2', 'RD'],
  'Haverford College': ['ED', 'ED2', 'RD'],
  'Vassar College': ['ED', 'ED2', 'RD'],
  'Grinnell College': ['ED', 'ED2', 'RD'],
  'Colgate University': ['ED', 'ED2', 'RD'],
  'Davidson College': ['ED', 'ED2', 'RD'],
  'Colby College': ['ED', 'ED2', 'RD'],
  'Bates College': ['ED', 'ED2', 'RD'],
  'Barnard College': ['ED', 'RD'],

  // 艺术/音乐学院 (大多只有 RD 或 EA)
  'Rhode Island School of Design': ['ED', 'RD'],
  'Pratt Institute': ['EA', 'RD'],
  'School of the Art Institute of Chicago': ['EA', 'RD'],
  'California Institute of the Arts': ['EA', 'RD'],
  'ArtCenter College of Design': ['RD'], // 滚动录取
  'Savannah College of Art and Design': ['EA', 'RD'],
  'Maryland Institute College of Art': ['ED', 'EA', 'RD'],
  'The Juilliard School': ['RD'],
  'Berklee College of Music': ['EA', 'RD'],
  'Curtis Institute of Music': ['RD'],
  'New England Conservatory': ['ED', 'RD'],
  'Manhattan School of Music': ['RD'],

  // 工程学院
  'Harvey Mudd College': ['ED', 'ED2', 'RD'],
  'Rose-Hulman Institute of Technology': ['EA', 'RD'],
  'Cooper Union': ['ED', 'RD'],
  'Olin College of Engineering': ['ED', 'RD'],
  'California Polytechnic State University, San Luis Obispo': ['EA', 'RD'],
};

// MIT 不提供的本科专业
const MIT_INVALID_MAJORS = [
  'Finance',
  'Business Administration',
  'Accounting',
  'Marketing',
  'Pre-Law',
];

// 分数合理性规则
const SCORE_RULES = {
  GPA_MIN: 2.5,
  GPA_MAX: 4.3,
  SAT_MIN: 1000,
  SAT_MAX: 1600,
  ACT_MIN: 20,
  ACT_MAX: 36,
};

// 顶尖学校录取分数下限 (录取案例)
const TOP_SCHOOL_ADMITTED_MINS: Record<
  string,
  { sat?: number; act?: number; gpa?: number }
> = {
  'Princeton University': { sat: 1450, act: 32, gpa: 3.7 },
  'Harvard University': { sat: 1450, act: 32, gpa: 3.7 },
  'Yale University': { sat: 1450, act: 32, gpa: 3.7 },
  'Stanford University': { sat: 1450, act: 32, gpa: 3.7 },
  'Massachusetts Institute of Technology': { sat: 1480, act: 33, gpa: 3.8 },
  'California Institute of Technology': { sat: 1500, act: 34, gpa: 3.9 },
  'Columbia University': { sat: 1450, act: 32, gpa: 3.7 },
  'University of Pennsylvania': { sat: 1450, act: 32, gpa: 3.7 },
  'Duke University': { sat: 1450, act: 32, gpa: 3.7 },
  'Northwestern University': { sat: 1420, act: 32, gpa: 3.7 },
  'Johns Hopkins University': { sat: 1420, act: 32, gpa: 3.7 },
};

interface Case {
  id: string;
  school: string;
  schoolEn: string;
  usNewsRank: number;
  year: number;
  result: string;
  round: string | null;
  major: string | null;
  gpa: string | null;
  sat: string | null;
  act: string | null;
  toefl: string | null;
  tags: string[];
  createdAt: string;
}

interface Issue {
  id: string;
  school: string;
  field: string;
  value: string | null;
  reason: string;
  suggestion: string;
}

function analyzeCase(c: Case): Issue[] {
  const issues: Issue[] = [];

  // 1. 检查申请轮次
  if (c.round) {
    const allowedRounds = SCHOOL_ROUND_RULES[c.schoolEn];
    if (allowedRounds && !allowedRounds.includes(c.round)) {
      issues.push({
        id: c.id,
        school: c.schoolEn,
        field: 'round',
        value: c.round,
        reason: `${c.schoolEn} 不提供 ${c.round} 轮次`,
        suggestion: `改为 ${allowedRounds.join(' 或 ')}`,
      });
    }
  }

  // 2. 检查 MIT 专业
  if (c.schoolEn === 'Massachusetts Institute of Technology' && c.major) {
    if (MIT_INVALID_MAJORS.includes(c.major)) {
      issues.push({
        id: c.id,
        school: c.schoolEn,
        field: 'major',
        value: c.major,
        reason: `MIT 本科不提供 ${c.major} 专业`,
        suggestion: '改为 EECS, Computer Science, Physics, Mathematics 等',
      });
    }
  }

  // 3. 检查 GPA 范围
  if (c.gpa) {
    const gpaValue = parseFloat(c.gpa.split('/')[0]);
    if (!isNaN(gpaValue)) {
      if (gpaValue < SCORE_RULES.GPA_MIN || gpaValue > SCORE_RULES.GPA_MAX) {
        issues.push({
          id: c.id,
          school: c.schoolEn,
          field: 'gpa',
          value: c.gpa,
          reason: `GPA ${gpaValue} 超出合理范围 [${SCORE_RULES.GPA_MIN}-${SCORE_RULES.GPA_MAX}]`,
          suggestion: '修正为合理范围内的值',
        });
      }
    }
  }

  // 4. 检查 SAT 范围
  if (c.sat) {
    const satValue = parseInt(c.sat);
    if (!isNaN(satValue)) {
      if (satValue < SCORE_RULES.SAT_MIN || satValue > SCORE_RULES.SAT_MAX) {
        issues.push({
          id: c.id,
          school: c.schoolEn,
          field: 'sat',
          value: c.sat,
          reason: `SAT ${satValue} 超出合理范围 [${SCORE_RULES.SAT_MIN}-${SCORE_RULES.SAT_MAX}]`,
          suggestion: '修正为合理范围内的值',
        });
      }
    }
  }

  // 5. 检查 ACT 范围
  if (c.act) {
    const actValue = parseInt(c.act);
    if (!isNaN(actValue)) {
      if (actValue < SCORE_RULES.ACT_MIN || actValue > SCORE_RULES.ACT_MAX) {
        issues.push({
          id: c.id,
          school: c.schoolEn,
          field: 'act',
          value: c.act,
          reason: `ACT ${actValue} 超出合理范围 [${SCORE_RULES.ACT_MIN}-${SCORE_RULES.ACT_MAX}]`,
          suggestion: '修正为合理范围内的值',
        });
      }
    }
  }

  // 6. 检查顶尖学校录取分数合理性
  if (c.result === 'ADMITTED') {
    const mins = TOP_SCHOOL_ADMITTED_MINS[c.schoolEn];
    if (mins) {
      if (c.sat && mins.sat) {
        const satValue = parseInt(c.sat);
        if (!isNaN(satValue) && satValue < mins.sat) {
          issues.push({
            id: c.id,
            school: c.schoolEn,
            field: 'sat',
            value: c.sat,
            reason: `录取 ${c.schoolEn} 但 SAT=${satValue} 低于典型录取下限 ${mins.sat}`,
            suggestion: `调高 SAT 或改为 REJECTED/WAITLISTED`,
          });
        }
      }
      if (c.act && mins.act) {
        const actValue = parseInt(c.act);
        if (!isNaN(actValue) && actValue < mins.act) {
          issues.push({
            id: c.id,
            school: c.schoolEn,
            field: 'act',
            value: c.act,
            reason: `录取 ${c.schoolEn} 但 ACT=${actValue} 低于典型录取下限 ${mins.act}`,
            suggestion: `调高 ACT 或改为 REJECTED/WAITLISTED`,
          });
        }
      }
      if (c.gpa && mins.gpa) {
        const gpaValue = parseFloat(c.gpa.split('/')[0]);
        if (!isNaN(gpaValue) && gpaValue < mins.gpa) {
          issues.push({
            id: c.id,
            school: c.schoolEn,
            field: 'gpa',
            value: c.gpa,
            reason: `录取 ${c.schoolEn} 但 GPA=${gpaValue} 低于典型录取下限 ${mins.gpa}`,
            suggestion: `调高 GPA 或改为 REJECTED/WAITLISTED`,
          });
        }
      }
    }
  }

  // 7. 检查年份合理性 (2020-2026 为合理范围)
  if (c.year < 2020 || c.year > 2030) {
    issues.push({
      id: c.id,
      school: c.schoolEn,
      field: 'year',
      value: String(c.year),
      reason: `年份 ${c.year} 超出合理范围 [2020-2030]`,
      suggestion: '修正为合理范围内的年份',
    });
  }

  return issues;
}

async function main() {
  const filePath = path.join(__dirname, 'top50-cases.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log('🔍 Top50 案例全量合理性分析\n');
  console.log(`总学校数: ${data.top50Count}`);
  console.log(`总案例数: ${data.caseCount}\n`);

  const allIssues: Issue[] = [];
  const issuesByType: Record<string, number> = {};
  const issuesBySchool: Record<string, number> = {};

  for (const c of data.cases as Case[]) {
    const issues = analyzeCase(c);
    allIssues.push(...issues);

    for (const issue of issues) {
      issuesByType[issue.field] = (issuesByType[issue.field] || 0) + 1;
      issuesBySchool[issue.school] = (issuesBySchool[issue.school] || 0) + 1;
    }
  }

  // 统计
  console.log('📊 异常统计:');
  console.log(`  总异常数: ${allIssues.length}`);
  console.log(
    `  异常率: ${((allIssues.length / data.caseCount) * 100).toFixed(1)}%\n`,
  );

  console.log('📋 按字段分类:');
  for (const [field, count] of Object.entries(issuesByType).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${field}: ${count}`);
  }

  console.log('\n🏫 按学校分类 (Top 10):');
  const sortedSchools = Object.entries(issuesBySchool)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [school, count] of sortedSchools) {
    console.log(`  ${school}: ${count}`);
  }

  // 输出详细异常
  const outputPath = path.join(__dirname, 'top50-issues-report.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        summary: {
          totalCases: data.caseCount,
          totalIssues: allIssues.length,
          issueRate:
            ((allIssues.length / data.caseCount) * 100).toFixed(1) + '%',
          byField: issuesByType,
          bySchool: issuesBySchool,
        },
        issues: allIssues,
      },
      null,
      2,
    ),
  );

  console.log(`\n📁 详细报告: ${outputPath}`);

  // 打印前 30 条异常示例
  console.log('\n🔎 异常示例 (前30条):');
  for (const issue of allIssues.slice(0, 30)) {
    console.log(`  [${issue.id.slice(-8)}] ${issue.school}`);
    console.log(`    ${issue.field}: ${issue.value}`);
    console.log(`    原因: ${issue.reason}`);
    console.log(`    建议: ${issue.suggestion}\n`);
  }
}

main().catch(console.error);
