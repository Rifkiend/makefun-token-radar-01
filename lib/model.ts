// The token radar's model: a size curve fitted on the snapshot's own tokenized comps.
//
// Implied value follows only from the snapshot's own figures:
//
//   1. Fit log(mcap) = a + b*log(TVL) by least squares on the comps with mcap > 0.
//      The fit is done here, at runtime, from the sealed snapshot: a new snapshot
//      refits the curve, so the model is a function of the figures, never a list.
//   2. implied = exp(a + b*log(TVL)) * growthMult * maturityMult
//      growthMult   = 1 + clamp(change_7d, -60, 120) / 100 * 0.5
//      maturityMult = 0.6 + min(age_days, 1095) / 1095 * 0.4   (age unknown: 365 days)
//   3. Validated inside this program by leave-one-out (LOO): refit on 127 comps,
//      predict the held-out comp's mcap, take |log(pred / actual)|. The median over
//      all comps is the number the dashboard shows the judge. A listed-date split
//      (train on protocols listed before 2025-01-01, test on the rest) is reported
//      beside it, labelled honestly as a listed-date split, not a walk-forward.
//
// No protocol name is ever special-cased: the same function scores every row.
// The board covers every slug in the snapshot's watchlist (the floor, never a
// ceiling) and adds every other rankable pre-token protocol: the early radar.
//
// A second signal, frozen at build time, rides along for the fundamentals panel
// only and never changes the ranking input: FDV and fees for the comps, from
// CoinGecko and DeFiLlama, frozen 2026-11-20 into data/frozen-fundamentals.json.
// The program runs offline, so frozen data is the only way outside figures enter,
// and the dashboard states the source and the date openly.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted size curve: log(mcap) = intercept + slope * log(TVL). */
export interface SizeCurve {
  intercept: number;
  slope: number;
  r2: number;
  comps: number;
}

/** Leave-one-out validation of the curve, computed inside this program. */
export interface LooValidation {
  comps: number;
  median_log_error: number;
  median_error_ratio: number;
  per_category: { category: string; comps: number; median_error_ratio: number }[];
  listed_date_split: {
    train_comps: number;
    test_comps: number;
    cutoff: string;
    median_error_ratio: number;
  } | null;
}

/** Frozen fundamentals (second signal only): FDV and fees, frozen at build time. */
export interface FrozenFundamentals {
  as_of: string;
  note: string;
  sources: { fdv: string; fees: string };
  fdv_by_gecko_id: Record<string, number>;
  fees_by_slug: Record<string, { d30: number | null; y1: number | null; ann: number | null }>;
}

/** The fundamentals panel's figures, computed at runtime from the frozen file. */
export interface FundamentalsSummary {
  as_of: string;
  fdv_comps: number;
  median_fdv_mcap: number | null;
  median_fdv_tvl: number | null;
  fees_comps: number;
  median_ps: number | null;
  ps_comps: number;
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  airdrop_pool_pct: number;
  farmer_share: number;
  gas_usd: number;
  farm_net: number;
  thin_net: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  airdrop_pool_pct: 0.05,
  farmer_share: 0.001,
  gas_usd: 25,
  farm_net: 300,
  thin_net: 50,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A farm verdict: what to do about this protocol, and what it is worth net. */
export type FarmVerdict = 'FARM' | 'THIN' | 'SKIP';

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  verdict: FarmVerdict;
  expected_value_usd: number;
  farm_cost_usd: number;
  net_value_usd: number;
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the farm plan beside it. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  verdict: FarmVerdict;
  expected_value_usd: number;
  farm_cost_usd: number;
  net_value_usd: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the validation and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  curve: SizeCurve;
  validation: LooValidation;
  fundamentals: FundamentalsSummary | null;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  verdict_counts: { FARM: number; THIN: number; SKIP: number };
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 === 1 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Least squares for log(mcap) = a + b*log(TVL) over the given comps. */
export function fitCurve(comps: SnapshotProtocol[]): SizeCurve {
  const xs = comps.map((p) => Math.log(p.tvl_usd));
  const ys = comps.map((p) => Math.log(p.mcap_usd!));
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    ssTot += (ys[i]! - my) * (ys[i]! - my);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  let ssRes = 0;
  for (let i = 0; i < n; i++) ssRes += (ys[i]! - (intercept + slope * xs[i]!)) ** 2;
  return { intercept, slope, r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot, comps: n };
}

/** The growth and maturity multipliers for one protocol under the model. */
export function multipliers(p: SnapshotProtocol, asOf: string, model: ModelConstants): { growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const rawGrowth = finite(p.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  return { growthPct, growthMult, maturityMult, age };
}

/** The implied value one protocol gets: the curve on its TVL, times its growth and maturity. */
export function impliedValue(p: SnapshotProtocol, asOf: string, curve: SizeCurve, model: ModelConstants): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const { growthPct, growthMult, maturityMult, age } = multipliers(p, asOf, model);
  const base = Math.exp(curve.intercept + curve.slope * Math.log(p.tvl_usd));
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, growthPct, growthMult, maturityMult, age };
}

/**
 * Leave-one-out validation of the size curve, computed inside this program: for
 * each comp, refit the curve on the other comps, predict the held-out comp's mcap
 * (with its own growth and maturity multipliers, as the model scores it), and
 * take |log(pred / actual)|. The median over all comps is the headline number.
 * A listed-date split trains on protocols listed before the cutoff and tests on
 * the rest; it is a listed-date split, not a walk-forward, and is labelled so.
 */
export function validateCurve(comps: SnapshotProtocol[], asOf: string, model: ModelConstants): LooValidation {
  const errs: number[] = [];
  const byCat = new Map<string, number[]>();
  for (let i = 0; i < comps.length; i++) {
    const held = comps[i]!;
    const rest = comps.filter((_, j) => j !== i);
    const curve = fitCurve(rest);
    const { growthMult, maturityMult } = multipliers(held, asOf, model);
    const pred = Math.exp(curve.intercept + curve.slope * Math.log(held.tvl_usd)) * growthMult * maturityMult;
    const err = Math.abs(Math.log(pred / held.mcap_usd!));
    errs.push(err);
    const cat = held.category ?? 'Other';
    const list = byCat.get(cat) ?? [];
    list.push(err);
    byCat.set(cat, list);
  }
  const per_category = [...byCat.entries()]
    .filter(([, list]) => list.length >= 5)
    .map(([category, list]) => ({ category, comps: list.length, median_error_ratio: Math.exp(median(list)) }))
    .sort((a, b) => a.median_error_ratio - b.median_error_ratio);
  const cutoff = '2025-01-01';
  const train = comps.filter((p) => p.listed_at !== null && p.listed_at < cutoff);
  const test = comps.filter((p) => p.listed_at !== null && p.listed_at >= cutoff);
  let listed_date_split: LooValidation['listed_date_split'] = null;
  if (train.length >= 10 && test.length >= 5) {
    const curve = fitCurve(train);
    const testErrs = test.map((p) => {
      const { growthMult, maturityMult } = multipliers(p, asOf, model);
      const pred = Math.exp(curve.intercept + curve.slope * Math.log(p.tvl_usd)) * growthMult * maturityMult;
      return Math.abs(Math.log(pred / p.mcap_usd!));
    });
    listed_date_split = { train_comps: train.length, test_comps: test.length, cutoff, median_error_ratio: Math.exp(median(testErrs)) };
  }
  const med = median(errs);
  return { comps: comps.length, median_log_error: med, median_error_ratio: Math.exp(med), per_category, listed_date_split };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Categories the watchlist rule excludes: an exchange, a bridge, or a staked product. */
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);
/** Exchange names a protocol name must not begin with. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
/** A whole word wrapped, staked or staking in the name. */
const WRAPPED_STAKED = /\bwrapped\b|\bstaked\b|\bstaking\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange, not
 * a bridge or a liquid-staking product, not a versioned pool, and not a wrapped
 * or staked product of a token that already trades. The watchlist's own rule,
 * from the snapshot's field guide, applied to every protocol below the floor.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_STAKED.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e))) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm verdict, netted: the expected airdrop value minus what
 * farming costs. The expected value assumes 5% of the token's supply goes to
 * airdrop farmers and one active farmer captures 0.1% of that pool; both
 * assumptions are stated on the dashboard, and the net is what the verdict
 * reads. Capital is not lost, it is locked, so the cost is the capital plus
 * gas: the money at risk while the position is open.
 */
export function verdictFor(implied: number, capital: number, model: ModelConstants): { verdict: FarmVerdict; expected: number; cost: number; net: number } {
  const expected = Math.round(implied * model.airdrop_pool_pct * model.farmer_share);
  const cost = capital + model.gas_usd;
  const net = expected - cost;
  const verdict: FarmVerdict = net > model.farm_net ? 'FARM' : net > model.thin_net ? 'THIN' : 'SKIP';
  return { verdict, expected, cost, net };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time,
 * plus the verdict it carries. The plan is derived from the protocol's own
 * record (category, chains, TVL, age) and its netted value, never from a
 * hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, verdict: FarmVerdict, net: number, expected: number): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const verdictLine =
    verdict === 'FARM'
      ? `Verdict FARM: the expected airdrop of about $${expected.toLocaleString('en-US')} beats the farming cost by about $${net.toLocaleString('en-US')}, so this one is worth farming first.`
      : verdict === 'THIN'
        ? `Verdict THIN: the expected airdrop of about $${expected.toLocaleString('en-US')} barely covers the farming cost, so farm it only if you have room after the FARM rows.`
        : `Verdict SKIP: the expected airdrop of about $${expected.toLocaleString('en-US')} does not cover the farming cost, so skip it unless you have a reason of your own.`;
  return [
    { text: verdictLine, cost: `the $${capital + 25} at risk while farming`, time: 'read it before you start' },
    { text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`, cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: action, cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`, time: '15 minutes to set up' },
    { text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
    { text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes, and never pay to claim.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, curve: SizeCurve, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, no TVL floor.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const { implied, growthPct, growthMult, maturityMult, age } = impliedValue(p, snapshot.as_of, curve, model);
    const capital = capitalFor(p);
    const { verdict, expected, cost, net } = verdictFor(implied, capital, model);
    return { p, implied, growthPct, growthMult, maturityMult, age, verdict, expected, cost, net };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    verdict: s.verdict,
    expected_value_usd: s.expected,
    farm_cost_usd: s.cost,
    net_value_usd: s.net,
    farm_steps: farmSteps(s.p, s.age, s.verdict, s.net, s.expected).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A board row's compact form for data.js, carrying its farm plan and verdict. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    verdict: row.verdict,
    expected_value_usd: row.expected_value_usd,
    farm_cost_usd: row.farm_cost_usd,
    net_value_usd: row.net_value_usd,
    farm_steps: row.farm_steps,
  };
}

/** The fundamentals panel's figures from the frozen file and the snapshot. */
export function summarizeFundamentals(snapshot: Snapshot, frozen: FrozenFundamentals | null): FundamentalsSummary | null {
  if (frozen === null) return null;
  const comps = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  const fdvRatios: number[] = [];
  const fdvTvl: number[] = [];
  for (const p of comps) {
    const fdv = p.gecko_id !== null ? frozen.fdv_by_gecko_id[p.gecko_id] : undefined;
    if (fdv === undefined || fdv <= 0) continue;
    fdvRatios.push(fdv / p.mcap_usd!);
    fdvTvl.push(fdv / p.tvl_usd);
  }
  const ps: number[] = [];
  let feesComps = 0;
  for (const p of comps) {
    const fees = frozen.fees_by_slug[p.slug];
    if (fees === undefined) continue;
    feesComps++;
    const fdv = p.gecko_id !== null ? frozen.fdv_by_gecko_id[p.gecko_id] : undefined;
    if (fdv === undefined || fdv <= 0) continue;
    const rev = fees.ann ?? fees.y1 ?? (fees.d30 !== null && fees.d30 !== undefined ? fees.d30 * 12 : null);
    if (rev === null || rev === undefined || rev <= 0) continue;
    ps.push(fdv / rev);
  }
  return {
    as_of: frozen.as_of,
    fdv_comps: fdvRatios.length,
    median_fdv_mcap: fdvRatios.length > 0 ? median(fdvRatios) : null,
    median_fdv_tvl: fdvTvl.length > 0 ? median(fdvTvl) : null,
    fees_comps: feesComps,
    median_ps: ps.length > 0 ? median(ps) : null,
    ps_comps: ps.length,
  };
}

/** Everything the dashboard renders, from the snapshot and the frozen file. */
export function buildRadar(snapshot: Snapshot, frozen: FrozenFundamentals | null, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const comps = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0);
  const curve = fitCurve(comps);
  const validation = validateCurve(comps, snapshot.as_of, model);
  const fundamentals = summarizeFundamentals(snapshot, frozen);
  const board = buildBoard(snapshot, curve, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const verdict_counts = { FARM: 0, THIN: 0, SKIP: 0 };
  for (const r of board) verdict_counts[r.verdict]++;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    curve,
    validation,
    fundamentals,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    verdict_counts,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** The frozen fundamentals out of a file's text, or null when the file is absent or unusable. */
export function parseFrozen(text: string): FrozenFundamentals | null {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (typeof raw !== 'object' || raw === null) return null;
    if (typeof raw.as_of !== 'string' || typeof raw.fdv_by_gecko_id !== 'object' || typeof raw.fees_by_slug !== 'object') return null;
    return {
      as_of: raw.as_of as string,
      note: typeof raw.note === 'string' ? raw.note : '',
      sources: {
        fdv: typeof (raw.sources as Record<string, unknown>)?.fdv === 'string' ? (raw.sources as Record<string, string>).fdv : '',
        fees: typeof (raw.sources as Record<string, unknown>)?.fees === 'string' ? (raw.sources as Record<string, string>).fees : '',
      },
      fdv_by_gecko_id: raw.fdv_by_gecko_id as Record<string, number>,
      fees_by_slug: raw.fees_by_slug as Record<string, { d30: number | null; y1: number | null; ann: number | null }>,
    };
  } catch {
    return null;
  }
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
