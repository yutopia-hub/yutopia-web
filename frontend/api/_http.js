// Vercel 함수와 Vite 개발 미들웨어가 같이 쓰는 JSON 요청/응답 도우미

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw =
    typeof req.body === 'string'
      ? req.body
      : await new Promise((resolve, reject) => {
          let text = '';
          req.on('data', (chunk) => {
            text += chunk;
            if (text.length > 200_000) reject(new Error('요청이 너무 큽니다.'));
          });
          req.on('end', () => resolve(text));
          req.on('error', reject);
        });
  return JSON.parse(raw || '{}');
}

/** POST 전용 JSON 핸들러를 만든다. fn(body) 의 반환값을 200 으로, 에러는 error.status 로 보낸다 */
export function jsonHandler(fn) {
  return async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST 만 지원합니다.' });
    try {
      sendJson(res, 200, await fn(await readJson(req)));
    } catch (error) {
      sendJson(res, error.status ?? 500, { error: error.message });
    }
  };
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
