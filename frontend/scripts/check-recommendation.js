// Run Vite on 5173 and a separate headless Chrome with --remote-debugging-port=9223.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pages = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const socket = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let serial = 0;
const pending = new Map(),
  errors = [];
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(message.error);
    else task.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Fetch.requestPaused') {
    const {
      requestId,
      request: { url },
    } = message.params;
    if (url.includes('recommendationApi.js') && !url.includes('browser-real')) {
      // Keep the real catalog for success paths, while controlling failures and pending work.
      const source = `export async function getRecommendationCatalog(options) {
        if (window.__catalogDelay) await new Promise(r => setTimeout(r, window.__catalogDelay));
        options?.signal?.throwIfAborted();
        if (window.__catalogFailure) throw new Error('추천 목록 연결 실패');
        return (await import('/src/api/recommendationApi.js?browser-real=1')).getRecommendationCatalog(options);
      }`;
      void command('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'text/javascript' }],
        body: Buffer.from(source).toString('base64'),
      });
    } else if (url.includes('api.open-meteo.com')) {
      const data = {
        current: { time: 1792022400, weather_code: 0, temperature_2m: 22, wind_speed_10m: 5 },
        timezone: 'Asia/Seoul',
      };
      void command('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'content-type', value: 'application/json' },
          { name: 'access-control-allow-origin', value: '*' },
        ],
        body: Buffer.from(JSON.stringify(data)).toString('base64'),
      });
    } else void command('Fetch.continueRequest', { requestId });
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
  for (let i = 0; i < 200; i++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error(
    'Timed out: ' +
      expression +
      '\n' +
      JSON.stringify(errors) +
      '\n' +
      (await evaluate('document.body.innerText')),
  );
}
const count = () => evaluate(`document.querySelector('#board-cnt').textContent`);
const recommend = async () => {
  await evaluate(`document.querySelector('#board-source-recommended').click()`);
  await until(
    `document.querySelector('#board-list').getAttribute('aria-busy') === 'false' && document.querySelectorAll('#board-list .card').length===8`,
  );
};
const save = async (length) => {
  await evaluate(`document.querySelector('#board-save').click()`);
  await until(
    `JSON.parse(localStorage.getItem('travel-notice:boards:recommendation-test')).cells.length===${length}`,
  );
};
try {
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Fetch.enable', {
    patterns: [{ urlPattern: '*api.open-meteo.com*' }, { urlPattern: '*recommendationApi.js*' }],
  });
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await command('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await command('Page.navigate', { url: 'http://127.0.0.1:5173/#/board/recommendation-test' });
  await until(`!!document.querySelector('#board-source-carrier')`);
  const carrier = [
    {
      id: 'my-bag',
      title: '<img src=x onerror="window.injected=true">',
      contentTypeId: '12',
      typeName: '관광지',
      address: '서울특별시 종로구',
      lat: 37.5,
      lng: 127,
    },
  ];
  await evaluate(
    `localStorage.setItem('travel-notice:carrier', ${JSON.stringify(JSON.stringify(carrier))});localStorage.removeItem('travel-notice:boards:recommendation-test');localStorage.setItem('travel-notice:board-progress',JSON.stringify({mileage:3,rewards:2}));location.reload()`,
  );
  await until(
    `document.querySelectorAll('#board-list .card').length===1 && document.querySelector('#board-cnt')?.textContent==='0 / 8 여행지 등록됨'`,
  );
  assert.equal(
    await evaluate(
      `!!document.querySelector('#board-recommend') || !!document.querySelector('dialog')`,
    ),
    false,
  );
  assert.equal(
    await evaluate(`!!window.injected || !!document.querySelector('#board-list img')`),
    false,
  );
  await recommend();
  assert.equal(await count(), '0 / 8 여행지 등록됨');
  assert.equal(
    await evaluate(`document.querySelector('#board-list-title').textContent`),
    '추천 여행지',
  );
  assert.ok(
    await evaluate(
      `Array.from(document.querySelectorAll('#board-list .card')).some(c=>c.dataset.id!=='my-bag')`,
    ),
  );
  assert.equal(
    await evaluate(`JSON.parse(localStorage.getItem('travel-notice:carrier')).length`),
    1,
  );
  // Real pointer drag of a recommendation that is not saved in the carrier.
  const geometry = await evaluate(
    `(() => {const c=Array.from(document.querySelectorAll('#board-list .card')).find(c=>c.dataset.id!=='my-bag');const r=c.getBoundingClientRect();const t=document.querySelector('.slot[data-i="1"] .top').getBoundingClientRect();return {id:c.dataset.id,x:r.x+25,y:r.y+20,tx:t.x+t.width/2,ty:t.y+t.height/2}})()`,
  );
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: geometry.x,
    y: geometry.y,
    button: 'left',
    clickCount: 1,
  });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: geometry.tx,
    y: geometry.ty,
    button: 'left',
    buttons: 1,
  });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: geometry.tx,
    y: geometry.ty,
    button: 'left',
    clickCount: 1,
  });
  assert.equal(await count(), '1 / 8 여행지 등록됨');
  await save(1);
  assert.equal(
    await evaluate(
      `JSON.parse(localStorage.getItem('travel-notice:boards:recommendation-test')).cells[0].placeId`,
    ),
    geometry.id,
  );
  await evaluate(
    `document.querySelector('#board-source-carrier').click();document.querySelector('#board-list .card').click();document.querySelector('.slot[data-i="2"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`,
  );
  assert.equal(await count(), '2 / 8 여행지 등록됨');
  assert.equal(await evaluate(`document.querySelectorAll('#board-list .card').length`), 1);
  await recommend();
  await evaluate(
    `document.querySelector('#board-list .card:not(.used)').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
  );
  assert.equal(await count(), '3 / 8 여행지 등록됨');
  await save(3);
  await evaluate(`location.reload()`);
  await until(`document.querySelector('#board-cnt')?.textContent==='3 / 8 여행지 등록됨'`);
  assert.equal(await evaluate(`document.querySelectorAll('#board-list .card').length`), 1);
  assert.deepEqual(
    await evaluate(`JSON.parse(localStorage.getItem('travel-notice:board-progress'))`),
    { mileage: 3, rewards: 2 },
  );
  await recommend();
  // Selecting and keyboard placing remains identical to carrier cards; filled cards cannot duplicate.
  await evaluate(
    `document.querySelector('#board-list .card:not(.used)').click();document.querySelector('.slot[data-i="5"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`,
  );
  assert.equal(await count(), '4 / 8 여행지 등록됨');
  await save(4);
  const cells = await evaluate(
    `JSON.parse(localStorage.getItem('travel-notice:boards:recommendation-test')).cells`,
  );
  assert.deepEqual(
    cells.map((c) => c.index),
    [1, 2, 4, 5],
  );
  assert.equal(new Set(cells.map((c) => c.placeId)).size, 4);
  for (let i = 0; i < 4; i++) {
    await evaluate(
      `document.querySelector('#board-list .card:not(.used)').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
    );
  }
  assert.equal(await count(), '8 / 8 여행지 등록됨');
  await save(8);
  const locked = await evaluate(
    `(() => {Math.random=()=>.9;document.querySelector('#board-roll').click();return document.querySelector('#board-source-carrier').disabled && document.querySelector('#board-source-recommended').disabled && Array.from(document.querySelectorAll('#board-list .card')).every(c=>c.disabled)})()`,
  );
  assert.equal(locked, true);
  await until(`!document.querySelector('#board-reset').disabled`);
  await command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  assert.equal(
    await evaluate(
      `(() => {const r=document.querySelector('.board-source-switch').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth})()`,
    ),
    true,
  );
  const screenshot = join(tmpdir(), 'yutopia-recommendation-panel.png');
  const shot = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(screenshot, Buffer.from(shot.data, 'base64'));
  // No saved items are required; regional TourAPI examples still provide eight cards.
  await evaluate(
    `localStorage.setItem('travel-notice:carrier','[]');localStorage.removeItem('travel-notice:boards:recommendation-test');location.reload()`,
  );
  await until(
    `document.querySelector('#board-source-recommended') && !document.querySelector('#board-source-recommended').disabled`,
  );
  await recommend();
  assert.equal(await count(), '0 / 8 여행지 등록됨');
  assert.equal(
    await evaluate(`JSON.parse(localStorage.getItem('travel-notice:carrier')).length`),
    0,
  );
  assert.equal(
    await evaluate(
      `Array.from(document.querySelectorAll('#board-list .card')).every(c=>c.dataset.id.startsWith('900'))`,
    ),
    true,
  );
  // Delayed work can be cancelled by toggling sources; the next request still succeeds.
  await evaluate(
    `document.querySelector('#board-source-carrier').click();window.__catalogDelay=200;import('/src/store/carrierStore.js').then(({carrierStore})=>carrierStore.setState({items:[]}));document.querySelector('#board-source-recommended').click();document.querySelector('#board-source-carrier').click()`,
  );
  assert.equal(
    await evaluate(`document.querySelector('#board-source-carrier').getAttribute('aria-pressed')`),
    'true',
  );
  await evaluate(`window.__catalogDelay=0;window.__catalogFailure=true`);
  await evaluate(`document.querySelector('#board-source-recommended').click()`);
  await until(`!document.querySelector('#board-recommend-retry').hidden`);
  assert.match(
    await evaluate(`document.querySelector('#board-data-status').textContent`),
    /연결 실패/,
  );
  await evaluate(
    `window.__catalogFailure=false;document.querySelector('#board-recommend-retry').click()`,
  );
  await until(`document.querySelectorAll('#board-list .card').length===8`);
  await evaluate(`location.hash='/mypage'`);
  await until(`!document.querySelector('.travel-board')`);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: national recommendations, empty bag, source switch, drag/double-click/keyboard placement, persistence, rewards, XSS, mobile, cancellation/retry and lifecycle. Screenshot: ' +
      screenshot,
  );
} finally {
  socket.close();
}
