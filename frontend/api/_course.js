// OpenAI 로 코스에 넣을 장소를 고르는 서버 로직.
// 브라우저에 키가 노출되지 않도록 서버(Vercel 함수 / Vite 개발 서버)에서만 실행한다.
// 방문 "순서"는 AI 가 아니라 프론트의 TSP 비트마스킹 DP 가 정한다. AI 는 고르기만 한다.

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MAX_STOPS = 7;

function buildPrompt({ region, categories, candidates, weather }) {
  const list = candidates
    .map(
      (c) =>
        `- id=${c.id} | ${c.title} | ${c.categoryLabel}${c.setting ? `(${c.setting === 'indoor' ? '실내' : c.setting === 'outdoor' ? '야외' : '기타'})` : ''} | ${c.address ?? ''}${c.distanceM ? ` | 중심에서 ${c.distanceM}m` : ''}`,
    )
    .join('\n');
  // 날씨 요약/지침은 프론트의 날씨 정책(weatherPolicy.js)이 만든 짧은 문장이다
  const weatherBlock = weather?.summary
    ? `
현재 날씨: ${String(weather.summary).slice(0, 120)}
날씨 지침: ${String(weather.guidance ?? '').slice(0, 200)}
`
    : '';
  return `여행 지역: ${region}${weatherBlock}
사용자가 고른 카테고리: ${categories.length ? categories.join(', ') : '(없음, 관광 위주)'}

후보 장소:
${list}

위 후보 중에서 하루 여행 코스에 넣을 장소를 3~${MAX_STOPS}곳 골라 주세요.
- 사용자가 고른 카테고리는 각각 최소 1곳씩 포함하고, 관광명소도 섞어 다양하게 구성하세요.
- 숙박은 최대 1곳, 대중교통(역)은 최대 1곳만 고르세요.
- 각 장소의 예상 체류 시간(분)과 한 줄 추천 이유를 적어 주세요.
- 현재 날씨가 주어졌다면 날씨 지침을 반영하세요. (비·눈·폭염·한파면 실내 장소 위주, 맑으면 야외 명소 적극 포함) 추천 이유에 날씨를 언급해도 좋습니다.
- 방문 순서는 신경 쓰지 마세요. (별도 알고리즘이 최단 경로로 정렬합니다)
- 반드시 후보 목록의 id 만 사용하세요.

JSON 으로만 답하세요:
{"title":"코스 이름","summary":"코스 한 줄 소개","stops":[{"id":"...","stayMinutes":60,"reason":"..."}]}`;
}

/**
 * @param {{ region: string, categories: string[], candidates: object[], weather?: { summary: string, guidance: string } }} input
 * @param {{ apiKey: string, model?: string }} config
 */
export async function recommendCourse(input, { apiKey, model = 'gpt-4o-mini' }) {
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY 가 설정되지 않았습니다.');
    error.status = 503;
    throw error;
  }
  if (!input?.region || !Array.isArray(input.candidates) || !input.candidates.length) {
    const error = new Error('region 과 candidates 가 필요합니다.');
    error.status = 400;
    throw error;
  }

  const candidates = input.candidates.slice(0, 60);
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '당신은 한국 국내 여행 코스를 짜 주는 여행 플래너입니다. 주어진 후보 장소 안에서만 고르고, 반드시 JSON 으로만 답합니다.',
        },
        { role: 'user', content: buildPrompt({ ...input, candidates }) },
      ],
    }),
  });

  if (!response.ok) {
    const error = new Error(`OpenAI 요청 실패 (${response.status})`);
    error.status = 502;
    throw error;
  }

  const data = await response.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  const validIds = new Set(candidates.map((c) => c.id));
  const stops = (Array.isArray(parsed.stops) ? parsed.stops : [])
    .filter((stop) => validIds.has(String(stop.id)))
    .slice(0, MAX_STOPS)
    .map((stop) => ({
      id: String(stop.id),
      stayMinutes: Math.min(240, Math.max(0, Number(stop.stayMinutes) || 0)),
      reason: String(stop.reason ?? '').slice(0, 120),
    }));

  return {
    title: String(parsed.title ?? '').slice(0, 60),
    summary: String(parsed.summary ?? '').slice(0, 200),
    stops,
  };
}
