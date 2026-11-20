// 표준견적서 견본 페이지(/standard-sample)의 예시. API · DB 없이 화면만 띄워 볼 때 쓴다.
// 값은 손으로 쓰지 않고 계산 엔진(POST /v2/quote-sheet와 같은 service.sheet)으로 만든 결과다 (2026-11-18 계산).
// 계산 엔진이 바뀌면 다시 만든다.
import type { components } from "@/lib/backend/schema";

export type SheetSample = { key: string; label: string; sheet: components["schemas"]["V2SheetOut"] };

export const SHEET_SAMPLES: SheetSample[] = [
 {
  "key": "p24-dobae",
  "label": "24평 · 도배만 · 빈 집",
  "sheet": {
   "trades": [
    {
     "trade": "dobae",
     "ko": "도배",
     "material": 736780,
     "labor": 1314297,
     "expense": 0,
     "total": 2051077,
     "share": 100.0,
     "bar": 100,
     "days": 2.0,
     "lines": [
      {
       "key": "wall",
       "name": "벽 도배 시공 (풀 포함)",
       "qty": 148.7,
       "unit": "㎡",
       "amount": 891159,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "ceiling",
       "name": "천장 도배 시공 (풀 포함)",
       "qty": 49.6,
       "unit": "㎡",
       "amount": 423138,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "paper",
       "name": "실크벽지 (LX 베스띠 or 개나리 로하스)",
       "qty": 72.0,
       "unit": "평",
       "amount": 684000,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "primer",
       "name": "초배지",
       "qty": 218.1,
       "unit": "㎡",
       "amount": 52780,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "removal",
       "name": "기존 벽지 철거",
       "qty": 198.3,
       "unit": "㎡",
       "amount": 342464,
       "state": "after_visit",
       "bucket": "labor",
       "counted": false
      },
      {
       "key": "waste",
       "name": "폐기물 처리",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "expense",
       "counted": false
      }
     ]
    }
   ],
   "material": 736780,
   "labor": 1314297,
   "expense": 0,
   "net": 2051077,
   "mix": {
    "material": 35.9,
    "labor": 64.1,
    "expense": 0.0
   },
   "overheads": [
    {
     "key": "profit",
     "name": "회사이윤",
     "rate": 0.05,
     "amount": 102554
    },
    {
     "key": "misc",
     "name": "공과잡비",
     "rate": 0.02,
     "amount": 41022
    },
    {
     "key": "injury",
     "name": "산재보험료",
     "rate": 0.011,
     "amount": 22562
    },
    {
     "key": "employ",
     "name": "고용보험료",
     "rate": 0.0042,
     "amount": 8615
    }
   ],
   "cut": -5830,
   "supply": 2220000,
   "vat": 222000,
   "total": 2442000,
   "per_pyeong": 101750,
   "pyeong": 24.0,
   "rates_version": "sheet-2026.11",
   "code": "MJ-2611-8991",
   "at": "2026-11-18",
   "missing": []
  }
 },
 {
  "key": "p32-both",
  "label": "32평 · 도배 + 목공 · 살면서",
  "sheet": {
   "trades": [
    {
     "trade": "mokgong",
     "ko": "목공",
     "material": 306900,
     "labor": 843705,
     "expense": 0,
     "total": 1150605,
     "share": 27.5,
     "bar": 38,
     "days": 3.5,
     "lines": [
      {
       "key": "molding",
       "name": "천장 몰딩 설치 · 계단몰딩",
       "qty": 76.8,
       "unit": "m",
       "amount": 627302,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "molding_mat",
       "name": "천장 몰딩 자재 · 영림 천장몰딩 1번 · 2번 · 3번 래핑몰딩",
       "qty": 36.0,
       "unit": "개",
       "amount": 194400,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "base",
       "name": "걸레받이 설치",
       "qty": 57.6,
       "unit": "m",
       "amount": 216403,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "base_mat",
       "name": "걸레받이 자재 · 영림 걸레받이몰딩 801(8전) 래핑몰딩",
       "qty": 25.0,
       "unit": "개",
       "amount": 112500,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "remove_trim",
       "name": "기존 몰딩 · 걸레받이 철거",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "labor",
       "counted": false
      },
      {
       "key": "waste",
       "name": "폐기물 처리",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "expense",
       "counted": false
      },
      {
       "key": "moving",
       "name": "짐 이동 · 보양",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "expense",
       "counted": false
      }
     ]
    },
    {
     "trade": "dobae",
     "ko": "도배",
     "material": 982422,
     "labor": 2049874,
     "expense": 0,
     "total": 3032296,
     "share": 72.5,
     "bar": 100,
     "days": 3.5,
     "lines": [
      {
       "key": "wall",
       "name": "벽 도배 시공 (풀 포함)",
       "qty": 198.4,
       "unit": "㎡",
       "amount": 1189011,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "ceiling",
       "name": "천장 도배 시공 (풀 포함)",
       "qty": 66.1,
       "unit": "㎡",
       "amount": 563899,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "paper",
       "name": "실크벽지 (LX 베스띠 or 개나리 로하스)",
       "qty": 96.0,
       "unit": "평",
       "amount": 912000,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "primer",
       "name": "초배지",
       "qty": 291.0,
       "unit": "㎡",
       "amount": 70422,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "occupied",
       "name": "짐 있는 집 작업 할증",
       "qty": null,
       "unit": "식",
       "amount": 296964,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "removal",
       "name": "기존 벽지 철거",
       "qty": 264.5,
       "unit": "㎡",
       "amount": 456792,
       "state": "after_visit",
       "bucket": "labor",
       "counted": false
      },
      {
       "key": "waste",
       "name": "폐기물 처리",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "expense",
       "counted": false
      },
      {
       "key": "moving",
       "name": "짐 이동 · 보양",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "expense",
       "counted": false
      }
     ]
    }
   ],
   "material": 1289322,
   "labor": 2893579,
   "expense": 0,
   "net": 4182901,
   "mix": {
    "material": 30.8,
    "labor": 69.2,
    "expense": 0.0
   },
   "overheads": [
    {
     "key": "profit",
     "name": "회사이윤",
     "rate": 0.05,
     "amount": 209145
    },
    {
     "key": "misc",
     "name": "공과잡비",
     "rate": 0.02,
     "amount": 83658
    },
    {
     "key": "injury",
     "name": "산재보험료",
     "rate": 0.011,
     "amount": 46012
    },
    {
     "key": "employ",
     "name": "고용보험료",
     "rate": 0.0042,
     "amount": 17568
    }
   ],
   "cut": -9284,
   "supply": 4530000,
   "vat": 453000,
   "total": 4983000,
   "per_pyeong": 155719,
   "pyeong": 32.0,
   "rates_version": "sheet-2026.11",
   "code": "MJ-2611-6540",
   "at": "2026-11-18",
   "missing": [
    "바닥재",
    "도장"
   ]
  }
 },
 {
  "key": "p34-both",
  "label": "34평 · 도배 + 목공 · 빈 집",
  "sheet": {
   "trades": [
    {
     "trade": "mokgong",
     "ko": "목공",
     "material": 326700,
     "labor": 896437,
     "expense": 0,
     "total": 1223137,
     "share": 29.6,
     "bar": 42,
     "days": 3.0,
     "lines": [
      {
       "key": "molding",
       "name": "천장 몰딩 설치 · 계단몰딩",
       "qty": 81.6,
       "unit": "m",
       "amount": 666509,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "molding_mat",
       "name": "천장 몰딩 자재 · 영림 천장몰딩 1번 · 2번 · 3번 래핑몰딩",
       "qty": 38.0,
       "unit": "개",
       "amount": 205200,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "base",
       "name": "걸레받이 설치",
       "qty": 61.2,
       "unit": "m",
       "amount": 229928,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "base_mat",
       "name": "걸레받이 자재 · 영림 걸레받이몰딩 801(8전) 래핑몰딩",
       "qty": 27.0,
       "unit": "개",
       "amount": 121500,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "remove_trim",
       "name": "기존 몰딩 · 걸레받이 철거",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "labor",
       "counted": false
      },
      {
       "key": "waste",
       "name": "폐기물 처리",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "expense",
       "counted": false
      }
     ]
    },
    {
     "trade": "dobae",
     "ko": "도배",
     "material": 1043802,
     "labor": 1862454,
     "expense": 0,
     "total": 2906256,
     "share": 70.4,
     "bar": 100,
     "days": 2.5,
     "lines": [
      {
       "key": "wall",
       "name": "벽 도배 시공 (풀 포함)",
       "qty": 210.7,
       "unit": "㎡",
       "amount": 1262725,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "ceiling",
       "name": "천장 도배 시공 (풀 포함)",
       "qty": 70.3,
       "unit": "㎡",
       "amount": 599729,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "paper",
       "name": "실크벽지 (LX 베스띠 or 개나리 로하스)",
       "qty": 102.0,
       "unit": "평",
       "amount": 969000,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "primer",
       "name": "초배지",
       "qty": 309.1,
       "unit": "㎡",
       "amount": 74802,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "removal",
       "name": "기존 벽지 철거",
       "qty": 281.0,
       "unit": "㎡",
       "amount": 485287,
       "state": "after_visit",
       "bucket": "labor",
       "counted": false
      },
      {
       "key": "waste",
       "name": "폐기물 처리",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "expense",
       "counted": false
      }
     ]
    }
   ],
   "material": 1370502,
   "labor": 2758891,
   "expense": 0,
   "net": 4129393,
   "mix": {
    "material": 33.2,
    "labor": 66.8,
    "expense": 0.0
   },
   "overheads": [
    {
     "key": "profit",
     "name": "회사이윤",
     "rate": 0.05,
     "amount": 206470
    },
    {
     "key": "misc",
     "name": "공과잡비",
     "rate": 0.02,
     "amount": 82588
    },
    {
     "key": "injury",
     "name": "산재보험료",
     "rate": 0.011,
     "amount": 45423
    },
    {
     "key": "employ",
     "name": "고용보험료",
     "rate": 0.0042,
     "amount": 17343
    }
   ],
   "cut": -1217,
   "supply": 4480000,
   "vat": 448000,
   "total": 4928000,
   "per_pyeong": 144941,
   "pyeong": 34.0,
   "rates_version": "sheet-2026.11",
   "code": "MJ-2611-4556",
   "at": "2026-11-18",
   "missing": []
  }
 },
 {
  "key": "p45-both",
  "label": "45평 · 도배 + 목공 · 빈 집",
  "sheet": {
   "trades": [
    {
     "trade": "mokgong",
     "ko": "목공",
     "material": 432000,
     "labor": 1186461,
     "expense": 0,
     "total": 1618461,
     "share": 29.6,
     "bar": 42,
     "days": 3.5,
     "lines": [
      {
       "key": "molding",
       "name": "천장 몰딩 설치 · 계단몰딩",
       "qty": 108.0,
       "unit": "m",
       "amount": 882144,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "molding_mat",
       "name": "천장 몰딩 자재 · 영림 천장몰딩 1번 · 2번 · 3번 래핑몰딩",
       "qty": 50.0,
       "unit": "개",
       "amount": 270000,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "base",
       "name": "걸레받이 설치",
       "qty": 81.0,
       "unit": "m",
       "amount": 304317,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "base_mat",
       "name": "걸레받이 자재 · 영림 걸레받이몰딩 801(8전) 래핑몰딩",
       "qty": 36.0,
       "unit": "개",
       "amount": 162000,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "remove_trim",
       "name": "기존 몰딩 · 걸레받이 철거",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "labor",
       "counted": false
      },
      {
       "key": "waste",
       "name": "폐기물 처리",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "expense",
       "counted": false
      }
     ]
    },
    {
     "trade": "dobae",
     "ko": "도배",
     "material": 1381526,
     "labor": 2465430,
     "expense": 0,
     "total": 3846956,
     "share": 70.4,
     "bar": 100,
     "days": 3.0,
     "lines": [
      {
       "key": "wall",
       "name": "벽 도배 시공 (풀 포함)",
       "qty": 279.0,
       "unit": "㎡",
       "amount": 1672047,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "ceiling",
       "name": "천장 도배 시공 (풀 포함)",
       "qty": 93.0,
       "unit": "㎡",
       "amount": 793383,
       "state": "included",
       "bucket": "labor",
       "counted": true
      },
      {
       "key": "paper",
       "name": "실크벽지 (LX 베스띠 or 개나리 로하스)",
       "qty": 135.0,
       "unit": "평",
       "amount": 1282500,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "primer",
       "name": "초배지",
       "qty": 409.2,
       "unit": "㎡",
       "amount": 99026,
       "state": "included",
       "bucket": "material",
       "counted": true
      },
      {
       "key": "removal",
       "name": "기존 벽지 철거",
       "qty": 372.0,
       "unit": "㎡",
       "amount": 642444,
       "state": "after_visit",
       "bucket": "labor",
       "counted": false
      },
      {
       "key": "waste",
       "name": "폐기물 처리",
       "qty": null,
       "unit": "식",
       "amount": null,
       "state": "after_visit",
       "bucket": "expense",
       "counted": false
      }
     ]
    }
   ],
   "material": 1813526,
   "labor": 3651891,
   "expense": 0,
   "net": 5465417,
   "mix": {
    "material": 33.2,
    "labor": 66.8,
    "expense": 0.0
   },
   "overheads": [
    {
     "key": "profit",
     "name": "회사이윤",
     "rate": 0.05,
     "amount": 273271
    },
    {
     "key": "misc",
     "name": "공과잡비",
     "rate": 0.02,
     "amount": 109308
    },
    {
     "key": "injury",
     "name": "산재보험료",
     "rate": 0.011,
     "amount": 60120
    },
    {
     "key": "employ",
     "name": "고용보험료",
     "rate": 0.0042,
     "amount": 22955
    }
   ],
   "cut": -1071,
   "supply": 5930000,
   "vat": 593000,
   "total": 6523000,
   "per_pyeong": 144956,
   "pyeong": 45.0,
   "rates_version": "sheet-2026.11",
   "code": "MJ-2611-9348",
   "at": "2026-11-18",
   "missing": []
  }
 }
];
