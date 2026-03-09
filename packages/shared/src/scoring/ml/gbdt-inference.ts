/**
 * Gradient Boosted Decision Tree (GBDT) Inference Engine
 *
 * Pure TypeScript tree-walk inference for models trained in Python (LightGBM/XGBoost).
 * Loads JSON-serialized tree structure, walks each tree, sums leaf values, applies sigmoid.
 *
 * Training happens offline via Python script (apps/api/scripts/train_gbdt.py).
 * This module is inference-only — no Python runtime dependency in production.
 */

// ============================================
// Types
// ============================================

export interface TreeNode {
  /** Feature index to split on (-1 for leaf nodes) */
  featureIndex: number;
  /** Split threshold value */
  threshold: number;
  /** Index of left child node (feature <= threshold) */
  leftChild: number;
  /** Index of right child node (feature > threshold) */
  rightChild: number;
  /** Leaf value (only set for leaf nodes where featureIndex === -1) */
  leafValue?: number;
}

export interface DecisionTree {
  nodes: TreeNode[];
}

export interface GBDTModel {
  modelType: 'gbdt';
  trees: DecisionTree[];
  learningRate: number;
  baseScore: number;
  featureNames: string[];
  featureMedians: Record<string, number>;
  featureStds: Record<string, number>;
  metadata: {
    tier: number;
    trainSamples: number;
    valSamples: number;
    metrics: {
      auc: number;
      brierScore: number;
      logLoss: number;
      ece: number;
      accuracy: number;
    };
    trainedAt: string;
    numTrees: number;
    maxDepth: number;
    selectivityBand?: string;
  };
}

// ============================================
// Inference
// ============================================

/**
 * Predict admission probability using a GBDT model.
 *
 * Algorithm:
 * 1. Start with baseScore (log-odds prior)
 * 2. For each tree: walk from root to leaf, accumulate leaf value * learningRate
 * 3. Apply sigmoid to convert log-odds to probability
 * 4. Clamp to [0.05, 0.95]
 */
export function predictGBDT(model: GBDTModel, features: number[]): number {
  let logOdds = model.baseScore;

  for (const tree of model.trees) {
    logOdds += model.learningRate * walkTree(tree, features);
  }

  const probability = sigmoid(logOdds);
  return Math.max(0.05, Math.min(0.95, probability));
}

/**
 * Batch prediction for multiple feature vectors.
 */
export function predictGBDTBatch(model: GBDTModel, X: number[][]): number[] {
  return X.map((x) => predictGBDT(model, x));
}

/**
 * Get per-tree predictions for debugging/analysis.
 */
export function getTreePredictions(model: GBDTModel, features: number[]): number[] {
  return model.trees.map((tree) => model.learningRate * walkTree(tree, features));
}

// ============================================
// Tree Walk
// ============================================

/**
 * Walk a single decision tree from root to leaf.
 * Returns the leaf value.
 */
function walkTree(tree: DecisionTree, features: number[]): number {
  let nodeIdx = 0;

  while (nodeIdx < tree.nodes.length) {
    const node = tree.nodes[nodeIdx];

    // Leaf node
    if (node.featureIndex === -1 || node.leafValue != null) {
      return node.leafValue ?? 0;
    }

    // Internal node: go left if feature <= threshold, right otherwise
    const featureValue = features[node.featureIndex] ?? 0;
    if (featureValue <= node.threshold) {
      nodeIdx = node.leftChild;
    } else {
      nodeIdx = node.rightChild;
    }
  }

  // Should not reach here, but return 0 as safety
  return 0;
}

// ============================================
// Model Validation
// ============================================

/**
 * Validate a GBDT model JSON structure before use.
 * Returns true if the model is structurally valid.
 */
export function validateGBDTModel(model: unknown): model is GBDTModel {
  if (model == null || typeof model !== 'object') return false;

  const m = model as Record<string, unknown>;
  if (m.modelType !== 'gbdt') return false;
  if (!Array.isArray(m.trees)) return false;
  if (typeof m.learningRate !== 'number') return false;
  if (typeof m.baseScore !== 'number') return false;
  if (!Array.isArray(m.featureNames)) return false;

  // Validate each tree
  for (const tree of m.trees as unknown[]) {
    if (tree == null || typeof tree !== 'object') return false;
    const t = tree as Record<string, unknown>;
    if (!Array.isArray(t.nodes)) return false;

    for (const node of t.nodes as unknown[]) {
      if (node == null || typeof node !== 'object') return false;
      const n = node as Record<string, unknown>;
      if (typeof n.featureIndex !== 'number') return false;
      if (typeof n.threshold !== 'number') return false;
    }
  }

  return true;
}

// ============================================
// Helpers
// ============================================

function sigmoid(z: number): number {
  if (z > 500) return 1;
  if (z < -500) return 0;
  return 1 / (1 + Math.exp(-z));
}
