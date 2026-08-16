const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const electronBinary = require("electron");
const sourceProfiles = path.join(projectRoot, "profiles");
const benchmarkUserData = fs.mkdtempSync(
  path.join(os.tmpdir(), "strmly-performance-benchmark-"),
);
const iterations = Number(process.env.STRMLY_PERF_ITERATIONS) || 30;
const warmups = Number(process.env.STRMLY_PERF_WARMUPS) || 2;

function fail(message) {
  throw new Error(message);
}

function getPlaylistBytes(directory) {
  if (!fs.existsSync(directory)) return 0;
  return fs.readdirSync(directory, { withFileTypes: true }).reduce(
    (total, entry) =>
      total +
      (entry.isFile() ? fs.statSync(path.join(directory, entry.name)).size : 0),
    0,
  );
}

try {
  if (!fs.existsSync(path.join(sourceProfiles, "iptv-player-config.json"))) {
    fail(`A populated local profiles snapshot is required at ${sourceProfiles}.`);
  }
  if (getPlaylistBytes(path.join(sourceProfiles, "playlists")) < 1024 * 1024) {
    fail("A populated playlist snapshot is required; refusing to benchmark empty catalog data.");
  }

  fs.cpSync(sourceProfiles, path.join(benchmarkUserData, "profiles"), {
    recursive: true,
  });

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const build = spawnSync(npmCommand, ["run", "build"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (build.status !== 0 || !fs.existsSync(path.join(projectRoot, "dist", "index.html"))) {
    fail(`Production build failed with exit code ${build.status ?? "unknown"}.`);
  }

  const benchmark = spawnSync(electronBinary, [projectRoot], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      STRMLY_PERF_BENCH: "1",
      STRMLY_PERF_USER_DATA: benchmarkUserData,
      STRMLY_PERF_ITERATIONS: String(iterations),
      STRMLY_PERF_WARMUPS: String(warmups),
    },
  });
  const output = `${benchmark.stdout || ""}\n${benchmark.stderr || ""}`;
  process.stdout.write(output);
  const resultMatch = output.match(/STRMLY_PERF_RESULT=(\{[^\r\n]+\})/);
  if (!resultMatch) {
    fail(
      benchmark.status === 0
        ? "Performance benchmark exited without producing results."
        : `Performance benchmark failed with exit code ${benchmark.status ?? "unknown"}.`,
    );
  }

  const result = JSON.parse(resultMatch[1]);
  const navigationPages = Object.entries(result.navigation || {});
  if (navigationPages.length < 7) {
    fail("Performance benchmark did not measure every navigation page.");
  }
  for (const [pageName, metrics] of navigationPages) {
    if (!Array.isArray(metrics.samples) || metrics.samples.length !== iterations) {
      fail(`Navigation sample count mismatch for ${pageName}.`);
    }
    if (metrics.p95Ms > 60 || metrics.maxMs > 100) {
      fail(`Navigation performance regression on ${pageName}: p95=${metrics.p95Ms}ms max=${metrics.maxMs}ms.`);
    }
  }

  for (const pageName of ["Canli TV", "Sinema", "Diziler"]) {
    const metrics = result.scroll?.[pageName];
    if (!metrics || metrics.scrollRange < 1000 || metrics.renderedItemCount < 20) {
      fail(`Performance benchmark did not exercise the populated ${pageName} catalog.`);
    }
  }
  for (const [pageName, metrics] of Object.entries(result.scroll || {})) {
    if (
      metrics.scrollRange > 0 &&
      (metrics.p95FrameMs > 24 ||
        metrics.maxFrameMs > 80 ||
        metrics.missedFramePercent > 5)
    ) {
      fail(`Scroll performance regression on ${pageName}.`);
    }
  }

  console.log(
    `Performance benchmark completed successfully (iterations=${iterations} warmups=${warmups}).`,
  );
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
} finally {
  fs.rmSync(benchmarkUserData, { recursive: true, force: true });
}
