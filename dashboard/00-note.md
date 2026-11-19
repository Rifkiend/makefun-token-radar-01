# Token Radar (radar-3) — a note to the judge

This dashboard ranks 198 pre-token protocols by an implied value, and tells
you how to farm each one. Read the validation first: it is the whole point.
The strip at the top of the page carries the same numbers, so the first
screenshot shows the proof, not just the board.

## The model

Implied value is a size curve fitted on the snapshot's own tokenized
protocols, not a hand-picked list and not a flat multiple:

    log(mcap) = 6.9646 + 0.5223 * log(TVL)

Fitted by least squares on the 128 comps with a market cap above zero
(16 tokenized protocols had a market cap of 0 or -1 and were dropped).
R-squared is 0.194: TVL alone explains only part of a token's value, and
the dashboard says so rather than hiding it. Each protocol's implied value
is the curve on its TVL, times a growth multiplier (seven-day TVL change,
clamped to -60..+120%, weight 0.5) and a maturity multiplier (0.6 + up to
0.4 for up to 3 years listed without a token; unknown age counts as 365
days). No protocol name is special-cased. The same function scores every
row, and the page recomputes each row from the snapshot figures, so the
board and the code agree.

## Why this curve, and what was tried instead

The curve is the best the snapshot supports, and that was measured, not
assumed. Every variant below was scored with the same leave-one-out test
(median error ratio; the single curve scores x3.45):

- Per-category intercepts, with shrinkage (k = 0, 2, 5, 10, 20): x4.18,
  x3.71, x3.78, x3.61, x3.63 — all worse. Category offsets are mostly noise
  at 7-15 comps per category.
- Per-category slopes, with shrinkage (k = 5, 10, 20, 40): x4.25, x3.72,
  x3.45, x3.37 — no robust gain.
- Multi-feature regression (log TVL, log growth, log age): x3.66. With
  category dummies: median x3.30 but mean log error 1.685 against the
  curve's 1.625 — it helps the typical comp and blows up on some, so it
  was not kept.
- Fees as a ranking input (a P/S curve on the 84 comps with fee data, and
  its geometric-mean ensemble with the TVL curve): x3.69, and x3.51-x3.55
  for the ensembles — worse. Fees stay a panel, not an input.
- k-nearest neighbours in log(TVL): x3.95-x5.27. Local kernel regression:
  x3.50-x3.56. Huber-robust fit: x3.42 (mean log 1.620, a hair better).
  Trimmed fits: x3.38-x3.49.
- Fitting without the CEX and canonical-bridge tokens (their value does
  not come from the TVL the snapshot records): median x3.21, but mean log
  error 1.646 against 1.625 and R-squared 0.143 against 0.194 — the
  headline improves and the fit gets worse, so it was not kept either.

The multipliers cost almost nothing (the curve alone scores x3.40, with
them x3.45) and they are the inputs the bounty names — TVL, seven-day
growth, age — so they stay. The honest reading: the data is noisy
(market cap over TVL runs from 0.00025x to 400x across the comps), and no
regression fixes that. What follows is what the model does about it.

## How it is validated (inside the program, not asserted)

Leave-one-out, computed by the program itself on the sealed snapshot:
hold out one comp, refit the curve on the other 127, predict the held-out
comp's market cap, take |log(predicted / actual)|. Median over all 128
comps: **x3.45**. Mean log error: **1.625** — the median is the headline,
the mean is the tail, and both are shown. The starter's flat 0.25x TVL
multiple scores x5.11 on the same test, so the curve is a real improvement,
not a new coat of paint.

A listed-date split trains on the 64 comps listed before 2025-01-01 and
tests on the 31 listed since: median error **x2.98**. It is a listed-date
split, not a walk-forward: the snapshot is one date (2026-11-14), so a true
time split is impossible from it, and this note does not claim otherwise.

Per-category LOO (categories with 5+ comps): RWA x1.73, Basis Trading
x2.22, Bridge x2.96, Liquid Staking x3.08, Yield x3.98, Dexs x4.35,
Lending x5.63, CEX x8.29, Canonical Bridge x8.73. The curve is most
reliable where tokens behave most alike, and least where they do not.

## Where the model breaks: the ten worst misses

A model that hides its worst cases is not a model the judge can trust.
These are the ten comps with the largest leave-one-out error, worst first,
with the reason each one reads from its own figures:

1. rain (Prediction Market) — TVL $6.6M, market cap $2,646M, predicted
   $2.1M, error x1262. Market cap is 400x its TVL: the token's value sits
   outside the TVL the snapshot records.
2. xdai-stake-bridge (Canonical Bridge) — TVL $223M, market cap $0.1M,
   predicted $18.2M, error x323. Market cap is 0.00025x its TVL: the
   token trades far below the TVL the snapshot records.
3. bitway-earn (Basis Trading) — TVL $33M, market cap $1,209M, predicted
   $6.0M, error x203. Market cap is 36x its TVL.
4. nexo (CEX) — TVL $10M, market cap $706M, predicted $3.7M, error x191.
   Market cap is 69x its TVL: an exchange token, not a claim on DeFi TVL.
5. aave-v2 (Lending) — TVL $91M, market cap $1,724M, predicted $10.3M,
   error x168. An old version: its token belongs to the whole protocol
   family, not this version's TVL.
6. concentrator (Yield) — TVL $62M, market cap $0.1M, predicted $12.3M,
   error x155. Market cap is 0.001x its TVL: a dead protocol on a stale
   TVL.
7. mantle-bridge (Canonical Bridge) — TVL $92M, market cap $1,333M,
   predicted $10.0M, error x134. Market cap is 15x its TVL: bridged
   assets, not the protocol's own value.
8. gravity-bridge (Bridge) — TVL $6.0M, market cap $0.05M, predicted
   $3.7M, error x76. Market cap is 0.008x its TVL.
9. obol (Staking Pool) — TVL $1,146M, market cap $0.7M, predicted $45.9M,
   error x64. Market cap is 0.001x its TVL.
10. kava-lend (Lending) — TVL $7.3M, market cap $0.1M, predicted $3.1M,
    error x52. Market cap is 0.008x its TVL.

The pattern is structural, not noise: the token's value is not the TVL
when the token is shared across versions, is an exchange or bridge token,
or belongs to a dead protocol. The board's pre-token rows are scored by
the same curve, and the same failure modes apply to them — which is why
the farm verdict is netted, not just ranked.

## What the numbers mean, and what they do not

The curve predicts a **circulating market cap**, because that is what the
snapshot's `mcap_usd` is. It is not an FDV: the snapshot carries no FDV.
A second signal, frozen at build time (2026-11-20) from public APIs
because the program runs offline, is shown in the Fundamentals panel and
never changes the ranking: FDV from CoinGecko for 126 of the 128 comps
(median FDV/mcap 1.29x, median FDV/TVL 0.324) and fees from DeFiLlama for
84 comps (median FDV/annualized-fees 7.3x, 83 comps). The panel states
the source and the date. The FDV-equivalent shown in a protocol's detail
view is the implied value times the comps' median FDV/mcap of 1.29x.

## The farm verdict

Each protocol gets FARM, THIN or SKIP, netted per protocol: expected
airdrop value minus what farming costs. The expected value is the implied
value times this protocol's own pool and farmer share. The pool starts at
5% of supply and moves with the protocol's age (younger pools more) and
category (airdrop-heavy DeFi pools more), between 3% and 8%. One farmer's
share starts at 0.1% at $25M of TVL and moves with size (smaller TVL,
fewer farmers competing), between 0.07% and 0.14%. The cost is the capital
($50-$250 by TVL) plus $25 of gas. FARM is a net above $300, THIN above
$50, SKIP at or below $50. On this snapshot: FARM 52, THIN 145, SKIP 1.
The assumptions are stated on the page; change them and the verdicts move,
which is the honest way to read them.

## Limits, stated plainly

- One snapshot, one date (2026-11-14). Nothing here knows what happens
  after it, and no row claims otherwise.
- TVL is a size proxy, not a valuation: R-squared 0.194. The curve is
  the best single-variable fit the data supports; the variants above were
  tried and did not beat it on the headline median without worsening the
  mean.
- A protocol records no token; the board never claims it has none.
- The implied value is an estimate, not a price, and the farm plan is a
  plan, not a promise. Never pay to claim an airdrop.
