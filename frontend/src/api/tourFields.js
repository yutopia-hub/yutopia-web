// TourAPI(KorService2) 원본 필드 -> 화면용 데이터 매핑.
// id/코드성 필드(contentid, areacode, cat1 등)는 여기서 걸러서 화면으로 넘기지 않는다.

export const CONTENT_TYPES = {
  12: '관광지',
  14: '문화시설',
  15: '축제·공연·행사',
  25: '여행코스',
  28: '레포츠',
  32: '숙박',
  38: '쇼핑',
  39: '음식점',
};

export function getContentTypeName(contentTypeId) {
  return CONTENT_TYPES[contentTypeId] ?? '여행지';
}

const INTRO_FIELDS = {
  12: [
    ['usetime', '이용시간'],
    ['restdate', '쉬는날'],
    ['useseason', '이용시기'],
    ['infocenter', '문의 및 안내'],
    ['parking', '주차'],
    ['chkbabycarriage', '유모차 대여'],
    ['chkpet', '반려동물 동반'],
    ['chkcreditcard', '신용카드'],
    ['expguide', '체험 안내'],
    ['expagerange', '체험 가능 연령'],
    ['accomcount', '수용 인원'],
    ['opendate', '개장일'],
  ],
  14: [
    ['usetimeculture', '이용시간'],
    ['restdateculture', '쉬는날'],
    ['usefee', '이용요금'],
    ['discountinfo', '할인 정보'],
    ['spendtime', '관람 소요시간'],
    ['infocenterculture', '문의 및 안내'],
    ['parkingculture', '주차'],
    ['parkingfee', '주차요금'],
    ['chkbabycarriageculture', '유모차 대여'],
    ['chkpetculture', '반려동물 동반'],
    ['chkcreditcardculture', '신용카드'],
    ['scale', '규모'],
    ['accomcountculture', '수용 인원'],
  ],
  15: [
    ['eventplace', '행사 장소'],
    ['playtime', '공연 시간'],
    ['usetimefestival', '이용요금'],
    ['program', '행사 프로그램'],
    ['subevent', '부대 행사'],
    ['agelimit', '관람 가능 연령'],
    ['spendtimefestival', '관람 소요시간'],
    ['bookingplace', '예매처'],
    ['discountinfofestival', '할인 정보'],
    ['sponsor1', '주최'],
    ['sponsor1tel', '주최 연락처'],
    ['sponsor2', '주관'],
    ['sponsor2tel', '주관 연락처'],
  ],
  25: [
    ['distance', '코스 총거리'],
    ['taketime', '소요시간'],
    ['schedule', '코스 일정'],
    ['theme', '코스 테마'],
    ['infocentertourcourse', '문의 및 안내'],
  ],
  28: [
    ['usetimeleports', '이용시간'],
    ['restdateleports', '쉬는날'],
    ['openperiod', '개장 기간'],
    ['usefeeleports', '이용요금'],
    ['reservation', '예약 안내'],
    ['expagerangeleports', '체험 가능 연령'],
    ['infocenterleports', '문의 및 안내'],
    ['parkingleports', '주차'],
    ['parkingfeeleports', '주차요금'],
    ['chkbabycarriageleports', '유모차 대여'],
    ['chkpetleports', '반려동물 동반'],
    ['chkcreditcardleports', '신용카드'],
    ['scaleleports', '규모'],
    ['accomcountleports', '수용 인원'],
  ],
  32: [
    ['checkintime', '체크인'],
    ['checkouttime', '체크아웃'],
    ['roomcount', '객실 수'],
    ['roomtype', '객실 유형'],
    ['subfacility', '부대시설'],
    ['chkcooking', '객실 내 취사'],
    ['foodplace', '식음료장'],
    ['pickup', '픽업 서비스'],
    ['parkinglodging', '주차'],
    ['reservationlodging', '예약 안내'],
    ['refundregulation', '환불 규정'],
    ['infocenterlodging', '문의 및 안내'],
    ['scalelodging', '규모'],
    ['accomcountlodging', '수용 인원'],
  ],
  38: [
    ['opentime', '영업시간'],
    ['restdateshopping', '쉬는날'],
    ['saleitem', '판매 품목'],
    ['fairday', '장 서는 날'],
    ['shopguide', '매장 안내'],
    ['infocentershopping', '문의 및 안내'],
    ['parkingshopping', '주차'],
    ['chkbabycarriageshopping', '유모차 대여'],
    ['chkpetshopping', '반려동물 동반'],
    ['chkcreditcardshopping', '신용카드'],
    ['restroom', '화장실'],
    ['scaleshopping', '규모'],
  ],
  39: [
    ['firstmenu', '대표 메뉴'],
    ['treatmenu', '취급 메뉴'],
    ['opentimefood', '영업시간'],
    ['restdatefood', '쉬는날'],
    ['packing', '포장'],
    ['reservationfood', '예약 안내'],
    ['seat', '좌석 수'],
    ['smoking', '금연/흡연'],
    ['infocenterfood', '문의 및 안내'],
    ['parkingfood', '주차'],
    ['chkcreditcardfood', '신용카드'],
    ['discountinfofood', '할인 정보'],
    ['scalefood', '규모'],
  ],
};

// 지도 요약 카드에 보여줄 "시간" / "쉬는날" 필드
const SUMMARY_FIELDS = {
  12: { time: ['usetime', '이용시간'], rest: 'restdate' },
  14: { time: ['usetimeculture', '이용시간'], rest: 'restdateculture' },
  25: { time: ['taketime', '소요시간'], rest: null },
  28: { time: ['usetimeleports', '이용시간'], rest: 'restdateleports' },
  38: { time: ['opentime', '영업시간'], rest: 'restdateshopping' },
  39: { time: ['opentimefood', '영업시간'], rest: 'restdatefood' },
};

const PET_FIELDS = [
  ['acmpyTypeCd', '동반 유형'],
  ['acmpyPsblCpam', '동반 가능 동물'],
  ['acmpyNeedMtr', '동반 시 필요사항'],
  ['relaPosesFclty', '관련 구비 시설'],
  ['relaFrnshPrdlst', '비치 품목'],
  ['relaRntlPrdlst', '대여 품목'],
  ['relaPurcPrdlst', '구매 가능 품목'],
  ['relaAcdntRiskMtr', '사고 대비 사항'],
  ['etcAcmpyInfo', '기타 동반 정보'],
];

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

// API 값에 섞여 오는 <br>, <a> 등 태그를 걷어내고 줄바꿈만 남긴 순수 텍스트로 만든다.
// 화면에서는 반드시 escapeHtml 후 출력한다.
export function toPlainText(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 이미지 저작권: 1유형(출처표시) / 3유형(출처표시+변경금지)만 사용 (REQUIREMENTS_RFP.md 3번).
const ALLOWED_LICENSES = ['Type1', 'Type3'];

export function licensedImage(url, licenseCode) {
  if (!url) return '';
  if (
    licenseCode !== undefined &&
    licenseCode !== null &&
    !ALLOWED_LICENSES.includes(licenseCode)
  ) {
    return '';
  }
  return String(url).replace(/^http:\/\//, 'https://');
}

export function extractHomepage(value) {
  if (!value) return '';
  const href = String(value).match(/href\s*=\s*["']?(https?:\/\/[^"'\s>]+)/i);
  if (href) return href[1];
  const text = toPlainText(value);
  if (/^https?:\/\/\S+$/.test(text)) return text;
  if (/^www\.\S+$/.test(text)) return `https://${text}`;
  return '';
}

function formatYmd(value) {
  const match = String(value ?? '').match(/^(\d{4})(\d{2})(\d{2})$/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : toPlainText(value);
}

function formatPeriod(start, end) {
  const from = formatYmd(start);
  const to = formatYmd(end);
  if (from && to) return from === to ? from : `${from} ~ ${to}`;
  return from || to;
}

export function buildIntro(contentTypeId, raw = {}) {
  const type = String(contentTypeId);
  const read = (key) => toPlainText(raw[key]);
  const fields = (INTRO_FIELDS[type] ?? [])
    .map(([key, label]) => ({ label, value: read(key) }))
    .filter((field) => field.value);

  if (type === '15') {
    const period = formatPeriod(raw.eventstartdate, raw.eventenddate);
    if (period) fields.unshift({ label: '행사 기간', value: period });
    return { summary: { timeLabel: '행사 기간', time: period, restDay: '' }, fields };
  }

  if (type === '32') {
    const time = [read('checkintime'), read('checkouttime')].filter(Boolean).join(' / ');
    return { summary: { timeLabel: '체크인 / 체크아웃', time, restDay: '' }, fields };
  }

  const config = SUMMARY_FIELDS[type];
  return {
    summary: {
      timeLabel: config?.time?.[1] ?? '이용시간',
      time: config?.time ? read(config.time[0]) : '',
      restDay: config?.rest ? read(config.rest) : '',
    },
    fields,
  };
}

function formatWon(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `${amount.toLocaleString('ko-KR')}원` : '';
}

export function buildInfo(contentTypeId, items = []) {
  if (String(contentTypeId) === '32') {
    return items
      .map((room) => {
        const lines = [
          room.roombasecount || room.roommaxcount
            ? `기준 ${room.roombasecount || '-'}명 / 최대 ${room.roommaxcount || '-'}명`
            : '',
          Number(room.roomsize2) > 0 ? `${room.roomsize2}㎡` : '',
          formatWon(room.roomoffseasonminfee1)
            ? `비수기 주중 ${formatWon(room.roomoffseasonminfee1)}~`
            : '',
          toPlainText(room.roomintro),
        ].filter(Boolean);
        return { title: toPlainText(room.roomtitle) || '객실', text: lines.join('\n') };
      })
      .filter((room) => room.text);
  }

  return items
    .map((item) => ({ title: toPlainText(item.infoname), text: toPlainText(item.infotext) }))
    .filter((item) => item.title && item.text);
}

export function buildPetInfo(raw = {}) {
  return PET_FIELDS.map(([key, label]) => ({ label, value: toPlainText(raw[key]) })).filter(
    (field) => field.value,
  );
}
