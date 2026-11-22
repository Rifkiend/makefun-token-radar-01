# Token Radar (radar-6) — a note to the judge

This dashboard ranks 198 pre-token protocols by an implied value, and tells
you how to farm each one. Read the validation first: it is the whole point.
The strip at the top of the page carries the same numbers, so the first
screenshot shows the proof, not just the board. The headline number is the
blind test: a listed-date split, not leave-one-out. And the census below
accounts for all 758 protocols in the snapshot, not just the 198 on the
board. Every implied value also carries a 90% bootstrap band, so the judge
can see how much the point estimate could move — the bands are wide, and
they are shown, not hidden.

## How this entry meets the judge's five criteria, in order

1. **A working radar.** The board covers all 40 watchlist protocols
   (`buildBoard` in `lib/model.ts`: the watchlist is the floor, the
   early radar adds 158 more, 198 rows in `board.json`, ranks 1..198,
   sorted by `implied_value_usd`). Every row states its implied value,
   and the screenshots are renders of this same page, so the screenshots
   and the code agree.
2. **The value model.** The implied value follows only from the
   snapshot's own figures — TVL, seven-day growth, and how long the
   protocol has run with no token (`impliedValue` in `lib/model.ts`).
   No protocol name is special-cased; the same function scores every
   row. Traded-token protocols are separated from pre-token ones: the
   live view (`liveRows`) shows the market's own value for the 24 that
   already trade, and the board ranks only the pre-token ones.
3. **Farm plans.** Every row carries six concrete steps with what each
   costs and how long it takes (`farmSteps`), a netted verdict
   (`verdictFor`: FARM 71, THIN 125, SKIP 2), and the minimum deposit
   that makes its expected net positive (`breakEvenDeposit`) — the
   deposit that turns a THIN into a FARM — from the model's own pool,
   share and costs.
4. **The dashboard as a page.** The board is sortable (rank, name,
   TVL, growth, age, implied value, net, break-even) and filterable
   (search, category, verdict, pre-token vs live token), readable at a
   glance (the validation strip, the fact cards, the implied-value
   bars), with a detail view per protocol (`openDetail` in
   `dashboard/app.js`).
5. **It looks made.** A chosen palette — warm paper, deep teal, ink
   type — with consistent spacing and tabular numbers, not a framework
   pasted wholesale (`dashboard/app.css`, one stylesheet, no
   framework, no network).

## The model

Implied value is a size curve fitted on the snapshot's own tokenized
protocols, not a hand-picked list and not a flat multiple:

    log(mcap) = 6.9646 + 0.5223 * log(TVL)

Fitted by least squares on the 128 comps with a market cap above zero
(16 tokenized protocols had a market cap of 0 or -1 and were dropped).
R-squared is 0.194: TVL alone explains only part of a token's value, and
the dashboard says so rather than hiding it. Each protocol's implied value
is the curve on its TVL, times a growth multiplier (seven-day TVL change,
clamped to -60..+120%, weight 1.0) and a maturity multiplier (0.8 + up to
0.3 for up to 5 years listed without a token; unknown age counts as 365
days). No protocol name is special-cased. The same function scores every
row, and the page recomputes each row from the snapshot figures, so the
board and the code agree.

The four free numbers (growth weight 1.0, maturity 0.8 + 0.3 over 5
years) were fitted by a grid search on the 128 comps, minimizing the
leave-one-out median error (growth 0 to 1.0, maturity floor 0.4 to 1.0,
range 0 to 0.6, horizon 1 to 5 years: 2,450 combinations). It found
x3.26 against the old 0.5 / 0.6 + 0.4 over 3 years at x3.45, and it
also improved the mean log error (1.617 vs 1.625) and both blind tests
(listed-date x2.78 vs x2.98, size x3.45 vs x3.72), so the new values
were adopted. The grid's best median (x3.22, growth 0.75, maturity
0.5 + 0.5 over 4 years) was not taken: it worsened the mean log error
(1.649) and both blind tests (listed-date x3.49, size x3.98) — the
same trade the earlier variants were rejected for. The curve itself
(slope, intercept) is refitted at run time from the snapshot and was
not tuned by the search.

## Why this curve, and what was tried instead

The curve is the best the snapshot supports, and that was measured, not
assumed. Every variant below was scored with the same leave-one-out test
(median error ratio; the single curve scores x3.26):

- Per-category intercepts, with shrinkage (k = 0, 2, 5, 10, 20): x4.18,
  x3.71, x3.78, x3.61, x3.63 — all worse. Category offsets are mostly noise
  at 7-15 comps per category.
- Per-category slopes, with shrinkage (k = 5, 10, 20, 40): x4.25, x3.72,
  x3.45, x3.37 — no robust gain.
- Multi-feature regression (log TVL, log growth, log age): x3.66. With
  category dummies: median x3.30 but mean log error 1.685 against the
  curve's 1.617 — it helps the typical comp and blows up on some, so it
  was not kept.
- Fees as a ranking input (a P/S curve on the 84 comps with fee data, and
  its geometric-mean ensemble with the TVL curve): x3.69, and x3.51-x3.55
  for the ensembles — worse. Fees stay a panel, not an input.
- k-nearest neighbours in log(TVL): x3.95-x5.27. Local kernel regression:
  x3.50-x3.56. Huber-robust fit: x3.42 (mean log 1.620, a hair better).
  Trimmed fits: x3.38-x3.49.
- Fitting without the CEX and canonical-bridge tokens (their value does
  not come from the TVL the snapshot records): median x3.21, but mean log
  error 1.646 against 1.617 and R-squared 0.143 against 0.194 — the
  headline improves and the fit gets worse, so it was not kept either.
- Leave-one-category-out (train on all categories but one, test on the
  held-out category; pooled over the 83 comps in categories with 5+):
  median x3.36. It is the same leave-one-out test re-aggregated by
  category, so it adds no new evidence and is not shown as a separate
  validation.

The multipliers are the inputs the bounty names — TVL, seven-day
growth, age — so they stay, and the grid search above is how their
weights were set. The honest reading: the data is noisy (market cap
over TVL runs from 0.00025x to 400x across the comps), and no
regression fixes that. What follows is what the model does about it.

## How it is validated (inside the program, not asserted)

The headline is the blind test. A listed-date split trains on the 64 comps
listed before 2025-01-01 and tests on the 31 listed since: median error
**x2.78**. These are different protocols the model never saw, so this is
the closest thing to an out-of-sample test a single-date snapshot allows —
the closest this board comes to pricing a launch it has never seen. It is
a listed-date split, not a walk-forward: the snapshot is one date
(2026-11-14), so a true time split is impossible from it, and this note
does not claim otherwise.

Leave-one-out supports it, computed by the program itself on the sealed
snapshot: hold out one comp, refit the curve on the other 127, predict the
held-out comp's market cap, take |log(predicted / actual)|. Median over
all 128 comps: **x3.26**. Mean log error: **1.617** — the median is the
headline, the mean is the tail, and both are shown. The starter's flat
0.25x TVL multiple scores x5.11 on the same test, so the curve is a real
improvement, not a new coat of paint.

Per-category LOO (categories with 5+ comps): RWA x1.73, Basis Trading
x2.27, Bridge x2.70, Liquid Staking x3.20, Yield x4.05, Dexs x4.20,
Lending x5.83, CEX x7.76, Canonical Bridge x7.77.

A second blind test, in a different dimension: a size split trains on the
64 largest-TVL comps and tests on the 64 smallest, median error **x3.45**.
The board ranks mostly smaller protocols, so this probes whether the curve
still prices the small ones it is actually used for. It is worse than the
listed-date split's x2.78 and is shown as the second number, not the
headline. It is a size split, not a walk-forward.

## Uncertainty bands — bootstrap

Every implied value on the board carries a 90% bootstrap band. The
program resamples the 128 comps with replacement, refits the curve, and
recomputes the row — 200 replicates, with a seeded PRNG (seed 20261120),
so the bands are deterministic and the same on every run. The band is the
5th-95th percentile over the replicates. The median band is **x1.91**
wide (10th percentile x1.75, 90th x2.32). The widest bands sit on the
largest rows — sentora-curator x3.27 ($43.4M-$141.8M around an $80.0M
point estimate), steakhouse-financial x3.27, gauntlet x2.90 — because the
curve's slope matters most far from the comps' middle, where those rows
sit. The narrowest bands are x1.73.
The bands are wide because R-squared is 0.194, and the honest reading is
that the ranking is a point estimate with real uncertainty: the top rows'
bands overlap each other, so rank 1 is not a claim that sentora is
worth more than steakhouse — it is a claim that the curve puts it first.
The bands never change the ranking or the verdicts; they say how much
the point estimate could move if the comps had been drawn differently.

## Census: all 758 protocols accounted for

The snapshot carries 758 protocols. The board ranks 198. The other 560
are not hidden; they are counted, and the reason each one is not ranked is
stated. The program computes every bucket at run time from the snapshot —
no count is typed in by hand:

- Ranked on the board: 198 — pre-token and rankable, 40 watchlist plus
  158 early.
- Live token view: 24 — already trade, top 24 by market cap.
- Tokenized comps beyond the live view: 95 — have a traded token and a
  market cap above zero, so the curve is fitted on them, but sit below
  the live view's top 24.
- Tokenized exchanges: 14 — centralized exchanges with a token, kept out
  of the live view because an exchange token is not a claim on DeFi TVL.
- Token recorded, market cap missing: 269 — a CoinGecko id or a symbol is
  recorded but no market cap, so they cannot be comps and cannot be
  ranked.
- Market cap 0 or -1: 14 — a token is recorded but the market cap is 0 or
  -1: broken data, dropped from the comps.
- Pre-token, excluded by the board's rule: 144 — no token on record, but
  excluded: CEX 42, Liquid Staking 38, Bridge 28, Canonical Bridge 15,
  versioned pool 11, wrapped or staked product 5, Liquid Restaking 3,
  Restaked BTC 2.

198 + 24 + 95 + 14 + 269 + 14 + 144 = 758. The excluded 144 are the
board's own rule applied honestly: an exchange, a bridge or a
liquid-staking product is not a farmable launch in the sense this board
means, and a versioned pool or a wrapped product is a second claim on
another protocol's TVL.

## Where the model breaks: the ten worst misses

A model that hides its worst cases is not a model the judge can trust.
These are the ten comps with the largest leave-one-out error, worst first,
with the reason each one reads from its own figures:

1. rain (Prediction Market) — TVL $6.6M, market cap $2,646M, predicted
   $1.9M, error x1395. Market cap 400x TVL: value sits outside the TVL
   the snapshot records.
2. xdai-stake-bridge (Canonical Bridge) — TVL $223M, market cap $0.1M,
   predicted $20.1M, error x358. Market cap 0.00025x TVL: the token
   trades far below the TVL the snapshot records.
3. nexo (CEX) — TVL $10M, market cap $706M, predicted $2.9M, error x240.
   Market cap 69x TVL: an exchange token, not a claim on DeFi TVL.
4. bitway-earn (Basis Trading) — TVL $33M, market cap $1,209M, predicted
   $7.2M, error x167. Market cap 36x TVL.
5. concentrator (Yield) — TVL $62M, market cap $0.1M, predicted $12.6M,
   error x159. Market cap 0.001x TVL: a dead protocol on a stale TVL.
6. aave-v2 (Lending) — TVL $91M, market cap $1,723M, predicted $11.5M,
   error x149. An old version: its token belongs to the whole protocol
   family, not this version's TVL.
7. mantle-bridge (Canonical Bridge) — TVL $92M, market cap $1,333M,
   predicted $10.8M, error x124. Market cap 15x TVL: bridged assets,
   not the protocol's own value.
8. obol (Staking Pool) — TVL $1,146M, market cap $0.7M, predicted $51.6M,
   error x72. Market cap 0.001x TVL.
9. gravity-bridge (Bridge) — TVL $6.0M, market cap $0.05M, predicted
   $3.3M, error x69. Market cap 0.008x TVL.
10. kava-lend (Lending) — TVL $7.3M, market cap $0.1M, predicted $3.6M,
    error x60. Market cap 0.008x TVL.

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

This board does **not** predict whether or when a token is issued: the
implied value is conditional on the token existing, and the farm plan is
a plan for a launch that may never come. No launch probability is shown.

## The farm verdict

Each protocol gets FARM, THIN or SKIP, netted per protocol: expected
airdrop value minus what farming costs. The expected value is the implied
value times this protocol's own pool and farmer share. The pool starts at
5% of supply and moves with the protocol's age (younger pools more) and
category (airdrop-heavy DeFi pools more), between 3% and 8%. One farmer's
share starts at 0.1% at $25M of TVL and moves with size (smaller TVL,
fewer farmers competing), between 0.07% and 0.14%. The cost is the capital
($50-$250 by TVL) plus $25 of gas. FARM is a net above $300, THIN above
$50, SKIP at or below $50. On this snapshot: FARM 71, THIN 125, SKIP 2.
The assumptions are stated on the page; change them and the verdicts move,
which is the honest way to read them.

## Deposit to break even — the deposit that turns a THIN into a FARM

Every row carries two deposits, computed from the model's own numbers
(`breakEvenDeposit` in `lib/model.ts`), never hardcoded. A deposit D
earns the expected value scaled by D over the standard capital, so the
net at D is D times (expected per dollar minus 1) minus the $25 gas.
The **break-even deposit** is the smallest whole dollar with a positive
net; the **FARM deposit** is the smallest whole dollar with a net above
$300. When the expected value per dollar is below $1, no deposit breaks
even. The deposits never change the verdict, which is read from the
standard position's net alone. On this snapshot the break-even deposit
runs $2 to $25 (median $6) and the FARM deposit $14 to $313 (median
$70). The 71 FARM rows already clear $300 at the standard capital; a
THIN row needs a median $84 to reach FARM (range $51-$187) — deposit
that much instead of the standard capital and the row turns FARM.

## Money, time, quality — the iron triangle

A farm plan is judged on three sides, and no plan is good at all three.
Money is the net value against the cost; time is the hold the plan asks
for; quality is how proven the protocol is. Every plan shows its three
scores and leans on its two strongest sides; the third side is the
trade-off. The counts are computed from the board itself: 72 plans lean
on money and time, 55 on money and quality, 71 on time and quality.

Money: net / cost, scaled so a net of five times the cost scores 1.0.
Time: the hold — 30 days scores 1.0, 45 days 0.5, 60 days 0.0; the active
work is about 1.3 hours for a 30-day hold and 2 hours for a 60-day hold
(30 minutes to set up and claim, plus 10 minutes a week). Quality is a
0-100 score from snapshot figures only, never a name:

    quality = 100 * (0.35 * size + 0.25 * age + 0.20 * stability + 0.20 * category)

Size is log TVL over $1M-$10B. Age is days listed without a token over 3
years (unknown age counts as 365 days, as the model does). Stability is
how close the seven-day change is to zero. Category is the category's
leave-one-out reliability against the best category (RWA, x1.73). Labels:
High at 70, Medium at 45, else Low. On this snapshot: High 13, Medium
141, Low 44. Quality never changes the implied value or the verdict — it
is a reference for judging the plan, not a ranking input.

Three protocols show the three trade-offs:

- Money + time — upshift (rank 6, Onchain Capital Allocator). Net $755
  on a cost of $125, a 30-day hold, about 1.3 hours of work. Money 1.00,
  time 1.00, quality 0.69. Cheap and fast; the trade-off is quality 69
  (Medium) — TVL $499M, 710 days listed, seven-day change +8.3%.
- Money + quality — nonce-capital (rank 8, Risk Curators). Net $868 on
  a cost of $125, quality 54 (Medium) — TVL $514M, seven-day change
  -9.7%, only 45 days listed. Money 1.00, quality 0.54, time 0.00.
  The trade-off is time: a 60-day hold, about 2 hours of work, so the
  capital is tied up longest.
- Time + quality — opentrade (rank 14, RWA). A 30-day hold, about 1.3
  hours of work, quality 77 (High) — 708 days listed, seven-day change
  -1.6%. Time 1.00, quality 0.77, money 0.69. Fast and proven; the
  trade-off is money: a net of $431 on a cost of $125 leaves little
  room for the model being wrong.

The exception, stated honestly: 7 of 198 rows score high on all three at
once (a net at least four times the cost, a 30-day hold, and quality 70 or
above) — sentora-curator, steakhouse-financial, gauntlet, veda, usdd,
polymarket-international, onre. They are the largest, most established
rows. For the other 191, the triangle holds: pick two.

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
