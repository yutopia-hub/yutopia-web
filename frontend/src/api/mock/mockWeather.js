// 기상청 단기예보(getVilageFcst) 응답 item 형태를 흉내 낸 목업. 값은 화면 확인용 임시값.
export function mockForecastItems(date, hour) {
  const fcstTime = `${String(hour).padStart(2, '0')}00`;
  const slot = (category, fcstValue, time = fcstTime) => ({
    category,
    fcstDate: date,
    fcstTime: time,
    fcstValue,
  });

  return [
    slot('TMP', '19'),
    slot('SKY', '3'),
    slot('PTY', '0'),
    slot('POP', '20'),
    slot('REH', '55'),
    slot('WSD', '2.4'),
    slot('TMN', '12.0', '0600'),
    slot('TMX', '23.0', '1500'),
  ];
}
