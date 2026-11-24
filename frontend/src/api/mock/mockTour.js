// 서비스키 없이 화면 작업을 하기 위한 TourAPI 목업.
// 실제 응답(raw) 필드명을 그대로 흉내 내서 tourApi.js의 매핑 로직을 같이 검증한다.
// 이름/주소/좌표 외의 값(운영시간, 소개 등)은 화면 확인용 임시 문구이며 실제 정보가 아니다.

function placeholderImage(label, hue) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='360' viewBox='0 0 480 360'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},65%,62%)'/><stop offset='1' stop-color='hsl(${hue + 35},70%,42%)'/></linearGradient></defs><rect width='480' height='360' fill='url(#g)'/><text x='50%' y='52%' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif' font-size='40' font-weight='700' fill='white'>${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PLACES = [
  {
    contentid: '900001',
    contenttypeid: '12',
    title: '경복궁',
    addr1: '서울특별시 종로구 사직로 161',
    mapy: '37.5796',
    mapx: '126.9770',
    hue: 18,
  },
  {
    contentid: '900002',
    contenttypeid: '12',
    title: 'N서울타워',
    addr1: '서울특별시 용산구 남산공원길 105',
    mapy: '37.5512',
    mapx: '126.9882',
    hue: 210,
  },
  {
    contentid: '900003',
    contenttypeid: '14',
    title: '국립중앙박물관',
    addr1: '서울특별시 용산구 서빙고로 137',
    mapy: '37.5239',
    mapx: '126.9803',
    hue: 265,
  },
  {
    contentid: '900004',
    contenttypeid: '12',
    title: '해운대해수욕장',
    addr1: '부산광역시 해운대구 우동',
    mapy: '35.1587',
    mapx: '129.1604',
    hue: 190,
  },
  {
    contentid: '900005',
    contenttypeid: '15',
    title: '광안리 바다 축제 (목업)',
    addr1: '부산광역시 수영구 광안해변로 219',
    mapy: '35.1532',
    mapx: '129.1186',
    hue: 330,
  },
  {
    contentid: '900006',
    contenttypeid: '12',
    title: '성산일출봉',
    addr1: '제주특별자치도 서귀포시 성산읍 일출로 284-12',
    mapy: '33.4581',
    mapx: '126.9425',
    hue: 135,
  },
  {
    contentid: '900007',
    contenttypeid: '32',
    title: '제주 바다뷰 스테이 (목업)',
    addr1: '제주특별자치도 제주시 애월읍',
    mapy: '33.4630',
    mapx: '126.3100',
    hue: 175,
  },
  {
    contentid: '900008',
    contenttypeid: '39',
    title: '전주 한옥마을 비빔밥집 (목업)',
    addr1: '전북특별자치도 전주시 완산구 기린대로',
    mapy: '35.8151',
    mapx: '127.1530',
    hue: 40,
    noImage: true,
  },
];

const INTROS = {
  12: {
    usetime: '09:00~18:00 (목업 데이터)',
    restdate: '매주 화요일 (목업 데이터)',
    parking: '가능',
    chkbabycarriage: '가능',
    chkpet: '불가',
    infocenter: '현장 안내소 문의 (목업 데이터)',
  },
  14: {
    usetimeculture: '10:00~18:00<br>※ 입장 마감 17:30 (목업 데이터)',
    restdateculture: '1월 1일, 설날·추석 당일 (목업 데이터)',
    usefee: '상설전시 무료 (목업 데이터)',
    spendtime: '약 2시간',
    parkingculture: '가능 (유료)',
  },
  15: {
    eventstartdate: '20261010',
    eventenddate: '20261012',
    eventplace: '해변 특설무대 (목업 데이터)',
    playtime: '18:00~22:00',
    usetimefestival: '무료',
    program: '개막 공연<br>야간 불꽃 쇼<br>버스킹 (목업 데이터)',
    sponsor1: '목업 축제 조직위원회',
  },
  32: {
    checkintime: '15:00',
    checkouttime: '11:00',
    roomcount: '12',
    subfacility: '바비큐장, 주차장 (목업 데이터)',
    chkcooking: '가능',
    parkinglodging: '가능',
  },
  39: {
    firstmenu: '비빔밥',
    treatmenu: '비빔밥, 콩나물국밥 (목업 데이터)',
    opentimefood: '10:00~21:00 (목업 데이터)',
    restdatefood: '연중무휴 (목업 데이터)',
    packing: '가능',
    parkingfood: '인근 공영주차장 이용',
  },
};

const INFOS = {
  12: [
    { infoname: '입장료', infotext: '성인 3,000원 / 어린이 무료 (목업 데이터)' },
    { infoname: '화장실', infotext: '있음' },
  ],
  32: [
    {
      roomtitle: '오션뷰 더블',
      roombasecount: '2',
      roommaxcount: '3',
      roomsize2: '26',
      roomoffseasonminfee1: '120000',
      roomintro: '바다가 보이는 객실 (목업 데이터)',
    },
  ],
};

const PET_INFOS = {
  900004: {
    acmpyTypeCd: '일부구역 동반가능',
    acmpyPsblCpam: '소형견 (목업 데이터)',
    acmpyNeedMtr: '목줄 착용, 배변봉투 지참',
  },
  900007: {
    acmpyTypeCd: '전구역 동반가능',
    acmpyPsblCpam: '중·소형견 (목업 데이터)',
    acmpyNeedMtr: '사전 예약 필수',
    relaPosesFclty: '반려견 놀이터',
  },
};

function toListItem(place) {
  const image = place.noImage
    ? ''
    : placeholderImage(place.title.replace(/ \(목업\)$/, ''), place.hue);
  return {
    contentid: place.contentid,
    contenttypeid: place.contenttypeid,
    title: place.title,
    addr1: place.addr1,
    addr2: '',
    mapx: place.mapx,
    mapy: place.mapy,
    firstimage: image,
    firstimage2: image,
    cpyrhtDivCd: 'Type1',
    tel: '',
  };
}

function findPlace(contentId) {
  return PLACES.find((place) => place.contentid === String(contentId));
}

export function searchKeyword(keyword) {
  const query = String(keyword ?? '').trim();
  return PLACES.filter(
    (place) => !query || place.title.includes(query) || place.addr1.includes(query),
  ).map(toListItem);
}

export function detailCommon(contentId) {
  const place = findPlace(contentId);
  if (!place) return [];
  return [
    {
      ...toListItem(place),
      overview: `${place.title}에 대한 소개 문구 자리입니다.<br>실제 서비스키를 연결하면 한국관광공사 TourAPI의 개요(overview)가 표시됩니다. (목업 데이터)`,
      homepage: '',
    },
  ];
}

export function detailIntro(contentId) {
  const place = findPlace(contentId);
  return place ? [INTROS[place.contenttypeid] ?? {}] : [];
}

export function detailInfo(contentId) {
  const place = findPlace(contentId);
  return place ? (INFOS[place.contenttypeid] ?? []) : [];
}

export function detailImage(contentId) {
  const place = findPlace(contentId);
  if (!place || place.noImage) return [];
  return [1, 2, 3].map((n) => {
    const url = placeholderImage(
      `${place.title.replace(/ \(목업\)$/, '')} ${n}`,
      place.hue + n * 25,
    );
    return {
      originimgurl: url,
      smallimageurl: url,
      imgname: `${place.title} ${n}`,
      cpyrhtDivCd: 'Type1',
    };
  });
}

export function detailPetTour(contentId) {
  const pet = PET_INFOS[contentId];
  return pet ? [pet] : [];
}
