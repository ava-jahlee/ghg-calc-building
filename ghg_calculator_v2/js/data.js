/**
 * 온실가스 계산기 v2.6 - 데이터 모듈
 * 출처: 온실가스 배출권거래제 지침, IPCC 2006 GL
 * 엑셀 원본에서 정확하게 추출한 값
 */

// ===== 녹색건축인증 G-SEED 기준 =====
// 출처: 녹색건축인증기준 (국토교통부고시 제2023-500호)
const GSEED_CRITERIA = {
    // 에너지 성능 점수 (최대 12점)
    energyScore: {
        maxPoints: 12,
        levels: [
            { threshold: 60, points: 12, label: "1+++" },   // 60 kWh/m²·년 미만
            { threshold: 90, points: 10, label: "1++" },    // 90 미만
            { threshold: 120, points: 8, label: "1+" },     // 120 미만
            { threshold: 150, points: 6, label: "1" },      // 150 미만
            { threshold: 190, points: 4, label: "2" },      // 190 미만
            { threshold: 230, points: 2, label: "3" },      // 230 미만
            { threshold: Infinity, points: 0, label: "4+" } // 230 이상
        ]
    },
    // 온실가스 배출량 점수 (최대 6점)
    ghgScore: {
        maxPoints: 6,
        levels: [
            { threshold: 20, points: 6 },   // 20 kgCO2/m² 미만
            { threshold: 35, points: 5 },
            { threshold: 50, points: 4 },
            { threshold: 70, points: 3 },
            { threshold: 90, points: 2 },
            { threshold: 120, points: 1 },
            { threshold: Infinity, points: 0 }
        ]
    },
    // 용수 절감 점수 (최대 4점)
    waterScore: {
        maxPoints: 4,
        levels: [
            { reduction: 40, points: 4 },  // 40% 이상 절감
            { reduction: 30, points: 3 },
            { reduction: 20, points: 2 },
            { reduction: 10, points: 1 },
            { reduction: 0, points: 0 }
        ]
    },
    // 총점 기준 등급
    grades: {
        "최우수": { minScore: 74, color: "#2ecc71" },     // 그린1등급
        "우수": { minScore: 66, color: "#27ae60" },       // 그린2등급
        "우량": { minScore: 58, color: "#f39c12" },       // 그린3등급
        "일반": { minScore: 50, color: "#e67e22" }        // 그린4등급
    },
    // 건물 유형별 기준 1차에너지소요량 (kWh/m²·년)
    baselineEnergy: {
        "office": 200,
        "school": 150,
        "hospital": 350,
        "hotel": 250,
        "mall": 220,
        "apartment": 120,
        "house": 150,
        "factory": 300,
        "other": 200
    }
};

// ===== 제로에너지빌딩 ZEB 기준 =====
// 출처: 제로에너지건축물 인증기준 (국토교통부고시)
const ZEB_CRITERIA = {
    grades: [
        { grade: 1, minRate: 100, label: "ZEB 1등급", desc: "에너지자립률 100% 이상" },
        { grade: 2, minRate: 80, label: "ZEB 2등급", desc: "에너지자립률 80~100%" },
        { grade: 3, minRate: 60, label: "ZEB 3등급", desc: "에너지자립률 60~80%" },
        { grade: 4, minRate: 40, label: "ZEB 4등급", desc: "에너지자립률 40~60%" },
        { grade: 5, minRate: 20, label: "ZEB 5등급", desc: "에너지자립률 20~40%" }
    ],
    // 신재생에너지원별 발전량 (kWh/kW·년)
    renewableYield: {
        "solar_pv": { name: "태양광", yield: 1100, unit: "kW" },           // 연간 발전량
        "solar_thermal": { name: "태양열", yield: 500, unit: "m²" },       // 집열면적당
        "geothermal": { name: "지열", yield: 3000, unit: "kW" },           // 히트펌프 용량당
        "fuel_cell": { name: "연료전지", yield: 7000, unit: "kW" },        // 발전용량당
        "wind": { name: "풍력", yield: 2000, unit: "kW" }                  // 발전용량당
    },
    // 1차에너지 환산계수
    primaryEnergyFactor: {
        electricity: 2.75,  // 전기
        gas: 1.1,           // 가스
        district_heat: 0.728 // 지역난방
    }
};

// 건물 유형별 벤치마크 데이터 (kgCO2eq/m²·년)
// 출처: 환경부 건물부문 온실가스 배출량 현황, 에너지관리공단
const BUILDING_BENCHMARKS = {
    "office": {
        name: "사무실",
        excellent: 40,   // 상위 10%
        good: 55,        // 상위 30%
        average: 70,     // 평균
        poor: 90,        // 하위 30%
        unit: "kgCO2eq/m²"
    },
    "school": {
        name: "학교",
        excellent: 25,
        good: 35,
        average: 45,
        poor: 60,
        unit: "kgCO2eq/m²"
    },
    "hospital": {
        name: "병원",
        excellent: 80,
        good: 110,
        average: 140,
        poor: 180,
        unit: "kgCO2eq/m²"
    },
    "hotel": {
        name: "호텔",
        excellent: 60,
        good: 85,
        average: 110,
        poor: 140,
        unit: "kgCO2eq/m²"
    },
    "mall": {
        name: "쇼핑몰",
        excellent: 50,
        good: 70,
        average: 90,
        poor: 120,
        unit: "kgCO2eq/m²"
    },
    "apartment": {
        name: "아파트",
        excellent: 15,
        good: 25,
        average: 35,
        poor: 50,
        unit: "kgCO2eq/m²"
    },
    "house": {
        name: "단독주택",
        excellent: 20,
        good: 30,
        average: 45,
        poor: 65,
        unit: "kgCO2eq/m²"
    },
    "factory": {
        name: "공장",
        excellent: 100,
        good: 150,
        average: 200,
        poor: 300,
        unit: "kgCO2eq/m²"
    },
    "other": {
        name: "기타",
        excellent: 40,
        good: 60,
        average: 80,
        poor: 110,
        unit: "kgCO2eq/m²"
    }
};

// ===== 건물 유형별 에너지 소비 참고값 =====
// 출처: 한국에너지공단 건물에너지 소비현황, 에너지경제연구원
const ENERGY_REFERENCE = {
    "office": {
        name: "사무실",
        electricity: { min: 120, typical: 180, max: 280, unit: "kWh/m²·년" },
        gas: { min: 15, typical: 35, max: 60, unit: "m³/m²·년" },
        description: "냉난방, 조명, OA기기 등 포함"
    },
    "school": {
        name: "학교",
        electricity: { min: 60, typical: 100, max: 160, unit: "kWh/m²·년" },
        gas: { min: 10, typical: 25, max: 45, unit: "m³/m²·년" },
        description: "방학 기간 미사용 고려"
    },
    "hospital": {
        name: "병원",
        electricity: { min: 180, typical: 280, max: 400, unit: "kWh/m²·년" },
        gas: { min: 30, typical: 55, max: 90, unit: "m³/m²·년" },
        description: "24시간 운영, 의료장비 포함"
    },
    "hotel": {
        name: "호텔",
        electricity: { min: 150, typical: 220, max: 320, unit: "kWh/m²·년" },
        gas: { min: 25, typical: 45, max: 70, unit: "m³/m²·년" },
        description: "객실, 로비, 식당, 수영장 등"
    },
    "mall": {
        name: "쇼핑몰",
        electricity: { min: 180, typical: 250, max: 350, unit: "kWh/m²·년" },
        gas: { min: 15, typical: 30, max: 50, unit: "m³/m²·년" },
        description: "조명, 냉방 부하 높음"
    },
    "apartment": {
        name: "아파트",
        electricity: { min: 30, typical: 55, max: 90, unit: "kWh/m²·년" },
        gas: { min: 8, typical: 18, max: 35, unit: "m³/m²·년" },
        description: "공용부 제외, 세대 전용"
    },
    "house": {
        name: "단독주택",
        electricity: { min: 40, typical: 70, max: 120, unit: "kWh/m²·년" },
        gas: { min: 12, typical: 25, max: 50, unit: "m³/m²·년" },
        description: "난방 방식에 따라 차이"
    },
    "factory": {
        name: "공장",
        electricity: { min: 100, typical: 300, max: 800, unit: "kWh/m²·년" },
        gas: { min: 20, typical: 80, max: 200, unit: "m³/m²·년" },
        description: "업종별 편차 매우 큼"
    },
    "other": {
        name: "기타",
        electricity: { min: 80, typical: 150, max: 250, unit: "kWh/m²·년" },
        gas: { min: 15, typical: 35, max: 60, unit: "m³/m²·년" },
        description: "건물 용도에 따라 다름"
    }
};

// ===== 입력 도움말 가이드 =====
const INPUT_GUIDE = {
    scope1: {
        title: "Scope 1: 직접 배출",
        description: "건물에서 직접 연료를 연소하여 발생하는 배출량",
        tips: [
            "도시가스 고지서에서 사용량(m³) 확인",
            "보일러 연료 사용량 확인",
            "비상발전기 연료 사용량 포함"
        ],
        warningThresholds: {
            "도시가스(LNG)": { min: 0.1, max: 500, unit: "천m3", message: "일반 건물 기준 0.1~500 천m³/년" },
            "경유": { min: 0.1, max: 100, unit: "kL", message: "비상발전기 포함 0.1~100 kL/년" },
            "등유": { min: 0.1, max: 50, unit: "kL", message: "난방용 기준 0.1~50 kL/년" },
            "휘발유": { min: 0.1, max: 20, unit: "kL", message: "차량 등 0.1~20 kL/년" },
            "LPG(프로판)": { min: 0.1, max: 30, unit: "ton", message: "0.1~30 ton/년" },
            "default": { min: 0.01, max: 1000, message: "입력값을 확인해주세요" }
        }
    },
    scope2: {
        title: "Scope 2: 간접 배출",
        description: "구매한 전기, 열 사용으로 인한 간접 배출량",
        tips: [
            "한전 전기요금 고지서에서 사용량(kWh) 확인",
            "지역난방 고지서에서 사용량(Gcal 또는 MJ) 확인",
            "연간 총 사용량으로 입력"
        ],
        warningThresholds: {
            "electricity": { 
                minPerArea: 30, maxPerArea: 500, 
                unit: "MWh", 
                message: "면적 대비 사용량이 비정상적입니다" 
            },
            "heat": { 
                minPerArea: 0.01, maxPerArea: 0.5, 
                unit: "TJ", 
                message: "면적 대비 사용량이 비정상적입니다" 
            }
        }
    },
    scope3: {
        title: "Scope 3: 기타 간접 배출",
        description: "출장, 통근, 폐기물 등 기타 활동으로 인한 배출량",
        travel: {
            tips: [
                "출장 거리: 왕복 기준으로 입력",
                "항공: 실제 비행거리 입력 (서울-제주 약 450km)",
                "KTX: 역간 거리 입력 (서울-부산 약 420km)"
            ],
            examples: {
                "국내선 항공": "서울-제주 왕복 약 900km",
                "KTX": "서울-부산 왕복 약 840km",
                "승용차": "주간 업무용 주행거리"
            }
        },
        commute: {
            tips: [
                "편도 거리 입력 (왕복 자동 계산)",
                "연간 출근일수: 보통 250일 내외",
                "대중교통 환승 시 주 이용수단으로 입력"
            ]
        },
        waste: {
            tips: [
                "폐기물 처리 업체 실적 또는 계량 데이터 확인",
                "일반폐기물: 생활쓰레기, 사무실 폐기물",
                "음식물: 음식물 쓰레기 배출량"
            ],
            examples: {
                "사무실": "인당 약 0.5~1 kg/일",
                "식당": "인당 약 0.3~0.5 kg/일 (음식물)"
            }
        }
    },
    building: {
        title: "건물 정보",
        description: "원단위 계산 및 벤치마크 비교를 위한 정보",
        tips: [
            "연면적: 건축물대장에서 확인 (지상+지하 전체)",
            "상시 인원: 평균 재실 인원수",
            "신재생 발전량: 태양광 등 자가발전량"
        ]
    }
};

// ===== 입력값 검증 규칙 =====
const INPUT_VALIDATION = {
    // 면적당 전기 사용량 범위 (kWh/m²·년)
    electricityPerArea: {
        warning: { min: 20, max: 600 },
        error: { min: 5, max: 1500 }
    },
    // 면적당 가스 사용량 범위 (m³/m²·년)  
    gasPerArea: {
        warning: { min: 5, max: 100 },
        error: { min: 1, max: 300 }
    },
    // 인당 배출량 범위 (tCO2eq/인·년)
    emissionPerPerson: {
        warning: { min: 0.5, max: 20 },
        error: { min: 0.1, max: 50 }
    },
    // 통근 거리 (km, 편도)
    commuteDistance: {
        warning: { min: 1, max: 100 },
        error: { min: 0.1, max: 300 }
    },
    // 출장 거리 (km)
    travelDistance: {
        warning: { min: 10, max: 20000 },
        error: { min: 1, max: 50000 }
    }
};

// GWP (지구온난화지수) 옵션
const GWP_OPTIONS = {
    "SAR": {
        name: "국가 인벤토리 (SAR, 1995)",
        shortName: "SAR",
        CO2: 1,
        CH4: 21,
        N2O: 310
    },
    "AR4": {
        name: "IPCC AR4 (2007)",
        shortName: "AR4",
        CO2: 1,
        CH4: 25,
        N2O: 298
    },
    "AR5": {
        name: "IPCC AR5 (2014)",
        shortName: "AR5",
        CO2: 1,
        CH4: 28,
        N2O: 265
    },
    "AR6": {
        name: "IPCC AR6 (2021)",
        shortName: "AR6",
        CO2: 1,
        CH4: 29.8,
        N2O: 273
    }
};

// 현재 선택된 GWP (기본값: SAR)
let currentGWP = GWP_OPTIONS["SAR"];

// GWP 호환용 (기존 코드 호환)
const GWP = {
    get CO2() { return currentGWP.CO2; },
    get CH4() { return currentGWP.CH4; },
    get N2O() { return currentGWP.N2O; }
};

// 산화계수 (Tier별, 연료상태별)
// T1: 1, T2: 연료상태별, T3: 직접입력
const OXIDATION_FACTORS = {
    "고체": 0.98,
    "액체": 0.99,
    "기체": 0.995
};

// 연료 데이터 (엑셀에서 추출)
// ch4_ipcc, n2o_ipcc: IPCC 값 (주거/상업 구분 없음)
// ch4_17_res, ch4_17_com: 국가 값 (주거/상업 구분)
const FUEL_DATA = {
    // ===== 가스류 =====
    "천연가스(LNG)": {
        state: "기체",
        units: ["ton"],  // 부피 단위는 도시가스(LNG) 사용
        category: "가스류",
        // 열량계수 (MJ/kg 또는 MJ/L)
        heat_ipcc: 48.0,
        heat_17: 49.4,
        heat_22: 49.4,
        // CO2 배출계수 (kg/TJ)
        co2_ipcc: 56100,
        co2_17: 56144,
        co2_22: 56030,  // 15.281 * 44 * 1000 / 12
        // CH4 배출계수 (kg/TJ) - IPCC는 구분없음, 국가만 구분
        ch4_ipcc: 1,
        ch4_17_res: 5, ch4_17_com: 5,
        ch4_22_res: 5, ch4_22_com: 5,
        // N2O 배출계수 (kg/TJ)
        n2o_ipcc: 0.1,
        n2o_17_res: 0.1, n2o_17_com: 0.1,
        n2o_22_res: 0.1, n2o_22_com: 0.1
    },
    "도시가스(LNG)": {
        state: "기체",
        units: ["천m3"],
        category: "가스류",
        heat_ipcc: 48.0,
        heat_17: 38.9,  // MJ/Nm3
        heat_22: 38.9,
        co2_ipcc: 56100,
        co2_17: 55997,
        co2_22: 55997,
        ch4_ipcc: 1,
        ch4_17_res: 5, ch4_17_com: 5,
        ch4_22_res: 5, ch4_22_com: 5,
        n2o_ipcc: 0.1,
        n2o_17_res: 0.1, n2o_17_com: 0.1,
        n2o_22_res: 0.1, n2o_22_com: 0.1
    },
    "도시가스(LPG)": {
        state: "기체",
        units: ["천m3"],
        category: "가스류",
        heat_ipcc: 47.3,
        heat_17: 58.4,  // MJ/Nm3
        heat_22: 58.4,
        co2_ipcc: 63067,
        co2_17: 63998,
        co2_22: 63998,
        ch4_ipcc: 1,
        ch4_17_res: 5, ch4_17_com: 5,
        ch4_22_res: 5, ch4_22_com: 5,
        n2o_ipcc: 0.1,
        n2o_17_res: 0.1, n2o_17_com: 0.1,
        n2o_22_res: 0.1, n2o_22_com: 0.1
    },

    // ===== 석유류 - LPG =====
    "LPG (액화석유가스)": {
        state: "기체",
        units: ["ton"],  // 질량 단위만 지원 (열량계수 MJ/kg 기준)
        category: "석유류",
        heat_ipcc: 47.3,
        heat_17: 47.3,  // IPCC만 있음
        heat_22: 47.3,
        co2_ipcc: 63067,
        co2_17: 63067,
        co2_22: 63067,
        ch4_ipcc: 1,
        ch4_17_res: 5, ch4_17_com: 5,
        ch4_22_res: 5, ch4_22_com: 5,
        n2o_ipcc: 0.1,
        n2o_17_res: 0.1, n2o_17_com: 0.1,
        n2o_22_res: 0.1, n2o_22_com: 0.1
    },
    "프로판(LPG1호)": {
        state: "기체",
        units: ["ton"],  // 질량 단위만 지원 (열량계수 MJ/kg 기준)
        category: "석유류",
        heat_ipcc: 47.3,
        heat_17: 46.3,  // MJ/kg
        heat_22: 46.3,
        co2_ipcc: 63067,
        co2_17: 64684,
        co2_22: 64684,
        ch4_ipcc: 1,
        ch4_17_res: 5, ch4_17_com: 5,
        ch4_22_res: 5, ch4_22_com: 5,
        n2o_ipcc: 0.1,
        n2o_17_res: 0.1, n2o_17_com: 0.1,
        n2o_22_res: 0.1, n2o_22_com: 0.1
    },
    "부탄(LPG3호)": {
        state: "기체",
        units: ["ton"],  // 질량 단위만 지원 (열량계수 MJ/kg 기준)
        category: "석유류",
        heat_ipcc: 47.3,
        heat_17: 45.7,  // MJ/kg
        heat_22: 45.7,
        co2_ipcc: 63067,
        co2_17: 66392,
        co2_22: 66392,
        ch4_ipcc: 1,
        ch4_17_res: 5, ch4_17_com: 5,
        ch4_22_res: 5, ch4_22_com: 5,
        n2o_ipcc: 0.1,
        n2o_17_res: 0.1, n2o_17_com: 0.1,
        n2o_22_res: 0.1, n2o_22_com: 0.1
    },

    // ===== 석유류 =====
    "휘발유 (자동차용 가솔린)": {
        state: "액체",
        units: ["kL"],
        category: "석유류",
        heat_ipcc: 44.3,
        heat_17: 30.4,  // MJ/L
        heat_22: 30.4,
        co2_ipcc: 69300,
        co2_17: 71676,
        co2_22: 71676,
        ch4_ipcc: 3,
        ch4_17_res: 10, ch4_17_com: 10,
        ch4_22_res: 10, ch4_22_com: 10,
        n2o_ipcc: 0.6,
        n2o_17_res: 0.6, n2o_17_com: 0.6,
        n2o_22_res: 0.6, n2o_22_com: 0.6
    },
    "등유 (기타 등유)": {
        state: "액체",
        units: ["kL"],
        category: "석유류",
        heat_ipcc: 43.8,
        heat_17: 34.2,  // MJ/L
        heat_22: 34.2,
        co2_ipcc: 71867,
        co2_17: 73080,
        co2_22: 73080,
        ch4_ipcc: 3,
        ch4_17_res: 10, ch4_17_com: 10,
        ch4_22_res: 10, ch4_22_com: 10,
        n2o_ipcc: 0.6,
        n2o_17_res: 0.6, n2o_17_com: 0.6,
        n2o_22_res: 0.6, n2o_22_com: 0.6
    },
    "경유 (가스/디젤 오일)": {
        state: "액체",
        units: ["kL"],
        category: "석유류",
        heat_ipcc: 43.0,
        heat_17: 35.2,  // MJ/L
        heat_22: 35.2,
        co2_ipcc: 74067,
        co2_17: 73740,
        co2_22: 73740,
        ch4_ipcc: 3,
        ch4_17_res: 10, ch4_17_com: 10,
        ch4_22_res: 10, ch4_22_com: 10,
        n2o_ipcc: 0.6,
        n2o_17_res: 0.6, n2o_17_com: 0.6,
        n2o_22_res: 0.6, n2o_22_com: 0.6
    },
    "B-A유": {
        state: "액체",
        units: ["kL"],
        category: "석유류",
        heat_ipcc: 40.4,  // B-C유 IPCC 사용
        heat_17: 36.4,   // MJ/L
        heat_22: 36.4,
        co2_ipcc: 77367,  // B-C유 IPCC 사용
        co2_17: 75742,
        co2_22: 75742,
        ch4_ipcc: 10,
        ch4_17_res: 10, ch4_17_com: 10,
        ch4_22_res: 10, ch4_22_com: 10,
        n2o_ipcc: 0.6,
        n2o_17_res: 0.6, n2o_17_com: 0.6,
        n2o_22_res: 0.6, n2o_22_com: 0.6
    },
    "B-B유": {
        state: "액체",
        units: ["kL"],
        category: "석유류",
        heat_ipcc: 40.4,
        heat_17: 38.0,   // MJ/L
        heat_22: 38.0,
        co2_ipcc: 77367,
        co2_17: 78408,
        co2_22: 78408,
        ch4_ipcc: 10,
        ch4_17_res: 10, ch4_17_com: 10,
        ch4_22_res: 10, ch4_22_com: 10,
        n2o_ipcc: 0.6,
        n2o_17_res: 0.6, n2o_17_com: 0.6,
        n2o_22_res: 0.6, n2o_22_com: 0.6
    },
    "B-C유 (잔여 석유연료)": {
        state: "액체",
        units: ["kL"],
        category: "석유류",
        heat_ipcc: 40.4,
        heat_17: 39.2,   // MJ/L
        heat_22: 39.2,
        co2_ipcc: 77367,
        co2_17: 80406,
        co2_22: 80406,
        ch4_ipcc: 3,
        ch4_17_res: 10, ch4_17_com: 10,
        ch4_22_res: 10, ch4_22_com: 10,
        n2o_ipcc: 0.6,
        n2o_17_res: 0.6, n2o_17_com: 0.6,
        n2o_22_res: 0.6, n2o_22_com: 0.6
    },

    // ===== 석탄류 =====
    "국내 무연탄": {
        state: "고체",
        units: ["ton"],
        category: "석탄류",
        heat_ipcc: 26.7,
        heat_17: 19.4,   // MJ/kg
        heat_22: 19.4,
        co2_ipcc: 98267,
        co2_17: 110678,
        co2_22: 110678,
        ch4_ipcc: 1,  // IPCC는 구분 없음!
        ch4_17_res: 300, ch4_17_com: 10,  // 주거용 300, 상업용 10
        ch4_22_res: 300, ch4_22_com: 10,
        n2o_ipcc: 1.5,
        n2o_17_res: 1.4, n2o_17_com: 1.4,
        n2o_22_res: 1.4, n2o_22_com: 1.4
    },
    "연료용 수입 무연탄": {
        state: "고체",
        units: ["ton"],
        category: "석탄류",
        heat_ipcc: 26.7,
        heat_17: 20.5,   // MJ/kg
        heat_22: 20.5,
        co2_ipcc: 98267,
        co2_17: 100481,
        co2_22: 100481,
        ch4_ipcc: 1,
        ch4_17_res: 300, ch4_17_com: 10,
        ch4_22_res: 300, ch4_22_com: 10,
        n2o_ipcc: 1.5,
        n2o_17_res: 1.4, n2o_17_com: 1.4,
        n2o_22_res: 1.4, n2o_22_com: 1.4
    },
    "연료용 유연탄 (기타 유연탄)": {
        state: "고체",
        units: ["ton"],
        category: "석탄류",
        heat_ipcc: 25.8,
        heat_17: 23.7,   // MJ/kg
        heat_22: 23.7,
        co2_ipcc: 94600,
        co2_17: 95154,
        co2_22: 95154,
        ch4_ipcc: 1,
        ch4_17_res: 300, ch4_17_com: 10,
        ch4_22_res: 300, ch4_22_com: 10,
        n2o_ipcc: 1.5,
        n2o_17_res: 1.4, n2o_17_com: 1.4,
        n2o_22_res: 1.4, n2o_22_com: 1.4
    },
    
    // ===== 바이오연료 =====
    // 참고: IPCC 2006 GL에 따르면 바이오매스 CO2는 순환탄소로 간주하여 
    //       에너지 부문에서 0으로 계산 (LULUCF 부문에서 계산)
    //       그러나 CH4, N2O는 연소 시 발생하므로 포함
    //       CO2는 정보제공 목적으로 표시 (bio_co2 필드)
    "목재펠릿": {
        state: "고체",
        units: ["ton"],
        category: "바이오연료",
        isBiofuel: true,
        heat_ipcc: 16.8,  // MJ/kg (IPCC: Wood/wood waste)
        heat_17: 17.0,
        heat_22: 17.0,
        // CO2는 탄소중립이므로 0, 하지만 정보제공용 bio_co2 포함
        co2_ipcc: 0,  // 탄소중립
        co2_17: 0,
        co2_22: 0,
        bio_co2: 112000,  // 정보제공용: 실제 연소 CO2 (kg/TJ)
        ch4_ipcc: 30,     // IPCC 고정 연소 (목재)
        ch4_17_res: 300, ch4_17_com: 30,
        ch4_22_res: 300, ch4_22_com: 30,
        n2o_ipcc: 4,
        n2o_17_res: 4, n2o_17_com: 4,
        n2o_22_res: 4, n2o_22_com: 4
    },
    "우드칩": {
        state: "고체",
        units: ["ton"],
        category: "바이오연료",
        isBiofuel: true,
        heat_ipcc: 15.6,  // MJ/kg
        heat_17: 15.6,
        heat_22: 15.6,
        co2_ipcc: 0,
        co2_17: 0,
        co2_22: 0,
        bio_co2: 112000,
        ch4_ipcc: 30,
        ch4_17_res: 300, ch4_17_com: 30,
        ch4_22_res: 300, ch4_22_com: 30,
        n2o_ipcc: 4,
        n2o_17_res: 4, n2o_17_com: 4,
        n2o_22_res: 4, n2o_22_com: 4
    },
    "폐목재": {
        state: "고체",
        units: ["ton"],
        category: "바이오연료",
        isBiofuel: true,
        heat_ipcc: 15.6,
        heat_17: 15.6,
        heat_22: 15.6,
        co2_ipcc: 0,
        co2_17: 0,
        co2_22: 0,
        bio_co2: 112000,
        ch4_ipcc: 30,
        ch4_17_res: 300, ch4_17_com: 30,
        ch4_22_res: 300, ch4_22_com: 30,
        n2o_ipcc: 4,
        n2o_17_res: 4, n2o_17_com: 4,
        n2o_22_res: 4, n2o_22_com: 4
    },
    "바이오가스": {
        state: "기체",
        units: ["천m3"],  // 기체는 부피 단위 사용
        category: "바이오연료",
        isBiofuel: true,
        heat_ipcc: 50.4,  // MJ/Nm³
        heat_17: 39.8,    // MJ/Nm³ (메탄 함량 고려)
        heat_22: 39.8,
        co2_ipcc: 0,
        co2_17: 0,
        co2_22: 0,
        bio_co2: 54600,
        ch4_ipcc: 1,
        ch4_17_res: 5, ch4_17_com: 5,
        ch4_22_res: 5, ch4_22_com: 5,
        n2o_ipcc: 0.1,
        n2o_17_res: 0.1, n2o_17_com: 0.1,
        n2o_22_res: 0.1, n2o_22_com: 0.1
    },
    "바이오디젤": {
        state: "액체",
        units: ["kL"],  // 부피 단위만 지원 (열량계수 MJ/L 기준)
        category: "바이오연료",
        isBiofuel: true,
        heat_ipcc: 27.0,  // MJ/L
        heat_17: 32.7,    // MJ/L
        heat_22: 35.0,
        co2_ipcc: 0,
        co2_17: 0,
        co2_22: 0,
        bio_co2: 70800,
        ch4_ipcc: 3,
        ch4_17_res: 3, ch4_17_com: 3,
        ch4_22_res: 3, ch4_22_com: 3,
        n2o_ipcc: 0.6,
        n2o_17_res: 0.6, n2o_17_com: 0.6,
        n2o_22_res: 0.6, n2o_22_com: 0.6
    },
    "바이오에탄올": {
        state: "액체",
        units: ["kL"],  // 부피 단위만 지원 (열량계수 MJ/L 기준)
        category: "바이오연료",
        isBiofuel: true,
        heat_ipcc: 21.3,  // MJ/L
        heat_17: 21.3,    // MJ/L
        heat_22: 26.8,
        co2_ipcc: 0,
        co2_17: 0,
        co2_22: 0,
        bio_co2: 71500,
        ch4_ipcc: 3,
        ch4_17_res: 3, ch4_17_com: 3,
        ch4_22_res: 3, ch4_22_com: 3,
        n2o_ipcc: 0.6,
        n2o_17_res: 0.6, n2o_17_com: 0.6,
        n2o_22_res: 0.6, n2o_22_com: 0.6
    }
};

// ===== 전력 배출계수 =====
// 두 가지 체계가 있음:
// 1) 배출권거래제 기준 (계획기간별 고정값) - 엑셀 원본
// 2) 연도별 실측값 (GIR 연간 발표) - 실제 발전 실적 기반

// ===== 1) 배출권거래제 기준 전력 배출계수 (kgCO2/MWh) =====
// 출처: 온실가스 배출권거래제 지침 (환경부 고시)
// 배출권거래제 계획기간 동안 고정 적용
const ELECTRICITY_ETS_DATA = {
    "전기(소비단)": {
        "3기": { co2: 456.7, ch4: 0.0036, n2o: 0.0085, period: "2019-2023", source: "배출권거래제 3기 지침" },
        "4기": { co2: 474.7, ch4: 0.0125, n2o: 0.01, period: "2024-2028", source: "배출권거래제 4기 지침" }
    },
    "전기(발전단)": {
        "3기": { co2: 440.1, ch4: 0.0034, n2o: 0.0082, period: "2019-2023", source: "배출권거래제 3기 지침" },
        "4기": { co2: 442.0, ch4: 0.0034, n2o: 0.0082, period: "2024-2028", source: "배출권거래제 4기 지침" }
    }
};

// ===== 2) 연도별 실측 전력 배출계수 (kgCO2/MWh) =====
// 출처: 온실가스종합정보센터 (GIR) - 국가 온실가스 인벤토리
// 매년 발전 실적 기반으로 산정된 값 (2년 지연 발표)
const ELECTRICITY_YEARLY_DATA = {
    "소비단": {
        "2017": { co2: 458.5, ch4: 0.0036, n2o: 0.0085 },
        "2018": { co2: 459.4, ch4: 0.0036, n2o: 0.0085 },
        "2019": { co2: 459.8, ch4: 0.0036, n2o: 0.0085 },
        "2020": { co2: 459.4, ch4: 0.0036, n2o: 0.0085 },
        "2021": { co2: 450.9, ch4: 0.0036, n2o: 0.0085 },
        "2022": { co2: 436.3, ch4: 0.0036, n2o: 0.0085 }
    },
    "발전단": {
        "2017": { co2: 415.5, ch4: 0.0034, n2o: 0.0082 },
        "2018": { co2: 416.3, ch4: 0.0034, n2o: 0.0082 },
        "2019": { co2: 416.7, ch4: 0.0034, n2o: 0.0082 },
        "2020": { co2: 416.3, ch4: 0.0034, n2o: 0.0082 },
        "2021": { co2: 408.5, ch4: 0.0034, n2o: 0.0082 },
        "2022": { co2: 395.3, ch4: 0.0034, n2o: 0.0082 }
    }
};

// 기존 호환용 (레거시 코드 지원)
const ELECTRICITY_HEAT_DATA = {
    "전기(소비단)": {
        "17": { co2: 456.7, ch4: 0.0036, n2o: 0.0085 },  // 3기 = 17년 기준
        "22": { co2: 474.7, ch4: 0.0125, n2o: 0.01 }     // 4기 = 22년 기준
    },
    "전기(발전단)": {
        "17": { co2: 440.1, ch4: 0.0034, n2o: 0.0082 },
        "22": { co2: 442.0, ch4: 0.0034, n2o: 0.0082 }
    },
    // 열 배출계수 (kgGHG/TJ) - 주의: TJ 단위!
    "열전용": {
        "17": { co2: 56373, ch4: 1.278, n2o: 0.166, unit: "TJ" },  // row 101
        "22": { co2: 56373, ch4: 1.278, n2o: 0.166, unit: "TJ" }
    },
    "열병합": {
        "17": { co2: 60760, ch4: 2.053, n2o: 0.549, unit: "TJ" },  // row 102
        "22": { co2: 60760, ch4: 2.053, n2o: 0.549, unit: "TJ" }
    },
    "열평균": {
        "17": { co2: 59510, ch4: 1.832, n2o: 0.44, unit: "TJ" },   // row 103
        "22": { co2: 59510, ch4: 1.832, n2o: 0.44, unit: "TJ" }
    }
};

// 지역난방 배출계수 (kgGHG/TJ) - _Supplier 시트 기준
const DISTRICT_HEATING_DATA = {
    // 3기 (2019-2023) - B6:E13
    "수도권지사_3기": { co2: 35840, ch4: 0.649, n2o: 0.0658 },
    "평택지사_3기": { co2: 11041, ch4: 0.232, n2o: 0.0204 },
    "청주지사_3기": { co2: 66698, ch4: 2.536, n2o: 0.5058 },
    "세종지사_3기": { co2: 41305, ch4: 0.742, n2o: 0.0742 },
    "대구지사_3기": { co2: 42010, ch4: 0.7547, n2o: 0.0755 },
    "김해지사_3기": { co2: 33977, ch4: 0.6056, n2o: 0.0606 },
    "광주전남지사_3기": { co2: 41830, ch4: 13.93, n2o: 1.8397 },
    
    // 4기 (2024-2028) - B14:E21
    "수도권지사_4기": { co2: 35991, ch4: 0.6519, n2o: 0.0661 },
    "평택지사_4기": { co2: 18391, ch4: 0.3574, n2o: 0.0334 },
    "청주지사_4기": { co2: 67038, ch4: 2.549, n2o: 0.5084 },
    "세종지사_4기": { co2: 41305, ch4: 0.742, n2o: 0.0742 },
    "대구지사_4기": { co2: 53392, ch4: 6.2051, n2o: 0.9549 },
    "양산지사_4기": { co2: 43042, ch4: 0.7686, n2o: 0.0769 },
    "김해지사_4기": { co2: 35595, ch4: 0.6345, n2o: 0.0635 },
    "광주전남지사_4기": { co2: 41830, ch4: 13.93, n2o: 1.8397 }
};

// ===== Scope 3 데이터 =====

// ===== 배출계수 기준 선택 옵션 =====
// 사용자가 선택할 수 있는 3가지 기준
const EMISSION_FACTOR_STANDARDS = {
    "ESTIMATE": {
        name: "⚠️ 참고용 추정치",
        shortName: "추정치",
        description: "공식 출처 미확인, 대략적 규모 파악용"
    },
    "DEFRA": {
        name: "UK DEFRA 2024",
        shortName: "DEFRA",
        description: "영국 정부 공식 배출계수 (국제적으로 가장 많이 인용)"
    },
    "FUEL_BASED": {
        name: "연료 기반 직접 계산",
        shortName: "연료기반",
        description: "에너지관리공단 공식 배출계수 사용"
    }
};

// 현재 선택된 배출계수 기준
let currentEmissionStandard = "ESTIMATE";

// ===== DEFRA 2024 배출계수 (영국 정부 공식) =====
// 출처: UK Government GHG Conversion Factors 2024
// https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024
const DEFRA_EMISSION_FACTORS = {
    // === 항공 ===
    "항공_국내": {
        name: "항공 (국내선)",
        unit: "인·km",
        co2: 0.246,
        description: "Domestic flight average",
        source: "DEFRA 2024"
    },
    "항공_국제_단거리": {
        name: "항공 (국제-단거리)",
        unit: "인·km",
        co2: 0.151,
        description: "Short-haul (<3,700km), economy",
        source: "DEFRA 2024"
    },
    "항공_국제_장거리": {
        name: "항공 (국제-장거리)",
        unit: "인·km",
        co2: 0.148,
        description: "Long-haul (>3,700km), economy",
        source: "DEFRA 2024"
    },
    // === 철도 ===
    "KTX": {
        name: "KTX/SRT",
        unit: "인·km",
        co2: 0.035,
        description: "National rail (전철화 노선)",
        source: "DEFRA 2024"
    },
    "일반열차": {
        name: "일반열차",
        unit: "인·km",
        co2: 0.035,
        description: "National rail average",
        source: "DEFRA 2024"
    },
    // === 버스 ===
    "시외버스": {
        name: "시외/고속버스",
        unit: "인·km",
        co2: 0.027,
        description: "Coach",
        source: "DEFRA 2024"
    },
    "시내버스": {
        name: "시내버스",
        unit: "인·km",
        co2: 0.089,
        description: "Local bus",
        source: "DEFRA 2024"
    },
    // === 승용차 ===
    "승용차_휘발유": {
        name: "승용차 (휘발유)",
        unit: "km",
        co2: 0.170,
        description: "Medium petrol car",
        source: "DEFRA 2024"
    },
    "승용차_경유": {
        name: "승용차 (경유)",
        unit: "km",
        co2: 0.163,
        description: "Medium diesel car",
        source: "DEFRA 2024"
    },
    "승용차_LPG": {
        name: "승용차 (LPG)",
        unit: "km",
        co2: 0.178,
        description: "LPG car average",
        source: "DEFRA 2024"
    },
    "승용차_하이브리드": {
        name: "승용차 (하이브리드)",
        unit: "km",
        co2: 0.106,
        description: "Hybrid car average",
        source: "DEFRA 2024"
    },
    "승용차_전기": {
        name: "승용차 (전기)",
        unit: "km",
        co2: 0.050,
        description: "BEV (UK grid average)",
        source: "DEFRA 2024"
    },
    // === 지하철/도시철도 ===
    "지하철": {
        name: "지하철/도시철도",
        unit: "인·km",
        co2: 0.027,
        description: "Light rail and tram",
        source: "DEFRA 2024"
    },
    // === 무배출 ===
    "자전거": {
        name: "자전거",
        unit: "km",
        co2: 0,
        description: "Zero emission",
        source: "-"
    },
    "도보": {
        name: "도보",
        unit: "km",
        co2: 0,
        description: "Zero emission",
        source: "-"
    }
};

// ===== 연료 기반 배출계수 (에너지관리공단 공식) =====
// 출처: 도로운송 업종 온실가스 배출량 산정 Good Practice 가이드라인 (에너지관리공단, 2009)
// 표 11: 사용연료에 따른 도로운송차량의 온실가스 배출계수
const FUEL_BASED_EMISSION_FACTORS = {
    "휘발유": {
        name: "휘발유",
        unit: "L",  // 리터 기준
        netHeatValue: 32.14,  // MJ/L (순발열량)
        co2: 72233,  // kg/TJ
        ch4: 3.8,    // kg/TJ
        n2o: 5.7,    // kg/TJ
        density: 0.73,  // kg/L
        source: "에너지관리공단 2009"
    },
    "경유": {
        name: "경유",
        unit: "L",
        netHeatValue: 35.27,  // MJ/L
        co2: 72600,  // kg/TJ
        ch4: 3.9,    // kg/TJ
        n2o: 3.9,    // kg/TJ
        density: 0.85,  // kg/L
        source: "에너지관리공단 2009"
    },
    "LPG": {
        name: "LPG",
        unit: "L",
        netHeatValue: 26.49,  // MJ/L
        co2: 64900,  // kg/TJ
        ch4: 62,     // kg/TJ
        n2o: 0.2,    // kg/TJ
        density: 0.54,  // kg/L
        source: "에너지관리공단 2009"
    },
    "CNG": {
        name: "CNG (압축천연가스)",
        unit: "Nm³",  // 노말 입방미터 기준
        netHeatValue: 35.69,  // MJ/Nm³
        co2: 56467,  // kg/TJ
        ch4: 92,     // kg/TJ
        n2o: 3,      // kg/TJ
        density: 0.72,  // kg/Nm³
        source: "에너지관리공단 2009"
    }
};

// 차량 연비 기본값 (km/L 또는 km/Nm³)
const DEFAULT_FUEL_EFFICIENCY = {
    "휘발유": 12.5,   // km/L
    "경유": 14.0,     // km/L
    "LPG": 10.0,      // km/L
    "CNG": 3.5        // km/Nm³ (버스 기준)
};

// ===== 참고용 추정치 (기존 값) =====
// ⚠️ 주의: 공식 출처 미확인
// 교통수단별 배출계수 (kgCO2eq/km 또는 kgCO2eq/인·km)
const TRANSPORT_EMISSION_FACTORS = {
    // === 출장 ===
    "항공_국내": {
        name: "항공 (국내선)",
        unit: "인·km",
        co2: 0.158,  // kgCO2eq/인·km
        description: "국내선 항공 평균",
        source: "추정"
    },
    "항공_국제_단거리": {
        name: "항공 (국제선-단거리)",
        unit: "인·km",
        co2: 0.121,
        description: "3,000km 미만",
        source: "추정"
    },
    "항공_국제_장거리": {
        name: "항공 (국제선-장거리)",
        unit: "인·km",
        co2: 0.095,
        description: "3,000km 이상",
        source: "추정"
    },
    "KTX": {
        name: "KTX/SRT",
        unit: "인·km",
        co2: 0.008,
        description: "고속철도",
        source: "추정"
    },
    "일반열차": {
        name: "일반열차",
        unit: "인·km",
        co2: 0.027,
        description: "무궁화, 새마을 등",
        source: "추정"
    },
    "시외버스": {
        name: "시외/고속버스",
        unit: "인·km",
        co2: 0.027,
        description: "시외/고속버스",
        source: "추정"
    },
    "승용차_휘발유": {
        name: "승용차 (휘발유)",
        unit: "km",
        co2: 0.192,
        description: "중형차 기준",
        source: "추정"
    },
    "승용차_경유": {
        name: "승용차 (경유)",
        unit: "km",
        co2: 0.171,
        description: "중형차 기준",
        source: "추정"
    },
    "승용차_LPG": {
        name: "승용차 (LPG)",
        unit: "km",
        co2: 0.178,
        description: "중형차 기준",
        source: "추정"
    },
    "승용차_하이브리드": {
        name: "승용차 (하이브리드)",
        unit: "km",
        co2: 0.106,
        description: "하이브리드",
        source: "추정"
    },
    "승용차_전기": {
        name: "승용차 (전기)",
        unit: "km",
        co2: 0.047,
        description: "전기차 (전력 간접배출 포함)",
        source: "추정"
    },
    
    // === 통근 ===
    "지하철": {
        name: "지하철/도시철도",
        unit: "인·km",
        co2: 0.014,
        description: "도시철도",
        source: "추정"
    },
    "시내버스": {
        name: "시내버스",
        unit: "인·km",
        co2: 0.055,
        description: "시내버스",
        source: "추정"
    },
    "자전거": {
        name: "자전거",
        unit: "km",
        co2: 0,
        description: "무배출",
        source: "-"
    },
    "도보": {
        name: "도보",
        unit: "km",
        co2: 0,
        description: "무배출",
        source: "-"
    }
};

// 출장 카테고리
const BUSINESS_TRAVEL_CATEGORIES = [
    { id: "항공_국내", group: "항공" },
    { id: "항공_국제_단거리", group: "항공" },
    { id: "항공_국제_장거리", group: "항공" },
    { id: "KTX", group: "철도" },
    { id: "일반열차", group: "철도" },
    { id: "시외버스", group: "버스" },
    { id: "승용차_휘발유", group: "승용차" },
    { id: "승용차_경유", group: "승용차" },
    { id: "승용차_LPG", group: "승용차" },
    { id: "승용차_하이브리드", group: "승용차" },
    { id: "승용차_전기", group: "승용차" }
];

// 통근 카테고리
const COMMUTE_CATEGORIES = [
    { id: "지하철", group: "대중교통" },
    { id: "시내버스", group: "대중교통" },
    { id: "승용차_휘발유", group: "승용차" },
    { id: "승용차_경유", group: "승용차" },
    { id: "승용차_LPG", group: "승용차" },
    { id: "승용차_하이브리드", group: "승용차" },
    { id: "승용차_전기", group: "승용차" },
    { id: "자전거", group: "친환경" },
    { id: "도보", group: "친환경" }
];

// ===== 폐기물 배출계수 =====
// 📌 출처: 2024년 국가 온실가스 인벤토리 보고서 (표 7-33)
// 📌 소각 Non-CO2: CH4, N2O → SAR GWP 적용하여 CO2eq 변환
// 📌 매립: FOD 방법론 사용, 단순 계수화 어려움 → 추정치 표시
// ⚠️ 매립 배출계수는 참고용 추정치입니다. 정확한 산정은 FOD 방법론 필요.
const WASTE_EMISSION_FACTORS = {
    // === 소각 (kgCO2eq/ton) ===
    // 출처: 2024 국가 인벤토리 표 7-33 (Non-CO2) + 표 7-32 (CO2)
    // 생활폐기물: CH4=6.1g/t, N2O=52.1g/t → Non-CO2만 16.3 kgCO2eq/t (SAR 기준)
    "소각_생활폐기물": {
        name: "생활폐기물 소각",
        unit: "ton",
        co2: 350,  // 플라스틱 비율에 따라 변동, Non-CO2 + 화석탄소 CO2
        ch4: 0.0061,  // 6.1 g/t = 0.0061 kg/t (공식)
        n2o: 0.0521,  // 52.1 g/t = 0.0521 kg/t (공식)
        description: "2024 국가 인벤토리 표 7-33",
        source: "공식"
    },
    "소각_사업장폐기물": {
        name: "사업장폐기물 소각",
        unit: "ton",
        co2: 450,
        ch4: 0.0139,  // 13.9 g/t (공식)
        n2o: 0.1297,  // 129.7 g/t (공식)
        description: "2024 국가 인벤토리 표 7-33",
        source: "공식"
    },
    "소각_하수슬러지": {
        name: "하수슬러지 소각",
        unit: "ton",
        co2: 160,  // 유기물 주, 화석탄소 적음
        ch4: 0.018,   // 18.0 g/t (공식)
        n2o: 0.4491,  // 449.1 g/t (공식)
        description: "2024 국가 인벤토리 표 7-33",
        source: "공식"
    },
    "소각_의료폐기물": {
        name: "의료폐기물 소각",
        unit: "ton",
        co2: 600,  // 플라스틱 함량 높음
        ch4: 0.0028,  // 2.8 g/t (공식)
        n2o: 0.0945,  // 94.5 g/t (공식)
        description: "2024 국가 인벤토리 표 7-33",
        source: "공식"
    },
    
    // === 매립 (kgCO2eq/ton) ===
    // ⚠️ 참고용 추정치 - FOD 방법론 적용 필요
    // DOC, DOCf, MCF, F 등 매개변수 기반 시간적분 필요
    "매립_일반": {
        name: "일반폐기물 매립",
        unit: "ton",
        co2: 450,  // ⚠️ 참고용 추정치
        description: "⚠️ 추정치, DOC 0.15 기준",
        source: "추정"
    },
    "매립_음식물": {
        name: "음식물폐기물 매립",
        unit: "ton",
        co2: 580,  // ⚠️ 참고용 추정치 (DOC 0.1319 기준)
        description: "⚠️ 추정치, DOC=0.1319 (공식)",
        source: "추정"
    },
    "매립_종이류": {
        name: "종이류 매립",
        unit: "ton",
        co2: 720,  // ⚠️ 참고용 추정치 (DOC 0.3349 기준)
        description: "⚠️ 추정치, DOC=0.3349 (공식)",
        source: "추정"
    },
    
    // === 재활용 (kgCO2eq/ton) ===
    // ⚠️ 참고용 추정치 - 공식 자료 확인 필요
    "재활용_종이": {
        name: "종이류 재활용",
        unit: "ton",
        co2: -500,
        description: "⚠️ 추정치, 신규 생산 대비 감축",
        source: "추정"
    },
    "재활용_플라스틱": {
        name: "플라스틱 재활용",
        unit: "ton",
        co2: -1200,
        description: "⚠️ 추정치, 신규 생산 대비 감축",
        source: "추정"
    },
    "재활용_금속": {
        name: "금속 재활용",
        unit: "ton",
        co2: -4500,
        description: "⚠️ 추정치, 알루미늄 등",
        source: "추정"
    },
    "재활용_유리": {
        name: "유리 재활용",
        unit: "ton",
        co2: -300,
        description: "⚠️ 추정치",
        source: "추정"
    },
    
    // === 퇴비화 ===
    "퇴비화": {
        name: "음식물 퇴비화",
        unit: "ton",
        co2: 85,
        description: "⚠️ 추정치, 호기성 분해",
        source: "추정"
    }
};

// ===== 용수 배출계수 =====
// 📌 출처: 2024년 국가 온실가스 인벤토리 보고서 (표 7-40)
// 📌 하수처리: CH4, N2O 배출계수 (공식)
// ⚠️ 상수도 배출계수는 별도 확인 필요 (전력 사용 기반)
// ⚠️ 단위 변환: 보고서는 t/t BOD 기준, m³ 변환 시 BOD 농도 가정 필요
const WATER_EMISSION_FACTORS = {
    // === 상수 (kgCO2eq/m³) ===
    // ⚠️ 참고용 추정치 - 수도사업자별 전력사용량 기반 확인 필요
    "상수_일반": {
        name: "상수도 사용",
        unit: "m³",
        co2: 0.237,
        description: "⚠️ 추정치, 취수-정수-송수",
        source: "추정"
    },
    "상수_지하수": {
        name: "지하수 사용",
        unit: "m³",
        co2: 0.15,
        description: "⚠️ 추정치, 양수 전력",
        source: "추정"
    },
    
    // === 하수 (kgCO2eq/m³) ===
    // 📌 2024 국가 인벤토리 표 7-40 참조
    // BOD 농도 가정: 일반 200mg/L, 고도처리 시설
    "하수_물리적처리": {
        name: "하수처리 (물리적)",
        unit: "m³",
        co2: 0.32,
        ch4_factor: 0.01532,  // t CH4/t BOD (공식)
        n2o_factor: 0.00174,  // t N2O/t N (공식)
        description: "2024 국가 인벤토리 표 7-40",
        source: "공식_변환"
    },
    "하수_생물학적처리": {
        name: "하수처리 (생물학적)",
        unit: "m³",
        co2: 0.42,
        ch4_factor: 0.02245,  // t CH4/t BOD (공식)
        n2o_factor: 0.018,    // t N2O/t N (공식)
        description: "2024 국가 인벤토리 표 7-40",
        source: "공식_변환"
    },
    "하수_고도처리": {
        name: "고도하수처리",
        unit: "m³",
        co2: 0.38,
        ch4_factor: 0.00779,  // t CH4/t BOD (공식)
        n2o_factor: 0.0122,   // t N2O/t N (공식)
        description: "2024 국가 인벤토리 표 7-40",
        source: "공식_변환"
    },
    "하수_종말처리": {
        name: "폐수종말처리",
        unit: "m³",
        co2: 0.25,
        ch4_factor: 0.0017698,  // t CH4/t BOD (공식)
        n2o_factor: 0.0056814,  // t N2O/t N (공식)
        description: "2024 국가 인벤토리 표 7-40",
        source: "공식_변환"
    },
    
    // === 중수도/빗물 ===
    "중수도": {
        name: "중수도 재이용",
        unit: "m³",
        co2: 0.18,
        description: "⚠️ 추정치",
        source: "추정"
    },
    "빗물이용": {
        name: "빗물 이용",
        unit: "m³",
        co2: 0.05,
        description: "⚠️ 추정치",
        source: "추정"
    }
};
