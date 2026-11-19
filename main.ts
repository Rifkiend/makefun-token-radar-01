// Token Radar v3: a size curve fitted on the snapshot's own comps, validated by
// leave-one-out inside this program (radar-3).
//
// The program reads the sealed snapshot from /input/snapshot.json (or --input
// <file|dir>), fits the size curve on the 128 tokenized comps, validates it by
// leave-one-out, scores every rankable pre-token protocol, writes the ranked
// board to /output/board.json, and copies this repository's dashboard/ and
// screenshots/ to /output. Last, it writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library.
//
// The curve is the best the snapshot supports, and that was measured: per-category
// curves, a multi-feature regression, a fees P/S curve and its ensemble, k-NN, a
// local kernel regression and robust fits were all tried with the same LOO test
// and none beat the single global curve on the headline median, so the curve
// stays. The validation also names its own failures: the ten comps with the
// largest LOO error, with the reason each one reads from its own figures.
//
// A second signal rides along, frozen at build time in
// data/frozen-fundamentals.json (FDV from CoinGecko, fees from DeFiLlama,
// frozen 2026-11-20): it feeds the fundamentals panel only and never changes
// the ranking input, which follows only the snapshot's TVL, 7-day growth and
// age. The program runs offline, so frozen data is the only way outside
// figures enter, and the dashboard states the source and the date openly.
//
// The farm verdict is netted per protocol: the airdrop pool and the farmer's
// share both follow the protocol's own stage, category and TVL, centred on
// the flat 5% pool and 0.1% share the first version used.
//
// Determinism is a property of this program, not a hope: it reads no clock,
// no environment, no randomness and no network at run time, and the only
// date it ever uses is the snapshot's as_of. Two runs on the same input
// write byte-identical board.json, data.js and dossier.json, which is what
// the gate's double run checks. The frozen file is read from the repository
// beside main.ts, so a fresh container with the same repository scores the
// same board.
//
// The dashboard is a static page, no framework and no network:
// dashboard/index.html, dashboard/app.css and dashboard/app.js read
// /output/data.js, which this program writes from the same board.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseFrozen, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));

// The frozen fundamentals are a second signal only: the program runs offline,
// so this file, written into the repository at build time, is the only outside
// data it reads. A missing or unusable file hides the fundamentals panel.
let frozen = null;
const frozenPath = join(here, 'data', 'frozen-fundamentals.json');
if (existsSync(frozenPath)) {
  frozen = parseFrozen(readFileSync(frozenPath, 'utf8'));
  if (frozen === null) process.stderr.write(`token radar: ${frozenPath} is unusable: the fundamentals panel will be empty\n`);
}

const { board, radar } = buildRadar(snapshot, frozen);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: size curve log(mcap) = ${radar.curve.intercept.toFixed(4)} + ${radar.curve.slope.toFixed(4)}*log(TVL) on ${radar.curve.comps} comps (R2 ${radar.curve.r2.toFixed(3)}), LOO median error x${radar.validation.median_error_ratio.toFixed(2)} (mean log ${radar.validation.mean_log_error.toFixed(2)}), worst case x${radar.validation.worst_cases[0]?.error_ratio.toFixed(1) ?? 'n/a'}\n` +
    `token radar: verdicts FARM ${radar.verdict_counts.FARM}, THIN ${radar.verdict_counts.THIN}, SKIP ${radar.verdict_counts.SKIP}\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')}, ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
