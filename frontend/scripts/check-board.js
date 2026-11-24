import assert from 'node:assert/strict';
import { rollYut } from '../src/pages/board/yut-result.js';

const frequencies = [0, 0, 0, 0, 0];
for (let mask = 0; mask < 16; mask++) {
  let draw = 0;
  const result = rollYut(() => (mask & (1 << draw++) ? 0.1 : 0.9));
  assert.equal(draw, 4);
  assert.equal(result.steps, result.flatCount || 5);
  assert.equal(result.name, ['모', '도', '개', '걸', '윷'][result.flatCount]);
  frequencies[result.flatCount]++;
}
assert.deepEqual(frequencies, [1, 4, 6, 4, 1]);

const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const socket = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let counter = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(message.error);
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
});
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++counter;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
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
  for (let i = 0; i < 240; i++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  console.log('Browser errors:', JSON.stringify(errors));
  console.log('Body:', await evaluate('document.body.innerText'));
  throw new Error('Timed out: ' + expression);
}
const slots = [1, 2, 4, 5, 7, 8, 10, 11];
await command('Runtime.enable');
await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await command('Page.navigate', {
  url: 'http://127.0.0.1:5173/?check=' + Date.now() + '#/board/default',
});
await until(`document.querySelectorAll('#board-list .card').length === 8`);
errors.length = 0;
await evaluate(
  `localStorage.removeItem('travel-notice:boards:default'); localStorage.removeItem('travel-notice:favorites'); location.reload()`,
);
await until(
  `document.querySelectorAll('#board-list .card').length === 8 && document.querySelector('#board-cnt').textContent === '0 / 8 여행지 등록됨'`,
);
assert.equal(await evaluate(`document.querySelector('#board-roll').disabled`), true);
assert.equal(
  await evaluate(`getComputedStyle(document.querySelector('#board-stage')).position`),
  'absolute',
);
assert.equal(
  await evaluate(`getComputedStyle(document.querySelector('#board-thrown')).position`),
  'fixed',
);
// Real pointer drag through Chrome input, including the target glow and clone.
const geometry = await evaluate(
  `(() => { const card=document.querySelector('#board-list .card').getBoundingClientRect(); const tile=document.querySelector('.slot[data-i="1"] .top').getBoundingClientRect(); return {x:card.x+30,y:card.y+30,tx:tile.x+tile.width/2,ty:tile.y+tile.height/2}; })()`,
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
assert.equal(
  await evaluate(
    `!!document.querySelector('.slot.hot') && !!document.querySelector('.card.drag:not([hidden])')`,
  ),
  true,
);
await command('Input.dispatchMouseEvent', {
  type: 'mouseReleased',
  x: geometry.tx,
  y: geometry.ty,
  button: 'left',
  clickCount: 1,
});
assert.equal(
  await evaluate(`document.querySelector('#board-cnt').textContent`),
  '1 / 8 여행지 등록됨',
);
assert.equal(
  await evaluate(
    `!!document.querySelector('.slot[data-i="1"] .pop') && document.querySelector('#board-toast').classList.contains('show')`,
  ),
  true,
);
await evaluate(
  `document.querySelector('#board-list .card:not(.used)').click(); document.querySelector('.slot[data-i="1"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`,
);
assert.equal(
  await evaluate(`document.querySelector('#board-cnt').textContent`),
  '1 / 8 여행지 등록됨',
);
// Native double click places exactly once in the first empty destination slot.
const doubleClickPoint = await evaluate(
  `(() => { const rect=document.querySelector('#board-list .card:not(.used)').getBoundingClientRect(); return {x:rect.x+30,y:rect.y+30}; })()`,
);
for (const clickCount of [1, 2]) {
  await command('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...doubleClickPoint,
    button: 'left',
    clickCount,
  });
  await command('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...doubleClickPoint,
    button: 'left',
    clickCount,
  });
}
assert.equal(
  await evaluate(`document.querySelector('#board-cnt').textContent`),
  '2 / 8 여행지 등록됨',
);
assert.equal(await evaluate(`!!document.querySelector('.slot[data-i="2"] .pop')`), true);
assert.equal(
  await evaluate(`document.querySelector('#board-left h2').textContent`),
  '내 여행 보따리',
);
for (const index of slots.slice(2)) {
  await evaluate(
    `document.querySelector('#board-list .card:not(.used)').click(); document.querySelector('.slot[data-i="${index}"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`,
  );
}
assert.equal(
  await evaluate(`document.querySelector('#board-cnt').textContent`),
  '8 / 8 여행지 등록됨',
);
assert.equal(await evaluate(`document.querySelector('#board-roll').disabled`), false);
assert.equal(
  await evaluate(
    `document.querySelector('.road').classList.contains('glow') && document.querySelector('#board-ready').classList.contains('show')`,
  ),
  true,
);
await evaluate(`document.querySelector('#board-save').click()`);
await until(`JSON.parse(localStorage.getItem('travel-notice:boards:default')).cells.length === 8`);
await evaluate('location.reload()');
await until(`document.querySelector('#board-cnt')?.textContent === '8 / 8 여행지 등록됨'`);
// Real-time throws also cover the remaining two possible results and the flight animation.
async function throwYut(flatCount) {
  await evaluate(
    `(() => { let draw=0; Math.random=()=>draw++ < 4 ? (draw <= ${flatCount} ? .1 : .9) : .1; document.querySelector('#board-roll').click(); })()`,
  );
}
await throwYut(2);
assert.equal(await evaluate(`document.querySelector('#board-thrown').style.opacity`), '1');
assert.equal(await evaluate(`document.querySelectorAll('.yut-flight').length`), 4);
await until(`document.querySelector('#board-res').textContent === '개! 2칸 이동!'`);
assert.equal(
  await evaluate(`document.querySelectorAll('.yut-flight[data-flat="true"]').length`),
  2,
);
await until(`!document.querySelector('#board-roll').disabled`);
assert.equal(await evaluate(`document.querySelector('#board-res').textContent`), '개! 2칸 이동!');
await throwYut(3);
await until(`!document.querySelector('#board-roll').disabled`);
assert.equal(await evaluate(`document.querySelector('#board-res').textContent`), '걸! 3칸 이동!');
await throwYut(1);
await until(`document.querySelectorAll('.slot.pick').length === 8`);
await evaluate(
  `document.querySelector('.slot[data-i="1"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`,
);
await until(`!document.querySelector('#board-roll').disabled`);
await evaluate('location.reload()');
await until(`document.querySelector('#board-cnt')?.textContent === '8 / 8 여행지 등록됨'`);
// Speed up the gameplay while preserving the real state and event flow.
await command('Emulation.setEmulatedMedia', {
  features: [
    { name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-color-scheme', value: 'dark' },
  ],
});
for (let i = 1; i <= 5; i++) {
  await throwYut(1);
  if (i === 5) {
    await until(`document.querySelectorAll('.slot.pick').length === 8`);
    await evaluate(
      `document.querySelector('.slot[data-i="11"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`,
    );
  }
  await until(`!document.querySelector('#board-roll').disabled`);
}
const playerAt = await evaluate(
  `document.querySelector('#board-board').lastElementChild.getAttribute('transform')`,
);
const t = (11 / 12) * Math.PI * 2 + Math.PI * 0.5;
const target = `translate(${500 + 370 * Math.cos(t) + 30 * Math.sin(2 * t)},${330 + 175 * Math.sin(t) + 34 * Math.sin(3 * t) - 6})`;
assert.equal(playerAt, target);
await throwYut(1);
await until(`!document.querySelector('#board-roll').disabled`);
assert.equal(
  await evaluate(
    `document.querySelector('#board-board').lastElementChild.getAttribute('transform')`,
  ),
  'translate(500,465)',
);
for (const [count, message] of [
  [4, '윷! 4칸 이동!'],
  [0, '모! 5칸 이동!'],
]) {
  await throwYut(count);
  await until(`!document.querySelector('#board-roll').disabled`);
  assert.equal(await evaluate(`document.querySelector('#board-res').textContent`), message);
}
assert.equal(
  await evaluate(
    `getComputedStyle(document.querySelector('.travel-board')).getPropertyValue('--bg').trim()`,
  ),
  '#1d1c19',
);
assert.equal(await evaluate(`document.querySelector('#board-bg').animationsPaused()`), true);
await command('Emulation.setEmulatedMedia', { features: [] });
await evaluate(`document.querySelector('#board-reset').click()`);
assert.equal(
  await evaluate(`document.querySelector('#board-cnt').textContent`),
  '0 / 8 여행지 등록됨',
);
assert.equal(await evaluate(`document.querySelectorAll('#board-list .card:not(.used)').length`), 8);
// Loading edge cases, safely returned to the default demo afterwards.
for (const data of [[], [{ id: 'one', name: '한 곳', region: '서울' }], {}]) {
  await evaluate(
    `localStorage.setItem('travel-notice:favorites', ${JSON.stringify(JSON.stringify(data))}); location.reload()`,
  );
  await until(
    `document.querySelector('#board-data-status')?.textContent !== '보따리의 여행지를 불러오는 중입니다.'`,
  );
  assert.equal(await evaluate(`document.querySelector('#board-roll').disabled`), true);
}
await evaluate(`localStorage.removeItem('travel-notice:favorites'); location.reload()`);
await until(`document.querySelector('#board-cnt')?.textContent === '8 / 8 여행지 등록됨'`);
// Dispose while a throw is active, then remount. No orphan drag or duplicate listeners.
await throwYut(2);
await evaluate(`location.hash = '/mypage';`);
await until(`!document.querySelector('.travel-board')`);
await evaluate(`location.hash = '/board/default'`);
await until(`document.querySelector('#board-cnt')?.textContent === '8 / 8 여행지 등록됨'`);
assert.equal(await evaluate(`document.querySelectorAll('.yut-flight').length`), 0);
assert.equal(await evaluate(`document.querySelector('#board-roll').textContent`), '🪵 윷 던지기');
assert.deepEqual(errors, []);
await command('Emulation.setDeviceMetricsOverride', {
  width: 1100,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
assert.equal(
  await evaluate(`getComputedStyle(document.querySelector('#board-left')).width`),
  '210px',
);
assert.equal(
  await evaluate(`getComputedStyle(document.querySelector('#board-yut')).width`),
  '200px',
);
console.log(
  'PASS: fair 16-outcome distribution, four animated sticks, all five Yut results, drag, keyboard placement, save/restore, key event, airport, wraparound, reset, empty/short/error data, dark/reduced motion, route cleanup.',
);
if (process.argv.includes('--close')) await command('Browser.close');
socket.close();
