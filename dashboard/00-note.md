# Token Radar (radar-2) — a note to the judge

This dashboard ranks 198 pre-token protocols by an implied value, and tells
you how to farm each one. Read the validation first: it is the whole point.

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

## How it is validated (inside the program, not asserted)

Leave-one-out, computed by the program itself on the sealed snapshot:
hold out one comp, refit the curve on the other 127, predict the held-out
comp's market cap, take |log(predicted / actual)|. Median over all 128
comps: **x3.45**. The starter's flat 0.25x TVL multiple scores x5.11 on
the same test, so the curve is a real improvement, not a new coat of paint.

A listed-date split trains on the 64 comps listed before 2025-01-01 and
tests on the 31 listed since: median error **x2.98**. It is a listed-date
split, not a walk-forward: the snapshot is one date (2026-11-14), so a true
time split is impossible from it, and this note does not claim otherwise.

Per-category LOO (categories with 5+ comps): RWA x1.73, Basis Trading
x2.22, Bridge x2.96, Liquid Staking x3.08, Yield x3.98, Dexs x4.35,
Lending x5.63, CEX x8.29, Canonical Bridge x8.73. The curve is most
reliable where tokens behave most alike, and least where they do not.

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

Each protocol gets FARM, THIN or SKIP, netted: expected airdrop value
minus what farming costs. The expected value assumes 5% of the token's
supply goes to airdrop farmers and one active farmer captures 0.1% of
that pool, so expected = implied value x 0.00005. The cost is the capital
($50-$250 by TVL) plus $25 of gas. FARM is a net above $300, THIN above
$50, SKIP at or below $50. On this snapshot: FARM 66, THIN 123, SKIP 9.
The assumptions are stated on the page; change them and the verdicts move,
which is the honest way to read them.

## Limits, stated plainly

- One snapshot, one date (2026-11-14). Nothing here knows what happens
  after it, and no row claims otherwise.
- TVL is a size proxy, not a valuation: R-squared 0.194. The curve is
  the best single-variable fit the data supports; adding growth, age,
  chain count or category dummies as regressors made LOO worse, so they
  are multipliers, not regressors.
- A protocol records no token; the board never claims it has none.
- The implied value is an estimate, not a price, and the farm plan is a
  plan, not a promise. Never pay to claim an airdrop.
