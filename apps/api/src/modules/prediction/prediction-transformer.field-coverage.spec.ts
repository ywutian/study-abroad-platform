/**
 * Regression guard — "dead-wire" bug class in the counselor prediction pipeline.
 *
 * THE BUG CLASS (recurred ≥2× as the literal same class):
 *   The counselor engine reads a field off its typed input object
 *   (e.g. `school.yieldRate`, `profile.stateOfResidence`), but the input
 *   TRANSFORMER (`schoolToInput` / `profileToInput`) never maps that field
 *   from the Prisma row / profile. The field is therefore permanently
 *   `undefined` at runtime, and the engine branch that reads it is silently
 *   unreachable dead code. TypeScript does NOT catch this because every input
 *   field is optional — `school.yieldRate` is a legal read whether or not the
 *   transformer ever assigns it.
 *
 *   Historical instances (both now wired):
 *     - e3b98c62  `yieldRate` dead-wire        (roundMultiplier yield-informed ED)
 *     - 9e9a044b  `stateOfResidence` dead-wire (geoMultiplier in-state preference)
 *
 * WHAT THIS GUARD DOES:
 *   Statically (via ts-morph AST + the TS type checker — no DB, no runtime):
 *     1. ENGINE-READ set  — every `<obj>.<field>` access in the counselor engine
 *        files where `<obj>` is typed `ProfileInput` or `SchoolInput`. The
 *        identifier's *declaration type-node text* is used to classify it, which
 *        is robust to the `SchoolInput & { ... }` intersection shapes the engine
 *        functions use (the type node still literally contains `SchoolInput`).
 *     2. TRANSFORMER-MAPPED set — the keys of the object literal each
 *        `*ToInput()` returns (the producer of those input objects).
 *     3. Assert: every engine-read field that is a real interface member is
 *        mapped by the corresponding transformer (minus a small, *documented*
 *        allow/known list). Any unmapped engine-read field is a dead-wire.
 *
 *   Scope is restricted to fields that are genuine members of the
 *   `ProfileInput` / `SchoolInput` interfaces — i.e. exactly the input objects
 *   the transformer owns and is responsible for populating. Engine reads of
 *   non-member fields (none today) are out of scope by construction.
 */

import * as path from 'path';
import {
  Node,
  Project,
  SyntaxKind,
  type Identifier,
  type TypeNode,
} from 'ts-morph';

// Repo paths — resolved relative to this spec so the test is CWD-independent.
// .../apps/api/src/modules/prediction → repo root is 5 levels up.
const REPO_ROOT = path.resolve(__dirname, '../../../../../');
const API_TSCONFIG = path.join(REPO_ROOT, 'apps/api/tsconfig.json');

const PREDICTION_DIR = path.join(REPO_ROOT, 'apps/api/src/modules/prediction');

const TYPES_FILE = path.join(PREDICTION_DIR, 'prediction.prompts.ts');
const TRANSFORMER_FILE = path.join(
  PREDICTION_DIR,
  'prediction-transformer.service.ts',
);

/**
 * Files where the counselor engine CONSUMES the input objects. Every
 * `profile.<x>` / `school.<x>` read in these files is a potential dead-wire if
 * the transformer never maps `<x>`.
 */
const ENGINE_CONSUMER_FILES = [
  path.join(PREDICTION_DIR, 'counselor/counselor-modifiers.ts'),
  path.join(PREDICTION_DIR, 'counselor/counselor-engine.service.ts'),
  path.join(PREDICTION_DIR, 'counselor/anchor-resolver.service.ts'),
];

type InputKind = 'ProfileInput' | 'SchoolInput';

/**
 * Fields the engine reads but the transformer intentionally does NOT map,
 * with the reason each is legitimate. These are NOT dead-wires.
 */
const ALLOWLIST: Record<InputKind, Record<string, string>> = {
  ProfileInput: {},
  SchoolInput: {
    // Per-school application round (RD/ED/EA). NOT a School column — one user
    // applies to many schools in different rounds, so the route/service layer
    // sets `schoolInput.applicationRound` per application before calling
    // compute(). schoolToInput() deliberately leaves it unset (see
    // counselor-engine.service.ts compute(): "ProfileInput doesn't carry
    // applicationRound — that's a per-school attribute").
    applicationRound: 'set per-application by the caller, not by schoolToInput',
  },
};

/**
 * KNOWN, CURRENTLY-OPEN dead-wires — quarantined so this guard can ship green
 * while still documenting the live bug loudly. These are genuine instances of
 * the bug class that are NOT yet fixed in the transformer (fixing them is out
 * of scope for the guard PR, which may only add this spec file).
 *
 * Each entry is asserted to STILL be a real dead-wire below — so when someone
 * finally wires the field in the transformer, THIS TEST FAILS and forces them
 * to delete the quarantine entry. The quarantine can never silently rot into a
 * permanent exception.
 */
const KNOWN_DEAD_WIRES: Record<InputKind, Record<string, string>> = {
  ProfileInput: {},
  // inStateAcceptanceRate was quarantined here (#316 mapped it into
  // extractSchoolMetrics, not schoolToInput) and is now FIXED — schoolToInput
  // maps it, so the data-grounded geoMultiplier in-state branch is live. Empty =
  // zero tolerated dead-wires.
  SchoolInput: {},
};

interface Extracted {
  /** Engine-read field name -> kind, restricted to real interface members. */
  engineReads: Record<InputKind, Set<string>>;
  /** Transformer-mapped field names per *ToInput return object literal. */
  transformerMapped: Record<InputKind, Set<string>>;
  /** Declared interface members (the transformer-owned field universe). */
  interfaceMembers: Record<InputKind, Set<string>>;
  /** Engine reads that are NOT interface members (out of scope; surfaced for transparency). */
  nonMemberReads: Record<InputKind, Set<string>>;
}

/**
 * Build the ts-morph project once and extract all three field sets. This is the
 * single source of truth the assertions below consume.
 */
function extract(): Extracted {
  const project = new Project({
    tsConfigFilePath: API_TSCONFIG,
    // We add exactly the files we need (+ their resolved deps) instead of the
    // whole tsconfig graph — keeps the type checker fast for a unit test.
    skipAddingFilesFromTsConfig: true,
  });

  const typesSf = project.addSourceFileAtPath(TYPES_FILE);
  const transformerSf = project.addSourceFileAtPath(TRANSFORMER_FILE);
  const engineSfs = ENGINE_CONSUMER_FILES.map((f) =>
    project.addSourceFileAtPath(f),
  );
  // Pull in imported declarations so the type checker can resolve the parameter
  // types (ProfileInput/SchoolInput) of the engine functions.
  project.resolveSourceFileDependencies();

  // ── Interface members (the field universe the transformer owns) ───────────
  const interfaceMembers: Record<InputKind, Set<string>> = {
    ProfileInput: new Set(
      typesSf
        .getInterfaceOrThrow('ProfileInput')
        .getProperties()
        .map((p) => p.getName()),
    ),
    SchoolInput: new Set(
      typesSf
        .getInterfaceOrThrow('SchoolInput')
        .getProperties()
        .map((p) => p.getName()),
    ),
  };

  // ── Transformer-mapped keys (the producer side) ───────────────────────────
  const transformerClass = transformerSf.getClassOrThrow(
    'PredictionTransformerService',
  );

  const mappedKeysOf = (methodName: string): Set<string> => {
    const method = transformerClass.getMethodOrThrow(methodName);
    const keys = new Set<string>();
    let sawObjectLiteralReturn = false;
    for (const ret of method.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
      const expr = ret.getExpression();
      if (!expr || !Node.isObjectLiteralExpression(expr)) continue;
      sawObjectLiteralReturn = true;
      for (const prop of expr.getProperties()) {
        if (
          Node.isPropertyAssignment(prop) ||
          Node.isShorthandPropertyAssignment(prop)
        ) {
          keys.add(prop.getName());
        } else if (Node.isSpreadAssignment(prop)) {
          // A spread (e.g. `...rawSchool`) could opaquely carry arbitrary
          // fields and would defeat static dead-wire detection. The current
          // transformers don't use one; fail loudly if that changes so the
          // guard is re-validated rather than silently weakened.
          throw new Error(
            `${methodName} uses a spread in its returned object literal; ` +
              `static field-coverage extraction can no longer see every mapped ` +
              `field. Re-validate this guard's extraction strategy.`,
          );
        }
      }
    }
    if (!sawObjectLiteralReturn) {
      throw new Error(
        `${methodName} has no object-literal return; the field-coverage guard ` +
          `cannot determine which input fields it maps. Extraction needs review.`,
      );
    }
    return keys;
  };

  const transformerMapped: Record<InputKind, Set<string>> = {
    ProfileInput: mappedKeysOf('profileToInput'),
    SchoolInput: mappedKeysOf('schoolToInput'),
  };

  // ── Engine reads (the consumer side) ──────────────────────────────────────
  //
  // Classify each `<id>.<field>` by the *declaration type-node text* of `<id>`.
  // Using the declaration's written type node (not the resolved structural
  // type) is what makes this robust to the engine's `SchoolInput & { ... }`
  // intersection params: the node text still literally contains `SchoolInput`,
  // and never structurally collapses ProfileInput/SchoolInput together.
  const classifyIdentifier = (id: Identifier): InputKind | null => {
    const symbol = id.getSymbol();
    if (!symbol) return null;
    let referencesProfile = false;
    let referencesSchool = false;
    for (const decl of symbol.getDeclarations()) {
      const typeNode = getDeclaredTypeNode(decl);
      if (!typeNode) continue;
      const text = typeNode.getText();
      if (/\bProfileInput\b/.test(text)) referencesProfile = true;
      if (/\bSchoolInput\b/.test(text)) referencesSchool = true;
    }
    // Exactly-one wins; an ambiguous identifier that names both is skipped
    // (there are none today, asserted in the test below).
    if (referencesProfile && !referencesSchool) return 'ProfileInput';
    if (referencesSchool && !referencesProfile) return 'SchoolInput';
    return null;
  };

  const rawReads: Record<InputKind, Set<string>> = {
    ProfileInput: new Set(),
    SchoolInput: new Set(),
  };

  for (const sf of engineSfs) {
    for (const pa of sf.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression,
    )) {
      const objExpr = pa.getExpression();
      if (!Node.isIdentifier(objExpr)) continue;
      const kind = classifyIdentifier(objExpr);
      if (!kind) continue;
      rawReads[kind].add(pa.getName());
    }
  }

  // Split engine reads into (in-scope = real interface members) and
  // (out-of-scope = not a member, e.g. a field declared only on an inline
  // intersection extension). Only in-scope reads can be dead-wires.
  const engineReads: Record<InputKind, Set<string>> = {
    ProfileInput: new Set(),
    SchoolInput: new Set(),
  };
  const nonMemberReads: Record<InputKind, Set<string>> = {
    ProfileInput: new Set(),
    SchoolInput: new Set(),
  };
  for (const kind of ['ProfileInput', 'SchoolInput'] as InputKind[]) {
    for (const field of rawReads[kind]) {
      if (interfaceMembers[kind].has(field)) engineReads[kind].add(field);
      else nonMemberReads[kind].add(field);
    }
  }

  return { engineReads, transformerMapped, interfaceMembers, nonMemberReads };
}

/**
 * Return the explicitly-written type node of a declaration, when it carries
 * one. Used to classify an identifier by the *text* of its declared type
 * (robust to `SchoolInput & { ... }` intersections), rather than its resolved
 * structural type.
 */
function getDeclaredTypeNode(decl: Node): TypeNode | undefined {
  if (
    Node.isParameterDeclaration(decl) ||
    Node.isVariableDeclaration(decl) ||
    Node.isPropertyDeclaration(decl) ||
    Node.isPropertySignature(decl)
  ) {
    return decl.getTypeNode();
  }
  return undefined;
}

describe('prediction transformer field coverage (dead-wire guard)', () => {
  // Extraction touches the TS type checker once; give it generous headroom.
  jest.setTimeout(60_000);

  let extracted: Extracted;

  beforeAll(() => {
    extracted = extract();
  });

  it('extracts a non-trivial engine-read set for both inputs (sanity)', () => {
    // If extraction silently returns nothing (e.g. a refactor moved the files
    // or the type checker failed), the dead-wire assertions below would vacuously
    // pass. Guard against that with explicit floors anchored to today's reality.
    expect(extracted.engineReads.SchoolInput.size).toBeGreaterThanOrEqual(20);
    expect(extracted.engineReads.ProfileInput.size).toBeGreaterThanOrEqual(15);

    // The two historical dead-wire fields must be present as engine reads AND
    // mapped by the transformer — i.e. the original bugs stay fixed.
    expect(extracted.engineReads.SchoolInput.has('yieldRate')).toBe(true);
    expect(extracted.transformerMapped.SchoolInput.has('yieldRate')).toBe(true);
    expect(extracted.engineReads.ProfileInput.has('stateOfResidence')).toBe(
      true,
    );
    expect(
      extracted.transformerMapped.ProfileInput.has('stateOfResidence'),
    ).toBe(true);
  });

  it('has no engine reads of non-interface fields (extraction scope sanity)', () => {
    // Today every engine `profile.x`/`school.x` read resolves to a real
    // interface member. If this ever changes, the field-coverage scope (member
    // intersection) needs a conscious revisit — surface it rather than hide it.
    expect([...extracted.nonMemberReads.ProfileInput]).toEqual([]);
    expect([...extracted.nonMemberReads.SchoolInput]).toEqual([]);
  });

  for (const kind of ['ProfileInput', 'SchoolInput'] as InputKind[]) {
    const toInput =
      kind === 'ProfileInput' ? 'profileToInput' : 'schoolToInput';

    it(`every engine-read ${kind} field is mapped by ${toInput}() (no NEW dead-wires)`, () => {
      const reads = extracted.engineReads[kind];
      const mapped = extracted.transformerMapped[kind];
      const allow = ALLOWLIST[kind];
      const known = KNOWN_DEAD_WIRES[kind];

      const deadWires = [...reads]
        .filter((field) => !mapped.has(field))
        .filter((field) => !(field in allow))
        .filter((field) => !(field in known))
        .sort();

      expect({
        deadWires,
        explanation:
          deadWires.length === 0
            ? 'ok'
            : `${toInput}() never assigns these fields, but the counselor engine ` +
              `reads them off ${kind} — they are permanently undefined at runtime ` +
              `(silent dead code). Map each one in ${toInput}(), e.g. ` +
              `captureField('<field>', (school as any).<field>, ...). If a field is ` +
              `legitimately set elsewhere, add it to ALLOWLIST.${kind} with a reason.`,
      }).toEqual({ deadWires: [], explanation: 'ok' });
    });

    it(`every KNOWN_DEAD_WIRES.${kind} entry is still genuinely unmapped (no stale quarantine)`, () => {
      const mapped = extracted.transformerMapped[kind];
      const reads = extracted.engineReads[kind];
      const stale: string[] = [];
      for (const field of Object.keys(KNOWN_DEAD_WIRES[kind])) {
        // A quarantine entry is stale if the field is now mapped (bug fixed) OR
        // the engine no longer reads it (branch removed). Either way it must be
        // removed from KNOWN_DEAD_WIRES.
        if (mapped.has(field) || !reads.has(field)) stale.push(field);
      }
      expect({
        stale,
        explanation:
          stale.length === 0
            ? 'ok'
            : `These KNOWN_DEAD_WIRES.${kind} entries are no longer dead-wires ` +
              `(now mapped, or no longer read). Delete them from KNOWN_DEAD_WIRES ` +
              `so the guard fails closed instead of carrying a permanent exception.`,
      }).toEqual({ stale: [], explanation: 'ok' });
    });

    it(`every ALLOWLIST.${kind} entry is still actually read by the engine (no stale allowlist)`, () => {
      const reads = extracted.engineReads[kind];
      const stale = Object.keys(ALLOWLIST[kind]).filter(
        (field) => !reads.has(field),
      );
      expect(stale).toEqual([]);
    });
  }
});
