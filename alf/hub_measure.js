// Measure the hub's real needs: do the Viator photos load, and how tall does each
// GetYourGuide module want to be at its rendered width?
// usage: node hub_measure.js <page-url> [waitMs]
const PORT = process.env.CDP_PORT || 9335;
const url = process.argv[2];
const wait = Number(process.argv[3] || 12000);
const vp = (process.env.VIEWPORT || "1440x1000").split("x").map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify(sessionId ? { id: mid, method, params, sessionId } : { id: mid, method, params }));
    });
  await new Promise((res) => (ws.onopen = res));
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Target.setDiscoverTargets", { discover: true });
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: vp[0], height: vp[1], deviceScaleFactor: 1, mobile: vp[0] < 700 });
  await send("Page.navigate", { url });
  await sleep(wait);

  // 1. the Viator photos, as the page sees them
  const imgs = await send("Runtime.evaluate", {
    expression: `JSON.stringify([...document.querySelectorAll('.hub-card-img')].map(i => ({
        ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight, src: i.src.slice(0, 90)
      })))`,
    returnByValue: true
  });
  console.log("viator photos:", imgs.result.result.value);

  const frames = await send("Runtime.evaluate", {
    expression: `JSON.stringify([...document.querySelectorAll('iframe.live-avail')].map(f => ({ h: f.getBoundingClientRect().height, w: f.getBoundingClientRect().width, src: (f.src.match(/tour_id=(\\d+)/)||[])[1] })))`,
    returnByValue: true
  });
  console.log("frames on page:", frames.result.result.value);

  // 2. how tall each module's own document is right now
  const targets = await send("Target.getTargets");
  const list2 = targets.result.targetInfos.filter((t) => /widget\.getyourguide\.com/.test(t.url));
  for (const t of list2) {
    const att = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
    const sid = att.result.sessionId;
    await send("Runtime.enable", {}, sid);
    const r = await send("Runtime.evaluate", {
      expression: `JSON.stringify({ iw: window.innerWidth, ih: window.innerHeight,
        docH: document.documentElement.scrollHeight, bodyH: document.body.scrollHeight,
        docW: document.documentElement.scrollWidth,
        overflowY: document.documentElement.scrollHeight > window.innerHeight + 2 })`,
      returnByValue: true
    }, sid);
    const tour = (t.url.match(/tour_id=(\d+)/) || [])[1] || "?";
    console.log(`tour ${tour}: ${r.result.result.value}`);
  }
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error("driver error:", e.message); process.exit(1); });
