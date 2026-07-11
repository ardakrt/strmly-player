"use strict";

const PAGES = [
  { name: "Ana Sayfa", navIndex: 0 },
  { name: "Canlı TV", navIndex: 1 },
  { name: "Sinema", navIndex: 2 },
  { name: "Diziler", navIndex: 3 },
  { name: "Favorilerim", navIndex: 4 },
  { name: "Kaydedilenler", navIndex: 5 },
  { name: "Ayarlar", navIndex: -1 },
];

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function runPerformanceBenchmark(window, { iterations = 30, warmups = 2 } = {}) {
  const samples = await window.webContents.executeJavaScript(`(async () => {
    const pages = ${JSON.stringify(PAGES)};
    const iterations = ${iterations};
    const warmups = ${warmups};
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const deadline = performance.now() + 30000;

    while (!document.querySelector('nav[aria-label]')) {
      if (performance.now() > deadline) throw new Error('Navigation did not become ready within 30 seconds');
      await sleep(50);
    }

    const navigate = async page => {
      let button;
      if (page.navIndex === -1) {
        const profileButton = document.querySelector('nav button[aria-expanded]');
        profileButton?.click();
        await nextPaint();
        button = document.querySelector('button:has(svg.lucide-settings)');
      } else {
        const navButtons = [...document.querySelectorAll('nav div.hide-scrollbar > button')];
        button = navButtons[page.navIndex];
      }
      if (!button) throw new Error('Page button not found: ' + page.name);
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
    return results;
  })()`);

  return Object.fromEntries(Object.entries(samples).map(([page, values]) => [page, {
    medianMs: Number(percentile(values, 0.5).toFixed(2)),
    p95Ms: Number(percentile(values, 0.95).toFixed(2)),
    maxMs: Number(Math.max(...values).toFixed(2)),
    samples: values.map(value => Number(value.toFixed(2))),
  }]));
}

module.exports = { runPerformanceBenchmark };
