// Optional network smoke check, using a fresh tab with no fixture or clock override.
const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const socket = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let counter = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    pending.get(message.id)(message.result);
    pending.delete(message.id);
  }
});
function command(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++counter;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
}
const target = await command('Target.createTarget', {
  url: 'http://127.0.0.1:5173/#/board/live-weather-check',
});
const all = await (await fetch('http://127.0.0.1:9222/json/list')).json();
socket.close();
const live = new WebSocket(all.find((page) => page.id === target.targetId).webSocketDebuggerUrl);
await new Promise((resolve) => live.addEventListener('open', resolve, { once: true }));
live.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    pending.get(message.id)(message.result);
    pending.delete(message.id);
  }
});
async function evaluate(expression) {
  const result = await new Promise((resolve) => {
    const id = ++counter;
    pending.set(id, resolve);
    live.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true },
      }),
    );
  });
  return result.result.value;
}
let environment;
for (let i = 0; i < 260; i++) {
  environment = await evaluate(
    `(() => { const root=document.querySelector('.travel-board'); const refresh=document.querySelector('#board-weather-refresh'); return root&&refresh ? {loading:refresh.disabled,weather:root.dataset.weather,time:root.dataset.time,summary:document.querySelector('#board-weather-summary').textContent,status:document.querySelector('#board-weather-update').textContent} : null; })()`,
  );
  if (environment && !environment.loading) break;
  await new Promise((resolve) => setTimeout(resolve, 50));
}
console.log('Live weather:', environment);
live.close();
