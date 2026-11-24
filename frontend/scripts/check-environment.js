import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { weatherKind, normalizeWeather } from '../src/api/weatherApi.js';
import { timeOfDay } from '../src/pages/board/environment-time.js';

for (const [code, kind] of [
  [0, 'clear'],
  [2, 'cloudy'],
  [3, 'overcast'],
  [45, 'fog'],
  [61, 'rain'],
  [73, 'snow'],
  [95, 'rain'],
])
  assert.equal(weatherKind(code), kind);
assert.equal(weatherKind(0, 1), 'rain');
assert.equal(weatherKind(0, 0, 1), 'snow');
assert.throws(() => normalizeWeather({ current: {} }));
const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const socket = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let counter = 0;
const pending = new Map(),
  errors = [],
  requests = [];
let code = 0,
  fail = false;
let now = Date.parse('2026-10-02T00:00:00Z');
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++counter;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
socket.addEventListener('message', async (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(message.error);
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Fetch.requestPaused') {
    requests.push(message.params.request.url);
    const payload = {
      timezone: 'Asia/Seoul',
      current: {
        time: now / 1000,
        weather_code: code,
        temperature_2m: 19,
        precipitation: code === 61 ? 1 : 0,
        snowfall: code === 73 ? 0.2 : 0,
        cloud_cover: code === 2 ? 60 : code === 3 ? 95 : 10,
      },
      daily: {
        sunrise: [Date.parse('2026-10-01T21:00:00Z') / 1000],
        sunset: [Date.parse('2026-10-02T09:00:00Z') / 1000],
      },
    };
    await command('Fetch.fulfillRequest', {
      requestId: message.params.requestId,
      responseCode: fail ? 503 : 200,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: '*' },
      ],
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
    });
  }
});
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression) {
  for (let i = 0; i < 300; i++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out: ' + expression);
}
await command('Runtime.enable');
await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await command('Fetch.enable', { patterns: [{ urlPattern: 'https://api.open-meteo.com/*' }] });
const clockOverride = await command('Page.addScriptToEvaluateOnNewDocument', {
  source: `Date.now=()=>${now}`,
});
await command('Page.navigate', {
  url: 'http://127.0.0.1:5173/?environment=' + Date.now() + '#/board/environment-check',
});
await until(`document.querySelector('#board-weather-summary')?.textContent.includes('19°')`);
errors.length = 0;
assert.equal(
  await evaluate(`document.querySelector('#board-weather-location').textContent`),
  '서울 기준',
);
for (const [hour, period] of [
  [9, 'morning'],
  [13, 'day'],
  [18, 'evening'],
  [23, 'night'],
]) {
  now = Date.parse(`2026-10-02T${String(hour - 9).padStart(2, '0')}:00:00Z`);
  for (const [nextCode, kind] of [
    [0, 'clear'],
    [2, 'cloudy'],
    [3, 'overcast'],
    [45, 'fog'],
    [61, 'rain'],
    [73, 'snow'],
  ]) {
    code = nextCode;
    await evaluate(`Date.now=()=>${now}; document.querySelector('#board-weather-refresh').click()`);
    await until(`!document.querySelector('#board-weather-refresh').disabled`);
    assert.equal(await evaluate(`document.querySelector('.travel-board').dataset.weather`), kind);
    assert.equal(await evaluate(`document.querySelector('.travel-board').dataset.time`), period);
    assert.equal(
      timeOfDay(now, {
        timezone: 'Asia/Seoul',
        solarDays: [
          {
            sunrise: Date.parse('2026-10-01T21:00:00Z'),
            sunset: Date.parse('2026-10-02T09:00:00Z'),
          },
        ],
      }),
      period,
    );
    assert.equal(
      await evaluate(
        `getComputedStyle(document.querySelector('#board-weather-effects')).pointerEvents`,
      ),
      'none',
    );
    assert.equal(
      await evaluate(`getComputedStyle(document.querySelector('.weather-rain')).opacity`),
      kind === 'rain' ? '0.5' : '0',
    );
    if (period === 'night')
      assert.equal(
        await evaluate(`getComputedStyle(document.querySelector('.sky-sun')).display`),
        'none',
      );
  }
}
// All decorative landmarks and names remain clear of every interaction tile.
const overlaps = await evaluate(
  `(() => { const decorations=[...document.querySelectorAll('.decor-object')]; const tiles=[...document.querySelectorAll('.slot')]; return decorations.flatMap(object=>{const a=object.getBoundingClientRect();return tiles.filter(tile=>{const b=tile.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}).map(tile=>({decoration:object.classList.value,index:tile.dataset.i}));}); })()`,
);
assert.deepEqual(overlaps, []);
const decorativeOverlaps = await evaluate(
  `(() => { const objects=[...document.querySelectorAll('.decor-object')]; return objects.flatMap((object,i)=>{const a=object.getBoundingClientRect();return objects.slice(i+1).filter(other=>{const b=other.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}).map(other=>[object.classList.value,other.classList.value]);}); })()`,
);
if (decorativeOverlaps.length)
  console.log(
    await evaluate(
      `[...document.querySelectorAll('.decor-object')].map(object=>({name:object.classList.value,box:object.getBBox(),rect:object.getBoundingClientRect().toJSON()}))`,
    ),
  );
assert.deepEqual(decorativeOverlaps, []);
const playerOverlaps = await evaluate(
  `(() => { const b=document.querySelector('#board-board').lastElementChild.getBoundingClientRect(); return [...document.querySelectorAll('.decor-object')].filter(object=>{const a=object.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}).map(object=>object.classList.value); })()`,
);
assert.deepEqual(playerOverlaps, []);
assert.equal(
  await evaluate(`getComputedStyle(document.querySelector('.board-decorations')).pointerEvents`),
  'none',
);
await command('Browser.grantPermissions', {
  origin: 'http://127.0.0.1:5173',
  permissions: ['geolocation'],
});
await command('Emulation.setGeolocationOverride', {
  latitude: 35.1796,
  longitude: 129.0756,
  accuracy: 100,
});
await evaluate(`document.querySelector('#board-locate').click()`);
await until(
  `document.querySelector('#board-weather-location').textContent === '현재 위치' && !document.querySelector('#board-weather-refresh').disabled`,
);
assert.ok(requests.some((url) => url.includes('latitude=35.1796')));
fail = true;
await evaluate(`document.querySelector('#board-weather-refresh').click()`);
await until(
  `document.querySelector('#board-weather-update').textContent.includes('업데이트 지연')`,
);
assert.equal(await evaluate(`document.querySelector('.travel-board').dataset.weather`), 'snow');
await command('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
assert.equal(
  await evaluate(`getComputedStyle(document.querySelector('.snow-flake')).animationName`),
  'none',
);
fail = false;
code = 0;
await command('Emulation.setEmulatedMedia', { features: [] });
await evaluate(`document.querySelector('#board-weather-refresh').click()`);
await until(`!document.querySelector('#board-weather-refresh').disabled`);
await mkdir('tmp', { recursive: true });
const screenshot = await command('Page.captureScreenshot', { format: 'png' });
await writeFile('tmp/environment.png', Buffer.from(screenshot.data, 'base64'));
await evaluate(`location.hash='/mypage'`);
await until(`!document.querySelector('.travel-board')`);
assert.deepEqual(errors, []);
await command('Browser.resetPermissions');
await command('Emulation.clearGeolocationOverride');
await command('Fetch.disable');
await command('Page.removeScriptToEvaluateOnNewDocument', { identifier: clockOverride.identifier });
console.log(
  'PASS: 24 time/weather combinations, response mapping, real coordinates, failure fallback, no decorative/slot overlap, reduced motion, pointer isolation and route cleanup.',
);
socket.close();
