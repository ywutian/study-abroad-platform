/**
 * L2-Regularized Logistic Regression
 *
 * Pure TypeScript implementation with mini-batch SGD, early stopping,
 * and stratified train/val split. No external ML dependencies.
 *
 * Used for Tier 2-3 prediction models.
 */

// ============================================
// Types
// ============================================

export interface LRConfig {
  learningRate: number;
  l2Lambda: number;
  maxIterations: number;
  batchSize: number;
  earlyStopPatience: number;
  convergenceTol: number;
}

export interface EvaluationMetrics {
  auc: number;
  brierScore: number;
  logLoss: number;
  ece: number;
  accuracy: number;
}

export interface TrainedModel {
  modelType: 'logistic_regression' | 'platt' | 'gbdt';
  weights: number[];
  bias: number;
  featureNames: string[];
  featureMedians: Record<string, number>;
  featureStds: Record<string, number>;
  metadata: {
    tier: number;
    trainSamples: number;
    valSamples: number;
    metrics: EvaluationMetrics;
    trainedAt: string;
    convergenceEpoch: number;
    selectivityBand?: string;
  };
}

export const DEFAULT_LR_CONFIG: LRConfig = {
  learningRate: 0.01,
  l2Lambda: 0.1,
  maxIterations: 1000,
  batchSize: 32,
  earlyStopPatience: 10,
  convergenceTol: 1e-6,
};

// ============================================
// Training
// ============================================

/**
 * Train an L2-regularized logistic regression model.
 *
 * Algorithm: mini-batch SGD with early stopping on validation log-loss.
 * Stratified 80/20 split ensures proportional class representation.
 */
export function trainLogisticRegression(
  X: number[][],
  y: number[],
  featureNames: string[],
  featureMedians: Record<string, number>,
  config: Partial<LRConfig> = {}
): TrainedModel {
  const cfg = { ...DEFAULT_LR_CONFIG, ...config };
  const N = X.length;
  const D = X[0].length;

  if (N < 10) throw new Error(`Insufficient data: ${N} samples (min 10)`);
  if (D !== featureNames.length)
    throw new Error(`Feature count mismatch: ${D} vs ${featureNames.length}`);

  // Stratified train/val split (80/20)
  const { trainIdx, valIdx } = stratifiedSplit(y, 0.2);
  const Xtrain = trainIdx.map((i) => X[i]);
  const ytrain = trainIdx.map((i) => y[i]);
  const Xval = valIdx.map((i) => X[i]);
  const yval = valIdx.map((i) => y[i]);

  // Compute feature standard deviations for reporting
  const featureStds: Record<string, number> = {};
  for (let j = 0; j < D; j++) {
    const vals = Xtrain.map((row) => row[j]);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    featureStds[featureNames[j]] = Math.sqrt(variance);
  }

  // Initialize weights
  const w = new Array(D).fill(0);
  let b = 0;
  let bestW = [...w];
  let bestB = b;
  let bestValLoss = Infinity;
  let patience = 0;
  let convergenceEpoch = 0;

  for (let epoch = 0; epoch < cfg.maxIterations; epoch++) {
    // Shuffle training data
    const shuffled = shuffleIndices(Xtrain.length);

    // Mini-batch gradient descent
    for (let start = 0; start < Xtrain.length; start += cfg.batchSize) {
      const end = Math.min(start + cfg.batchSize, Xtrain.length);
      const batchSize = end - start;

      // Accumulate gradients
      const gradW = new Array(D).fill(0);
      let gradB = 0;

      for (let bi = start; bi < end; bi++) {
        const idx = shuffled[bi];
        const x = Xtrain[idx];
        const label = ytrain[idx];

        // Forward: z = w·x + b, p = sigmoid(z)
        let z = b;
        for (let j = 0; j < D; j++) z += w[j] * x[j];
        const p = sigmoid(z);

        // Error
        const error = p - label;
        for (let j = 0; j < D; j++) {
          gradW[j] += error * x[j];
        }
        gradB += error;
      }

      // Update with L2 regularization
      for (let j = 0; j < D; j++) {
        w[j] -= cfg.learningRate * (gradW[j] / batchSize + cfg.l2Lambda * w[j]);
      }
      b -= cfg.learningRate * (gradB / batchSize);
    }

    // Validation loss
    const valLoss =
      computeLogLossInternal(Xval, yval, w, b) +
      0.5 * cfg.l2Lambda * w.reduce((s, v) => s + v * v, 0);

    if (valLoss < bestValLoss - cfg.convergenceTol) {
      bestValLoss = valLoss;
      bestW = [...w];
      bestB = b;
      convergenceEpoch = epoch;
      patience = 0;
    } else {
      patience++;
      if (patience >= cfg.earlyStopPatience) break;
    }
  }

  // Compute evaluation metrics on validation set
  const valPreds = Xval.map((x) => predictSingle(bestW, bestB, x));
  const metrics = computeAllMetrics(valPreds, yval);

  return {
    modelType: 'logistic_regression',
    weights: bestW,
    bias: bestB,
    featureNames,
    featureMedians,
    featureStds,
    metadata: {
      tier: 2,
      trainSamples: Xtrain.length,
      valSamples: Xval.length,
      metrics,
      trainedAt: new Date().toISOString(),
      convergenceEpoch,
    },
  };
}

/**
 * Train Platt calibration parameters (Tier 1).
 * Maps existing heuristic probability → calibrated probability via sigmoid(a*p + b).
 */
export function trainPlattCalibration(
  heuristicProbs: number[],
  labels: number[],
  config: Partial<LRConfig> = {}
): TrainedModel {
  // Platt calibration = 1D logistic regression on heuristic probability
  const X = heuristicProbs.map((p) => [p]);
  return trainLogisticRegression(
    X,
    labels,
    ['heuristicProb'],
    { heuristicProb: 0.4 },
    { ...config, l2Lambda: 0.01 } // Light regularization for 2-param model
  );
}

// ============================================
// Inference
// ============================================

/**
 * Predict admission probability from a trained model and feature array.
 * Returns sigmoid(w^T * x + b), clamped to [0.05, 0.95].
 */
export function predict(model: TrainedModel, features: number[]): number {
  const p = predictSingle(model.weights, model.bias, features);
  return Math.max(0.05, Math.min(0.95, p));
}

/**
 * Batch prediction for multiple feature vectors.
 */
export function predictBatch(model: TrainedModel, X: number[][]): number[] {
  return X.map((x) => predict(model, x));
}

// ============================================
// Internal Utilities
// ============================================

function sigmoid(z: number): number {
  if (z > 500) return 1;
  if (z < -500) return 0;
  return 1 / (1 + Math.exp(-z));
}

function predictSingle(weights: number[], bias: number, x: number[]): number {
  let z = bias;
  for (let j = 0; j < weights.length; j++) {
    z += weights[j] * (x[j] ?? 0);
  }
  return sigmoid(z);
}

function computeLogLossInternal(X: number[][], y: number[], w: number[], b: number): number {
  let totalLoss = 0;
  const eps = 1e-7;
  for (let i = 0; i < X.length; i++) {
    const p = Math.max(eps, Math.min(1 - eps, predictSingle(w, b, X[i])));
    totalLoss += -(y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p));
  }
  return totalLoss / X.length;
}

function computeAllMetrics(predictions: number[], labels: number[]): EvaluationMetrics {
  // Import-free implementations (same algorithms as metrics.ts but inline for no circular dep)
  const n = predictions.length;
  const eps = 1e-7;

  // Log Loss
  let logLoss = 0;
  for (let i = 0; i < n; i++) {
    const p = Math.max(eps, Math.min(1 - eps, predictions[i]));
    logLoss += -(labels[i] * Math.log(p) + (1 - labels[i]) * Math.log(1 - p));
  }
  logLoss /= n;

  // Brier Score
  let brier = 0;
  for (let i = 0; i < n; i++) {
    brier += (predictions[i] - labels[i]) ** 2;
  }
  brier /= n;

  // AUC-ROC (sort-and-sweep)
  const pairs = predictions.map((p, i) => ({ p, y: labels[i] }));
  pairs.sort((a, b) => b.p - a.p);
  let tp = 0,
    fp = 0;
  const totalPos = labels.filter((y) => y === 1).length;
  const totalNeg = n - totalPos;
  let auc = 0;
  let prevFpr = 0;
  let prevTpr = 0;
  for (const { y } of pairs) {
    if (y === 1) tp++;
    else fp++;
    const tpr = totalPos > 0 ? tp / totalPos : 0;
    const fpr = totalNeg > 0 ? fp / totalNeg : 0;
    auc += ((fpr - prevFpr) * (tpr + prevTpr)) / 2; // trapezoidal
    prevFpr = fpr;
    prevTpr = tpr;
  }

  // ECE (10 bins)
  const bins = 10;
  const binCounts = new Array(bins).fill(0);
  const binCorrect = new Array(bins).fill(0);
  const binConfidence = new Array(bins).fill(0);
  for (let i = 0; i < n; i++) {
    const bin = Math.min(Math.floor(predictions[i] * bins), bins - 1);
    binCounts[bin]++;
    binCorrect[bin] += labels[i];
    binConfidence[bin] += predictions[i];
  }
  let ece = 0;
  for (let b = 0; b < bins; b++) {
    if (binCounts[b] > 0) {
      const accuracy = binCorrect[b] / binCounts[b];
      const confidence = binConfidence[b] / binCounts[b];
      ece += (binCounts[b] / n) * Math.abs(accuracy - confidence);
    }
  }

  // Accuracy (threshold 0.5)
  let correct = 0;
  for (let i = 0; i < n; i++) {
    const pred = predictions[i] >= 0.5 ? 1 : 0;
    if (pred === labels[i]) correct++;
  }
  const accuracy = correct / n;

  return { auc, brierScore: brier, logLoss, ece, accuracy };
}

/**
 * Stratified train/val split ensuring proportional class representation.
 */
export function stratifiedSplit(
  labels: number[],
  valRatio: number
): { trainIdx: number[]; valIdx: number[] } {
  const posIdx: number[] = [];
  const negIdx: number[] = [];

  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === 1) posIdx.push(i);
    else negIdx.push(i);
  }

  // Shuffle each class
  shuffleArray(posIdx);
  shuffleArray(negIdx);

  const posValCount = Math.max(1, Math.round(posIdx.length * valRatio));
  const negValCount = Math.max(1, Math.round(negIdx.length * valRatio));

  const valIdx = [...posIdx.slice(0, posValCount), ...negIdx.slice(0, negValCount)];
  const trainIdx = [...posIdx.slice(posValCount), ...negIdx.slice(negValCount)];

  return { trainIdx, valIdx };
}

/**
 * Stratified k-fold cross-validation splits.
 */
export function stratifiedKFold(
  labels: number[],
  k: number
): Array<{ trainIdx: number[]; valIdx: number[] }> {
  const posIdx: number[] = [];
  const negIdx: number[] = [];

  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === 1) posIdx.push(i);
    else negIdx.push(i);
  }

  shuffleArray(posIdx);
  shuffleArray(negIdx);

  const folds: Array<{ trainIdx: number[]; valIdx: number[] }> = [];

  for (let fold = 0; fold < k; fold++) {
    const posValStart = Math.floor((posIdx.length * fold) / k);
    const posValEnd = Math.floor((posIdx.length * (fold + 1)) / k);
    const negValStart = Math.floor((negIdx.length * fold) / k);
    const negValEnd = Math.floor((negIdx.length * (fold + 1)) / k);

    const valIdx = [
      ...posIdx.slice(posValStart, posValEnd),
      ...negIdx.slice(negValStart, negValEnd),
    ];
    const trainIdx = [
      ...posIdx.slice(0, posValStart),
      ...posIdx.slice(posValEnd),
      ...negIdx.slice(0, negValStart),
      ...negIdx.slice(negValEnd),
    ];

    folds.push({ trainIdx, valIdx });
  }

  return folds;
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function shuffleIndices(n: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  shuffleArray(idx);
  return idx;
}
