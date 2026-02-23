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
 * 归一化 GPA 到 4.0 制
 * 支持 4.0, 5.0, 100 分制
 */
export function normalizeGpa(gpa: number, scale: number): number {
  if (scale === 4.0) return gpa;
  if (scale === 5.0) return (gpa / 5.0) * 4.0;
  if (scale === 100) return (gpa / 100) * 4.0;
  return gpa;
}
