/**
 * Statistical & Mathematical Utilities for Scoring
 */

/**
 * 标准正态分布 CDF（Abramowitz & Stegun 近似）
 * 精度 < 1e-5，无外部依赖
 */
export function normalCDF(z: number): number {
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741;
  const a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/**
 * 根据学校 25th/75th 百分位数据，计算学生分数在录取学生中的百分位
 * 假设分布近似正态，用 IQR 反推标准差
 */
export function calculatePercentile(studentScore: number, p25: number, p75: number): number {
  if (p75 <= p25) return 0.5;
  const mu = (p25 + p75) / 2;
  const sigma = (p75 - p25) / (2 * 0.6745);
  const z = (studentScore - mu) / sigma;
  return normalCDF(z);
}

/**
 * 经验百分位：学生成绩在已排序数组中的百分位
 * 使用二分查找定位位置
 */
export function empiricalPercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0.5;
  if (value <= sortedValues[0]) return 0;
  if (value >= sortedValues[sortedValues.length - 1]) return 1;

  let low = 0;
  let high = sortedValues.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sortedValues[mid] < value) low = mid + 1;
    else high = mid;
  }
  return low / sortedValues.length;
}

/**
 * 解析 "1500-1550" 格式的 range 字符串，返回中位数
 */
export function parseRange(range: string): number | null {
  const match = range.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return (parseFloat(match[1]) + parseFloat(match[2])) / 2;
}

/**
 * Non-linear GPA normalization by named grading system (WES-style piecewise mappings).
 * Result is always clamped to [0.0, 4.0].
 */
export function normalizeBySystem(gpa: number, gpaSystem: string): number {
  let result: number;

  switch (gpaSystem) {
    case 'SCALE_4_UW':
      result = gpa;
      break;

    case 'SCALE_4_W':
      result = Math.min((gpa / 5.0) * 4.0, 4.0);
      break;

    case 'SCALE_5':
      result = (gpa / 5.0) * 4.0;
      break;

    case 'PCT_100':
      if (gpa >= 95) result = 4.0;
      else if (gpa >= 90) result = 3.7 + ((gpa - 90) / 5) * 0.3;
      else if (gpa >= 85) result = 3.3 + ((gpa - 85) / 5) * 0.4;
      else if (gpa >= 80) result = 3.0 + ((gpa - 80) / 5) * 0.3;
      else if (gpa >= 75) result = 2.7 + ((gpa - 75) / 5) * 0.3;
      else if (gpa >= 70) result = 2.3 + ((gpa - 70) / 5) * 0.4;
      else result = 2.0;
      break;

    case 'IB_45':
      if (gpa >= 42) result = 4.0;
      else if (gpa >= 38) result = 3.7 + ((gpa - 38) / 4) * 0.3;
      else if (gpa >= 35) result = 3.3 + ((gpa - 35) / 3) * 0.4;
      else if (gpa >= 30) result = 3.0 + ((gpa - 30) / 5) * 0.3;
      else if (gpa >= 24) result = 2.5 + ((gpa - 24) / 6) * 0.5;
      else result = 2.0;
      break;

    case 'A_LEVEL': {
      // Input: numeric 1-6 (6=A*, 5=A, 4=B, 3=C, 2=D, 1=E)
      // Linear interpolation between defined points
      const points: [number, number][] = [
        [1, 1.3],
        [2, 2.0],
        [3, 2.7],
        [4, 3.3],
        [5, 3.7],
        [6, 4.0],
      ];

      if (gpa <= points[0][0]) {
        result = points[0][1];
      } else if (gpa >= points[points.length - 1][0]) {
        result = points[points.length - 1][1];
      } else {
        // Find the two surrounding points and interpolate
        let lower = points[0];
        let upper = points[1];
        for (let i = 1; i < points.length; i++) {
          if (gpa <= points[i][0]) {
            lower = points[i - 1];
            upper = points[i];
            break;
          }
        }
        const t = (gpa - lower[0]) / (upper[0] - lower[0]);
        result = lower[1] + t * (upper[1] - lower[1]);
      }
      break;
    }

    default:
      result = gpa;
      break;
  }

  return Math.max(0.0, Math.min(4.0, result));
}

/**
 * 归一化 GPA 到 4.0 制
 * 支持 4.0, 5.0, 100 分制
 * 可选 gpaSystem 参数启用非线性分段映射（WES 标准）
 */
export function normalizeGpa(gpa: number, scale: number, gpaSystem?: string): number {
  if (gpaSystem) {
    return normalizeBySystem(gpa, gpaSystem);
  }
  if (scale === 4.0) return gpa;
  if (scale === 5.0) return (gpa / 5.0) * 4.0;
  if (scale === 100) return (gpa / 100) * 4.0;
  return gpa;
}
