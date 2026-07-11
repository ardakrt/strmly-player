"use strict";

const PAGES = [
  { name: "Ana Sayfa", navIndex: 0 },
  { name: "Canli TV", navIndex: 1 },
  { name: "Sinema", navIndex: 2 },
  { name: "Diziler", navIndex: 3 },
  { name: "Favorilerim", navIndex: 4 },
  { name: "Kaydedilenler", navIndex: 5 },
  { name: "Ayarlar", navIndex: -1 },
];

function percentile(values, ratio) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function runPerformanceBenchmark(window, { iterations = 30, warmups = 2 } = {}) {
  const benchmark = await window.webContents.executeJavaScript(`(async () => {
    const pages = ${JSON.stringify(PAGES)};
    const iterations = ${iterations};
    const warmups = ${warmups};
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const deadline = performance.now() + 30000;

    const navReady = async () => {
      while (true) {
        const nav = document.querySelector('nav[aria-label]');
        const links = nav ? [...nav.querySelectorAll('div.hide-scrollbar > button')] : [];
        if (nav && links.length >= 6) return links;
        if (performance.now() > deadline) {
          throw new Error('Navigation did not become ready within 30 seconds (links=' + links.length + ')');
        }
        await sleep(50);
      }
    };
    await navReady();

    const navigate = async page => {
      let button;
      if (page.navIndex === -1) {
        const profileButton = document.querySelector('nav button[aria-expanded]');
        profileButton?.click();
        await nextPaint();
        await sleep(80);
        button = document.querySelector('button:has(svg.lucide-settings)')
          || [...document.querySelectorAll('button')].find(b => /settings|ayar/i.test(b.getAttribute('aria-label') || b.textContent || ''));
      } else {
        const navButtons = await navReady();
        button = navButtons[page.navIndex];
      }
      if (!button) throw new Error('Page button not found: ' + page.name + ' (navIndex=' + page.navIndex + ')');
      const start = performance.now();
      button.click();
      await nextPaint();
      return performance.now() - start;
    };

    const results = Object.fromEntries(pages.map(page => [page.name, []]));
    for (let pass = 0; pass < warmups + iterations; pass += 1) {
      for (const page of pages) {
        const duration = await navigate(page);
        if (pass >= warmups) results[page.name].push(duration);
      }
    }
    const scrollResults = {};
    for (const page of pages) {
      await navigate(page);
      const candidates = [document.scrollingElement, ...document.querySelectorAll('*')]
        .filter(Boolean)
        .filter(element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 &&
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            element.scrollHeight - element.clientHeight > 32;
        });
      const target = candidates.sort((a, b) =>
        (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight)
      )[0];
      if (!target) {
        scrollResults[page.name] = { scrollRange: 0, frames: [] };
        continue;
      }

      const scrollRange = Math.min(2400, target.scrollHeight - target.clientHeight);
      const frames = [];
      let previous = performance.now();
      target.scrollTop = 0;
      for (let frame = 1; frame <= 120; frame += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const now = performance.now();
        frames.push(now - previous);
        previous = now;
        const progress = frame <= 60 ? frame / 60 : (120 - frame) / 60;
        target.scrollTop = scrollRange * progress;
      }
      scrollResults[page.name] = { scrollRange, frames };
    }
    return { navigation: results, scroll: scrollResults };
  })()`);

  const navigation = Object.fromEntries(Object.entries(benchmark.navigation).map(([page, values]) => [page, {
    medianMs: Number(percentile(values, 0.5).toFixed(2)),
    p95Ms: Number(percentile(values, 0.95).toFixed(2)),
    maxMs: Number(Math.max(...values).toFixed(2)),
    samples: values.map(value => Number(value.toFixed(2))),
  }]));
  const scroll = Object.fromEntries(Object.entries(benchmark.scroll).map(([page, result]) => {
    const values = result.frames;
    return [page, values.length === 0 ? {
      scrollRange: 0,
      medianFrameMs: 0,
      p95FrameMs: 0,
      maxFrameMs: 0,
      missedFramePercent: 0,
    } : {
      scrollRange: Math.round(result.scrollRange),
      medianFrameMs: Number(percentile(values, 0.5).toFixed(2)),
      p95FrameMs: Number(percentile(values, 0.95).toFixed(2)),
      maxFrameMs: Number(Math.max(...values).toFixed(2)),
      missedFramePercent: Number((values.filter(value => value > 20).length / values.length * 100).toFixed(2)),
    }];
  }));
  return { navigation, scroll };
}

module.exports = { runPerformanceBenchmark };
