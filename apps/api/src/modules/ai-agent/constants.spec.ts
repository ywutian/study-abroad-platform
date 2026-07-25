import {
  MODEL_CATALOG,
  UNKNOWN_MODEL_PRICING,
  estimateModelCost,
} from './constants';

describe('MODEL_CATALOG / estimateModelCost', () => {
  const ONE_MILLION = 1_000_000;

  it('prices the model prod actually runs at its published rate', () => {
    // gpt-5.4-mini is $0.75/1M in, $4.50/1M out (OpenAI, verified 2026-07-24).
    const { cost, known } = estimateModelCost(
      'gpt-5.4-mini',
      ONE_MILLION,
      ONE_MILLION,
    );

    expect(known).toBe(true);
    expect(cost).toBeCloseTo(5.25, 10);
  });

  it('treats prices as per-1M, not per-1K', () => {
    // The deleted TOKEN_PRICES table was per-1K and sat next to a per-1M one.
    // 1k tokens of gpt-5.4-mini input is $0.00075, not $0.75.
    const { cost } = estimateModelCost('gpt-5.4-mini', 1000, 0);
    expect(cost).toBeCloseTo(0.00075, 10);
  });

  // The actual regression: unknown models used to be costed at gpt-4o-mini
  // rates, which under-reported prod's gpt-5.4-mini spend 5x on input and
  // 7.5x on output. Unknown must over-report, never under-report.
  it('costs an unknown model at the priciest catalogued rate, not the cheapest', () => {
    const { cost, known } = estimateModelCost(
      'gpt-9-does-not-exist',
      ONE_MILLION,
      ONE_MILLION,
    );

    expect(known).toBe(false);
    expect(cost).toBeCloseTo(
      UNKNOWN_MODEL_PRICING.input + UNKNOWN_MODEL_PRICING.output,
      10,
    );
  });

  it('never prices an unknown model below any catalogued model', () => {
    const unknown = estimateModelCost('nope', ONE_MILLION, ONE_MILLION).cost;

    // Rounded because 0.14 + 0.28 is 0.42000000000000004 in JS. The object
    // wrapper is just so a failure names the offending model.
    const round = (n: number) => Number(n.toFixed(6));

    for (const [model, spec] of Object.entries(MODEL_CATALOG)) {
      expect({
        model,
        cost: round(estimateModelCost(model, ONE_MILLION, ONE_MILLION).cost),
      }).toEqual({ model, cost: round(spec.input + spec.output) });
      expect(unknown).toBeGreaterThanOrEqual(round(spec.input + spec.output));
    }
  });

  it('gives every catalogued model a positive context window', () => {
    for (const [model, spec] of Object.entries(MODEL_CATALOG)) {
      expect({ model, ok: spec.contextWindow > 0 }).toEqual({
        model,
        ok: true,
      });
    }
  });
});
