/**
 * 온실가스 계산기 v2.6 - 앱 컨트롤러
 * 헤더 애니메이션, 테마 전환, 리스트 관리, 엑셀 내보내기
 */

// ===== 전역 상태 =====
let emissionList = [];
let itemIdCounter = 0;

// ===== 전역 변수 =====
let emissionChart = null;
let currentChartType = 'pie';

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', () => {
    initMainTabs();  // 메인 탭 네비게이션 초기화
    initHeader();
    initTheme();
    initCalculators();
    initListButtons();
    initChart();
    initStorage();  // 저장/불러오기 초기화
    initHelpSystem();  // 도움말 & 참고값 초기화
    loadFromLocalStorage();  // 저장된 데이터 불러오기
});

// ===== 메인 탭 네비게이션 =====
function initMainTabs() {
    const tabButtons = document.querySelectorAll('.main-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // 모든 탭 버튼 비활성화
            tabButtons.forEach(b => b.classList.remove('active'));
            // 클릭한 탭 활성화
            btn.classList.add('active');
            
            // 모든 탭 콘텐츠 숨기기
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            // 해당 탭 콘텐츠 표시
            const targetContent = document.getElementById(`tab-${targetTab}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
            
            // 계산기 탭으로 돌아올 때 차트 재렌더링
            if (targetTab === 'calculator' && emissionList.length > 0) {
                setTimeout(() => {
                    renderChart(currentChartType);
                }, 100);
            }
        });
    });
    
    // 가이드/매뉴얼 내부 링크 부드러운 스크롤
    document.querySelectorAll('.guide-toc a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// ===== 헤더 애니메이션 + 본문 블러 =====
function initHeader() {
    const header = document.getElementById('header');
    
    setTimeout(() => {
        header.classList.add('active');
        document.body.classList.add('loaded');
    }, 2000);
}

// ===== 테마 관리 =====
function initTheme() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    const savedTheme = localStorage.getItem('ghgTheme') || 'night';
    
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateActiveTheme(savedTheme);
    
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('ghgTheme', theme);
            updateActiveTheme(theme);
        });
    });
}

function updateActiveTheme(activeTheme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === activeTheme);
    });
}

// ===== 계산기 초기화 =====
function initCalculators() {
    // 기본 설정 이벤트
    document.getElementById('buildingType').addEventListener('change', updateAllCalculations);
    document.getElementById('annualEmission').addEventListener('input', () => {
        updateFacilitySize();
        updateMinTiers();
    });
    document.getElementById('emissionYear').addEventListener('change', updateAllCalculations);
    document.getElementById('heatYear').addEventListener('change', updateAllCalculations);
    
    // 건물 정보 이벤트 (원단위 계산용)
    document.getElementById('buildingCategory').addEventListener('change', onBuildingInfoChange);
    document.getElementById('buildingArea').addEventListener('input', onBuildingInfoChange);
    document.getElementById('buildingOccupants').addEventListener('input', onBuildingInfoChange);
    
    // 신재생에너지 입력 이벤트 (ZEB 계산)
    document.getElementById('renewableEnergy').addEventListener('input', onRenewableChange);
    
    // GWP 기준 선택 이벤트
    document.getElementById('gwpStandard').addEventListener('change', onGWPChange);
    
    // Scope 1 이벤트
    document.getElementById('scope1Fuel').addEventListener('change', onScope1FuelChange);
    document.getElementById('scope1FuelState').addEventListener('change', onScope1FuelStateChange);
    document.getElementById('scope1Usage').addEventListener('input', calculateScope1);
    document.getElementById('scope1Unit').addEventListener('change', calculateScope1);
    document.getElementById('scope1HeatTier').addEventListener('change', onScope1TierChange);
    document.getElementById('scope1EmissionTier').addEventListener('change', onScope1EmissionTierChange);
    
    // T3 직접입력 이벤트
    document.getElementById('scope1HeatT3').addEventListener('input', calculateScope1);
    document.getElementById('scope1EmissionT3').addEventListener('input', calculateScope1);
    document.getElementById('scope1OxidationT3').addEventListener('input', calculateScope1);
    
    // Scope 2 이벤트
    document.getElementById('scope2Source').addEventListener('change', onScope2SourceChange);
    document.getElementById('scope2Usage').addEventListener('input', calculateScope2);
    document.getElementById('scope2Unit').addEventListener('change', calculateScope2);
    document.getElementById('scope2HeatTier').addEventListener('change', onScope2HeatTierChange);
    document.getElementById('districtRegion').addEventListener('change', updateScope2Params);
    document.getElementById('districtPeriod').addEventListener('change', updateScope2Params);
    document.getElementById('electricityYear').addEventListener('change', updateScope2Params);
    
    // Scope 3 이벤트
    initScope3();
    
    // 초기 설정
    updateFacilitySize();
    updateMinTiers();
    onScope1FuelChange();
    onScope2SourceChange();
}

// ===== 시설규모 판정 (수정됨) =====
function updateFacilitySize() {
    const emission = parseFloat(document.getElementById('annualEmission').value) || 0;
    let size;
    
    // 올바른 로직: 0~5 → A, 5~50 → B, 50+ → C
    if (emission < 5) {
        size = 'A';
    } else if (emission < 50) {
        size = 'B';
    } else {
        size = 'C';
    }
    
    document.getElementById('facilitySize').value = size;
}

// ===== Tier 최소 기준 =====
function updateMinTiers() {
    const size = document.getElementById('facilitySize').value;
    let minHeat, minEmission, minOxidation;
    
    switch(size) {
        case 'A':
            minHeat = 'T2'; minEmission = 'T1'; minOxidation = 'T1';
            break;
        case 'B':
            minHeat = 'T2'; minEmission = 'T2'; minOxidation = 'T2';
            break;
        case 'C':
            minHeat = 'T3'; minEmission = 'T3'; minOxidation = 'T3';
            break;
    }
    
    document.getElementById('minHeatTier').textContent = minHeat;
    document.getElementById('minEmissionTier').textContent = minEmission;
    document.getElementById('minOxidationTier').textContent = minOxidation;
    
    document.getElementById('heatTierMin').textContent = `(최소: ${minHeat})`;
    document.getElementById('emissionTierMin').textContent = `(최소: ${minEmission})`;
    document.getElementById('oxidationTierMin').textContent = `(=배출Tier)`;
}

// ===== GWP 기준 변경 =====
function onGWPChange() {
    const gwpKey = document.getElementById('gwpStandard').value;
    currentGWP = GWP_OPTIONS[gwpKey];
    
    // UI 업데이트
    document.getElementById('gwpCH4').textContent = currentGWP.CH4;
    document.getElementById('gwpN2O').textContent = currentGWP.N2O;
    
    // 모든 계산 다시 수행
    updateAllCalculations();
    
    // 목록도 다시 계산 (이미 추가된 항목들의 합계 재계산)
    updateTotals();
}

// ===== Scope 1 =====
function onScope1FuelChange() {
    const fuel = document.getElementById('scope1Fuel').value;
    const fuelData = FUEL_DATA[fuel];
    
    if (fuelData) {
        // 단위 옵션 업데이트
        const unitSelect = document.getElementById('scope1Unit');
        unitSelect.innerHTML = '';
        fuelData.units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            unitSelect.appendChild(option);
        });
        
        // 연료 상태를 Default로 리셋
        document.getElementById('scope1FuelState').value = 'Default';
        updateActualFuelState();
        
        // 바이오연료 배지 표시/숨김
        const biofuelBadge = document.getElementById('biofuelBadge');
        if (biofuelBadge) {
            biofuelBadge.style.display = fuelData.isBiofuel ? 'inline-block' : 'none';
        }
    }
    
    updateScope1Params();
}

function onScope1FuelStateChange() {
    updateActualFuelState();
    updateScope1Params();
}

function updateActualFuelState() {
    const fuel = document.getElementById('scope1Fuel').value;
    const selectedState = document.getElementById('scope1FuelState').value;
    const fuelData = FUEL_DATA[fuel];
    
    let actualState;
    if (selectedState === 'Default') {
        actualState = fuelData ? fuelData.state : '기체';
    } else {
        actualState = selectedState;
    }
    
    document.getElementById('scope1ActualState').textContent = actualState;
}

function onScope1TierChange() {
    const tier = document.getElementById('scope1HeatTier').value;
    document.getElementById('heatT3Input').style.display = tier === 'T3' ? 'block' : 'none';
    updateScope1Params();
}

function onScope1EmissionTierChange() {
    const tier = document.getElementById('scope1EmissionTier').value;
    
    // 산화계수 Tier = 배출계수 Tier (자동 연동)
    document.getElementById('scope1OxidationTier').value = tier;
    
    // T3 입력란 표시
    document.getElementById('emissionT3Input').style.display = tier === 'T3' ? 'block' : 'none';
    document.getElementById('oxidationT3Input').style.display = tier === 'T3' ? 'block' : 'none';
    
    updateScope1Params();
}

function updateScope1Params() {
    const fuel = document.getElementById('scope1Fuel').value;
    const heatTier = document.getElementById('scope1HeatTier').value;
    const emissionTier = document.getElementById('scope1EmissionTier').value;
    const emissionYear = document.getElementById('emissionYear').value;
    const heatYear = document.getElementById('heatYear').value;
    const selectedState = document.getElementById('scope1FuelState').value;
    
    const fuelData = FUEL_DATA[fuel];
    if (!fuelData) return;
    
    // 실제 연료 상태
    const actualState = selectedState === 'Default' ? fuelData.state : selectedState;
    
    // 열량계수
    let heatValue;
    if (heatTier === 'T3') {
        heatValue = parseFloat(document.getElementById('scope1HeatT3').value) || 0;
    } else if (heatTier === 'T1') {
        heatValue = fuelData.heat_ipcc || fuelData.heat_17;
    } else {
        heatValue = heatYear.includes('22') ? (fuelData.heat_22 || fuelData.heat_17) : fuelData.heat_17;
    }
    document.getElementById('scope1HeatValue').textContent = formatNumber(heatValue, 1);
    
    // 배출계수 (CO2)
    let emissionValue;
    if (emissionTier === 'T3') {
        emissionValue = parseFloat(document.getElementById('scope1EmissionT3').value) || 0;
    } else if (emissionTier === 'T1') {
        emissionValue = fuelData.co2_ipcc || fuelData.co2_17;
    } else {
        emissionValue = emissionYear.includes('22') ? (fuelData.co2_22 || fuelData.co2_17) : fuelData.co2_17;
    }
    document.getElementById('scope1EmissionValue').textContent = formatNumber(emissionValue, 0);
    
    // 산화계수
    const oxidationTier = emissionTier; // 배출계수 Tier와 동일
    let oxidationValue;
    if (oxidationTier === 'T3') {
        oxidationValue = parseFloat(document.getElementById('scope1OxidationT3').value) || 1;
    } else if (oxidationTier === 'T1') {
        oxidationValue = 1;
    } else {
        // T2: 연료 상태별 산화계수
        oxidationValue = OXIDATION_FACTORS[actualState] || 1;
    }
    document.getElementById('scope1OxidationValue').textContent = oxidationValue.toFixed(3);
    
    calculateScope1();
}

function calculateScope1() {
    const fuel = document.getElementById('scope1Fuel').value;
    const usage = parseFloat(document.getElementById('scope1Usage').value) || 0;
    const heatTier = document.getElementById('scope1HeatTier').value;
    const emissionTier = document.getElementById('scope1EmissionTier').value;
    const emissionYear = document.getElementById('emissionYear').value;
    const heatYear = document.getElementById('heatYear').value;
    const buildingType = document.getElementById('buildingType').value;
    const selectedState = document.getElementById('scope1FuelState').value;
    
    const fuelData = FUEL_DATA[fuel];
    if (!fuelData) return;
    
    const actualState = selectedState === 'Default' ? fuelData.state : selectedState;
    
    // 열량계수
    let heatValue;
    if (heatTier === 'T3') {
        heatValue = parseFloat(document.getElementById('scope1HeatT3').value) || 0;
    } else if (heatTier === 'T1') {
        heatValue = fuelData.heat_ipcc || fuelData.heat_17;
    } else {
        heatValue = heatYear.includes('22') ? (fuelData.heat_22 || fuelData.heat_17) : fuelData.heat_17;
    }
    
    // 산화계수
    const oxidationTier = emissionTier;
    let oxidation;
    if (oxidationTier === 'T3') {
        oxidation = parseFloat(document.getElementById('scope1OxidationT3').value) || 1;
    } else if (oxidationTier === 'T1') {
        oxidation = 1;
    } else {
        oxidation = OXIDATION_FACTORS[actualState] || 1;
    }
    
    // 배출계수들
    let co2_ef, ch4_ef, n2o_ef;
    const isResidential = buildingType === '주거용';
    
    if (emissionTier === 'T3') {
        co2_ef = parseFloat(document.getElementById('scope1EmissionT3').value) || 0;
        ch4_ef = 0;
        n2o_ef = 0;
    } else if (emissionTier === 'T1') {
        // T1: IPCC 값 사용 (CH4, N2O는 주거/상업 구분 없음!)
        co2_ef = fuelData.co2_ipcc;
        ch4_ef = fuelData.ch4_ipcc;
        n2o_ef = fuelData.n2o_ipcc;
    } else {
        // T2: 국가 고유값 사용 (CH4, N2O는 주거/상업 구분 있음)
        if (emissionYear.includes('22')) {
            co2_ef = fuelData.co2_22 || fuelData.co2_17;
            ch4_ef = isResidential ? (fuelData.ch4_22_res || fuelData.ch4_17_res) : (fuelData.ch4_22_com || fuelData.ch4_17_com);
            n2o_ef = isResidential ? (fuelData.n2o_22_res || fuelData.n2o_17_res) : (fuelData.n2o_22_com || fuelData.n2o_17_com);
        } else {
            co2_ef = fuelData.co2_17;
            ch4_ef = isResidential ? fuelData.ch4_17_res : fuelData.ch4_17_com;
            n2o_ef = isResidential ? fuelData.n2o_17_res : fuelData.n2o_17_com;
        }
    }
    
    // 배출량 계산
    const factor = usage * heatValue * 1e-6;
    const co2 = factor * co2_ef * oxidation;
    const ch4 = factor * (ch4_ef || 0); // CH4, N2O는 산화계수 미적용
    const n2o = factor * (n2o_ef || 0);
    
    const co2eq = co2 + (ch4 * GWP.CH4) + (n2o * GWP.N2O);
    
    document.getElementById('scope1ResultCO2').textContent = formatScientific(co2);
    document.getElementById('scope1ResultCH4').textContent = formatScientific(ch4);
    document.getElementById('scope1ResultN2O').textContent = formatScientific(n2o);
    document.getElementById('scope1Total').textContent = formatScientific(co2eq);
}

// ===== Scope 2 =====
function onScope2SourceChange() {
    const source = document.getElementById('scope2Source').value;
    const districtSection = document.getElementById('districtHeatingSection');
    const electricityYearSection = document.getElementById('electricityYearSection');
    const powerTierBadge = document.getElementById('scope2PowerTierBadge');
    const heatTierBadge = document.getElementById('scope2HeatTierBadge');
    
    // 지역난방 설정 표시
    districtSection.style.display = source === '지역난방' ? 'block' : 'none';
    
    // 전력 연도 선택 표시 (전기 선택 시만)
    const isElectricity = source === '전기(소비단)' || source === '전기(발전단)';
    electricityYearSection.style.display = isElectricity ? 'block' : 'none';
    
    // Tier 표시
    if (source === '전기(소비단)') {
        document.getElementById('scope2PowerTier').textContent = 'T2';
        document.getElementById('scope2HeatTier').value = '-';
        powerTierBadge.style.display = 'flex';
        heatTierBadge.style.display = 'flex';
    } else {
        document.getElementById('scope2PowerTier').textContent = '-';
        document.getElementById('scope2HeatTier').value = 'T3';
        powerTierBadge.style.display = 'flex';
        heatTierBadge.style.display = 'flex';
    }
    
    onScope2HeatTierChange();
    updateScope2Params();
}

function onScope2HeatTierChange() {
    const heatTier = document.getElementById('scope2HeatTier').value;
    document.getElementById('scope2HeatT3Input').style.display = heatTier === 'T3' ? 'block' : 'none';
    updateScope2Params();
}

function updateScope2Params() {
    const source = document.getElementById('scope2Source').value;
    const emissionYear = document.getElementById('emissionYear').value;
    const electricityYear = document.getElementById('electricityYear')?.value || 'ETS_4기';
    
    let coefs;
    let unit = 'kg/MWh';
    let noteText = '';
    
    if (source === '지역난방') {
        const region = document.getElementById('districtRegion').value;
        const period = document.getElementById('districtPeriod').value;
        coefs = DISTRICT_HEATING_DATA[`${region}_${period}`] || DISTRICT_HEATING_DATA['수도권지사_4기'];
        unit = 'kg/TJ';
        noteText = `출처: 한국지역난방공사 (${period})`;
    } else if (source === '전기(소비단)' || source === '전기(발전단)') {
        // 배출권거래제 기준 vs 연도별 실측값 구분
        if (electricityYear.startsWith('ETS_')) {
            // 배출권거래제 기준 (고정값)
            const period = electricityYear.replace('ETS_', '');  // "3기" or "4기"
            const etsData = ELECTRICITY_ETS_DATA[source];
            if (etsData && etsData[period]) {
                coefs = etsData[period];
                noteText = `출처: ${coefs.source} (${coefs.period})`;
            }
        } else {
            // 연도별 실측값
            const type = source === '전기(소비단)' ? '소비단' : '발전단';
            coefs = ELECTRICITY_YEARLY_DATA[type][electricityYear];
            if (!coefs) {
                coefs = ELECTRICITY_YEARLY_DATA[type]['2022'];
            }
            noteText = `출처: GIR 국가 인벤토리 (${electricityYear}년 실측)`;
        }
    } else {
        // 열(스팀) - 기존 방식
        const sourceData = ELECTRICITY_HEAT_DATA[source];
        if (sourceData) {
            coefs = emissionYear.includes('22') ? (sourceData['22'] || sourceData['17']) : sourceData['17'];
            // 열(스팀)은 TJ 단위
            if (coefs.unit === 'TJ') {
                unit = 'kg/TJ';
            }
        }
        noteText = '출처: 온실가스종합정보센터 (GIR)';
    }
    
    if (coefs) {
        document.getElementById('scope2CoefCO2').textContent = formatNumber(coefs.co2, 1);
        document.getElementById('scope2CoefCH4').textContent = formatNumber(coefs.ch4, 4);
        document.getElementById('scope2CoefN2O').textContent = formatNumber(coefs.n2o, 4);
        document.getElementById('scope2CoefUnit').textContent = unit;
    }
    
    // 노트 텍스트 업데이트
    const noteEl = document.getElementById('electricityCoefNote');
    if (noteEl && noteText) {
        noteEl.textContent = noteText;
    }
    
    calculateScope2();
}

function calculateScope2() {
    const source = document.getElementById('scope2Source').value;
    const usage = parseFloat(document.getElementById('scope2Usage').value) || 0;
    const unit = document.getElementById('scope2Unit').value;
    const emissionYear = document.getElementById('emissionYear').value;
    const electricityYear = document.getElementById('electricityYear')?.value || 'ETS_4기';
    const heatTier = document.getElementById('scope2HeatTier').value;
    
    let coefs;
    let isTJUnit = false;  // 배출계수가 TJ 단위인지
    
    // T3 직접입력인 경우
    if (heatTier === 'T3' && source !== '전기(소비단)' && source !== '전기(발전단)') {
        const co2 = parseFloat(document.getElementById('scope2HeatT3CO2').value) || 0;
        const ch4 = parseFloat(document.getElementById('scope2HeatT3CH4').value) || 0;
        const n2o = parseFloat(document.getElementById('scope2HeatT3N2O').value) || 0;
        coefs = { co2, ch4, n2o };
        isTJUnit = true;  // 직접입력은 TJ 단위
    } else if (source === '지역난방') {
        const region = document.getElementById('districtRegion').value;
        const period = document.getElementById('districtPeriod').value;
        const key = `${region}_${period}`;
        // 양산지사는 4기에만 있음 - 3기 선택 시 4기 값 사용
        coefs = DISTRICT_HEATING_DATA[key] || DISTRICT_HEATING_DATA[`${region}_4기`] || DISTRICT_HEATING_DATA['수도권지사_4기'];
        isTJUnit = true;  // 지역난방은 kgGHG/TJ
    } else if (source === '전기(소비단)' || source === '전기(발전단)') {
        // 배출권거래제 기준 vs 연도별 실측값 구분
        if (electricityYear.startsWith('ETS_')) {
            // 배출권거래제 기준 (고정값)
            const period = electricityYear.replace('ETS_', '');
            const etsData = ELECTRICITY_ETS_DATA[source];
            if (etsData && etsData[period]) {
                coefs = etsData[period];
            }
        } else {
            // 연도별 실측값
            const type = source === '전기(소비단)' ? '소비단' : '발전단';
            coefs = ELECTRICITY_YEARLY_DATA[type][electricityYear] || ELECTRICITY_YEARLY_DATA[type]['2022'];
        }
        isTJUnit = false;  // 전력은 kgGHG/MWh
    } else {
        // 열(스팀) - 기존 방식
        const sourceData = ELECTRICITY_HEAT_DATA[source];
        if (sourceData) {
            coefs = emissionYear.includes('22') ? (sourceData['22'] || sourceData['17']) : sourceData['17'];
            isTJUnit = coefs.unit === 'TJ';  // 열전용/열병합/열평균은 TJ
        }
    }
    
    if (!coefs) return;
    
    let co2, ch4, n2o;
    
    if (isTJUnit) {
        // 배출계수가 kgGHG/TJ 단위인 경우
        // 사용량을 TJ로 변환: MWh → TJ (1 TJ = 277.778 MWh)
        let usageInTJ = unit === 'TJ' ? usage : usage / 277.778;
        // 배출량 (kg) = 사용량(TJ) * 배출계수(kg/TJ)
        // → tGHG = kg / 1000
        co2 = usageInTJ * coefs.co2 * 1e-3;  // kg → ton
        ch4 = usageInTJ * coefs.ch4 * 1e-3;
        n2o = usageInTJ * coefs.n2o * 1e-3;
    } else {
        // 배출계수가 kgGHG/MWh 단위인 경우 (전기)
        let usageInMWh = unit === 'TJ' ? usage * 277.778 : usage;
        // 배출량 (kg) = 사용량(MWh) * 배출계수(kg/MWh)
        // → tGHG = kg / 1000
        co2 = usageInMWh * coefs.co2 * 1e-3;
        ch4 = usageInMWh * coefs.ch4 * 1e-3;
        n2o = usageInMWh * coefs.n2o * 1e-3;
    }
    
    const co2eq = co2 + (ch4 * GWP.CH4) + (n2o * GWP.N2O);
    
    document.getElementById('scope2ResultCO2').textContent = formatScientific(co2);
    document.getElementById('scope2ResultCH4').textContent = formatScientific(ch4);
    document.getElementById('scope2ResultN2O').textContent = formatScientific(n2o);
    document.getElementById('scope2Total').textContent = formatScientific(co2eq);
}

// ===== 공통 =====
function updateAllCalculations() {
    updateScope1Params();
    updateScope2Params();
}

// ===== 리스트 관리 =====
function initListButtons() {
    document.getElementById('addScope1Btn').addEventListener('click', addScope1ToList);
    document.getElementById('addScope2Btn').addEventListener('click', addScope2ToList);
    document.getElementById('clearListBtn').addEventListener('click', clearList);
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);
}

function addScope1ToList() {
    const fuel = document.getElementById('scope1Fuel').value;
    const usage = document.getElementById('scope1Usage').value;
    const unit = document.getElementById('scope1Unit').value;
    const stateSelect = document.getElementById('scope1FuelState')?.value || 'Default';
    const appliedState = document.getElementById('scope1ActualState')?.textContent || '';
    
    // Tier 정보 수집
    const heatTier = document.getElementById('scope1HeatTier')?.value || 'T2';
    const heatValue = document.getElementById('scope1HeatValue')?.textContent || '';
    const emissionTier = document.getElementById('scope1EmissionTier')?.value || 'T1';
    const emissionValue = document.getElementById('scope1EmissionValue')?.textContent || '';
    const oxidationTier = document.getElementById('scope1OxidationTier')?.value || 'T1';
    const oxidationValue = document.getElementById('scope1OxidationValue')?.textContent || '';
    
    // T3 직접입력 값 (해당시)
    const heatT3Value = heatTier === 'T3' ? (document.getElementById('scope1HeatT3Value')?.value || '') : '';
    const emissionT3CO2 = emissionTier === 'T3' ? (document.getElementById('scope1EmissionT3CO2')?.value || '') : '';
    const emissionT3CH4 = emissionTier === 'T3' ? (document.getElementById('scope1EmissionT3CH4')?.value || '') : '';
    const emissionT3N2O = emissionTier === 'T3' ? (document.getElementById('scope1EmissionT3N2O')?.value || '') : '';
    
    // 기본 설정 정보
    const sector = document.getElementById('buildingType')?.value || '';
    const emissionYear = document.getElementById('emissionYear')?.value || '';
    const heatYear = document.getElementById('heatYear')?.value || '';
    
    const item = {
        id: ++itemIdCounter,
        scope: 'scope1',
        icon: '🔥',
        name: fuel.split('(')[0].trim(),
        detail: `${usage} ${unit}`,
        co2: parseFloat(document.getElementById('scope1ResultCO2').textContent) || 0,
        ch4: parseFloat(document.getElementById('scope1ResultCH4').textContent) || 0,
        n2o: parseFloat(document.getElementById('scope1ResultN2O').textContent) || 0,
        total: parseFloat(document.getElementById('scope1Total').textContent) || 0,
        co2Str: document.getElementById('scope1ResultCO2').textContent,
        ch4Str: document.getElementById('scope1ResultCH4').textContent,
        n2oStr: document.getElementById('scope1ResultN2O').textContent,
        totalStr: document.getElementById('scope1Total').textContent,
        // 엑셀용 상세 정보
        meta: {
            fuel: fuel,
            state: stateSelect === 'Default' ? `Default(${appliedState})` : stateSelect,
            usage: usage,
            unit: unit,
            sector: sector,
            emissionYear: emissionYear,
            heatYear: heatYear,
            heatTier: heatTier,
            heatValue: heatValue,
            heatT3: heatT3Value,
            emissionTier: emissionTier,
            emissionValue: emissionValue,
            emissionT3: emissionTier === 'T3' ? `CO2:${emissionT3CO2}, CH4:${emissionT3CH4}, N2O:${emissionT3N2O}` : '',
            oxidationTier: oxidationTier,
            oxidationValue: oxidationValue
        }
    };
    
    emissionList.push(item);
    renderList();
    updateTotals();
}

function addScope2ToList() {
    const source = document.getElementById('scope2Source').value;
    const usage = document.getElementById('scope2Usage').value;
    const unit = document.getElementById('scope2Unit').value;
    const heatTier = document.getElementById('scope2HeatTier').value;
    const electricityYear = document.getElementById('electricityYear')?.value || 'ETS_4기';
    
    let detail = `${usage} ${unit}`;
    let region = '', period = '';
    if (source === '지역난방') {
        region = document.getElementById('districtRegion').value;
        period = document.getElementById('districtPeriod').value;
        detail = `${region} ${period} ${usage} ${unit}`;
    } else if (source === '전기(소비단)' || source === '전기(발전단)') {
        // 배출권거래제 기준 vs 연도별 실측값 구분
        if (electricityYear.startsWith('ETS_')) {
            const periodName = electricityYear.replace('ETS_', '');
            detail = `${usage} ${unit} (배출권${periodName})`;
        } else {
            detail = `${usage} ${unit} (${electricityYear}년 실측)`;
        }
    }
    
    // 배출계수 값 수집
    const co2Coef = document.getElementById('scope2CO2Coef')?.textContent || '';
    const ch4Coef = document.getElementById('scope2CH4Coef')?.textContent || '';
    const n2oCoef = document.getElementById('scope2N2OCoef')?.textContent || '';
    
    // T3 직접입력 값 (해당시)
    const heatT3CO2 = heatTier === 'T3' ? (document.getElementById('scope2HeatT3CO2')?.value || '') : '';
    const heatT3CH4 = heatTier === 'T3' ? (document.getElementById('scope2HeatT3CH4')?.value || '') : '';
    const heatT3N2O = heatTier === 'T3' ? (document.getElementById('scope2HeatT3N2O')?.value || '') : '';
    
    // 기본 설정
    const emissionYear = document.getElementById('emissionYear').value;
    
    const item = {
        id: ++itemIdCounter,
        scope: 'scope2',
        icon: '⚡',
        name: source,
        detail: detail,
        co2: parseFloat(document.getElementById('scope2ResultCO2').textContent) || 0,
        ch4: parseFloat(document.getElementById('scope2ResultCH4').textContent) || 0,
        n2o: parseFloat(document.getElementById('scope2ResultN2O').textContent) || 0,
        total: parseFloat(document.getElementById('scope2Total').textContent) || 0,
        co2Str: document.getElementById('scope2ResultCO2').textContent,
        ch4Str: document.getElementById('scope2ResultCH4').textContent,
        n2oStr: document.getElementById('scope2ResultN2O').textContent,
        totalStr: document.getElementById('scope2Total').textContent,
        // 엑셀용 상세 정보
        meta: {
            source: source,
            usage: usage,
            unit: unit,
            emissionYear: emissionYear,
            heatTier: heatTier,
            co2Coef: co2Coef,
            ch4Coef: ch4Coef,
            n2oCoef: n2oCoef,
            region: region,
            period: period,
            heatT3: heatTier === 'T3' ? `CO2:${heatT3CO2}, CH4:${heatT3CH4}, N2O:${heatT3N2O}` : ''
        }
    };
    
    emissionList.push(item);
    renderList();
    updateTotals();
}

function removeItem(id) {
    emissionList = emissionList.filter(item => item.id !== id);
    renderList();
    updateTotals();
}

function clearList() {
    emissionList = [];
    renderList();
    updateTotals();
}

function renderList() {
    const listEl = document.getElementById('emissionList');
    
    if (emissionList.length === 0) {
        listEl.innerHTML = `
            <div class="empty-list">
                <span>🌱</span>
                <p>Scope 1 또는 Scope 2에서<br>계산 후 '+ 추가' 버튼을 눌러주세요</p>
            </div>
        `;
        return;
    }
    
    listEl.innerHTML = emissionList.map(item => `
        <div class="emission-item ${item.scope}">
            <span class="emission-item-icon">${item.icon}</span>
            <div class="emission-item-info">
                <div class="emission-item-name">${item.name}</div>
                <div class="emission-item-detail">${item.detail}</div>
            </div>
            <div class="emission-item-values">
                <div class="mini-value co2"><span>CO₂</span>${item.co2Str}</div>
                <div class="mini-value ch4"><span>CH₄</span>${item.ch4Str}</div>
                <div class="mini-value n2o"><span>N₂O</span>${item.n2oStr}</div>
                <div class="mini-value total"><span>합계</span>${item.totalStr}</div>
            </div>
            <button class="emission-item-delete" onclick="removeItem(${item.id})">×</button>
        </div>
    `).join('');
}

// ===== 원단위 분석 =====
function onBuildingInfoChange() {
    const grandTotal = emissionList.reduce((s, i) => s + i.total, 0);
    updateUnitAnalysis(grandTotal);
    updateReferencePanel();
    validateScope2Input();
    saveToLocalStorage();
}

function onRenewableChange() {
    const category = document.getElementById('buildingCategory').value;
    const area = parseFloat(document.getElementById('buildingArea').value) || 0;
    if (area > 0) {
        calculateZEB(category, area);
    }
    saveToLocalStorage();
}

function updateUnitAnalysis(grandTotal) {
    const analysisSection = document.getElementById('unitAnalysis');
    const area = parseFloat(document.getElementById('buildingArea').value) || 0;
    const occupants = parseFloat(document.getElementById('buildingOccupants').value) || 0;
    const category = document.getElementById('buildingCategory').value;
    
    // 건물 정보가 없으면 숨김
    if (area <= 0 && occupants <= 0) {
        analysisSection.style.display = 'none';
        return;
    }
    
    analysisSection.style.display = 'block';
    
    // 면적당 배출량 (kgCO2eq/m²)
    const emissionPerArea = area > 0 ? (grandTotal * 1000) / area : 0;
    document.getElementById('emissionPerArea').textContent = 
        emissionPerArea > 0 ? emissionPerArea.toFixed(1) : '-';
    
    // 인당 배출량 (tCO2eq/인)
    const emissionPerPerson = occupants > 0 ? grandTotal / occupants : 0;
    document.getElementById('emissionPerPerson').textContent = 
        emissionPerPerson > 0 ? emissionPerPerson.toFixed(3) : '-';
    
    // 벤치마크 비교
    updateBenchmark(emissionPerArea, category);
}

function updateBenchmark(emissionPerArea, category) {
    const benchmark = BUILDING_BENCHMARKS[category];
    if (!benchmark || emissionPerArea <= 0) {
        document.getElementById('benchmarkMarker').style.left = '50%';
        document.getElementById('benchmarkResult').innerHTML = 
            '<span class="result-text">건물 정보를 입력하면 벤치마크 비교가 표시됩니다.</span>';
        // 인증 섹션 업데이트
        updateCertifications(0, category);
        return;
    }
    
    // 인증 섹션 업데이트
    updateCertifications(emissionPerArea, category);
    
    // 마커 위치 계산 (0% = 최고 우수, 100% = 최저)
    const range = benchmark.poor - benchmark.excellent;
    let position = ((emissionPerArea - benchmark.excellent) / range) * 100;
    position = Math.max(0, Math.min(100, position));
    
    document.getElementById('benchmarkMarker').style.left = `${position}%`;
    
    // 결과 텍스트
    let resultText = '';
    let resultClass = '';
    
    if (emissionPerArea <= benchmark.excellent) {
        resultText = `🏆 상위 10% 수준! ${benchmark.name} 평균(${benchmark.average})보다 ${((1 - emissionPerArea/benchmark.average) * 100).toFixed(0)}% 우수합니다.`;
        resultClass = 'excellent';
    } else if (emissionPerArea <= benchmark.good) {
        resultText = `✅ 상위 30% 수준입니다. ${benchmark.name} 평균(${benchmark.average})보다 ${((1 - emissionPerArea/benchmark.average) * 100).toFixed(0)}% 우수합니다.`;
        resultClass = 'good';
    } else if (emissionPerArea <= benchmark.average) {
        resultText = `📊 평균 수준입니다. (${benchmark.name} 평균: ${benchmark.average} kgCO2eq/m²)`;
        resultClass = 'average';
    } else {
        const reduction = ((emissionPerArea - benchmark.average) / emissionPerArea * 100).toFixed(0);
        resultText = `⚠️ 평균 대비 ${reduction}% 높음. 에너지 효율 개선이 필요합니다.`;
        resultClass = 'poor';
    }
    
    document.getElementById('benchmarkResult').innerHTML = 
        `<span class="result-text ${resultClass}">${resultText}</span>`;
}

// ===== G-SEED / ZEB 인증 예측 =====
function updateCertifications(emissionPerArea, category) {
    const certSection = document.getElementById('certificationSection');
    const area = parseFloat(document.getElementById('buildingArea').value) || 0;
    
    if (area <= 0 || emissionPerArea <= 0) {
        certSection.style.display = 'none';
        return;
    }
    
    certSection.style.display = 'block';
    
    // G-SEED 점수 계산
    calculateGSEED(emissionPerArea, category, area);
    
    // ZEB 계산 (신재생에너지 입력 시)
    calculateZEB(category, area);
}

function calculateGSEED(emissionPerArea, category, area) {
    const criteria = GSEED_CRITERIA;
    const baseEnergy = criteria.baselineEnergy[category] || 200;
    
    // 에너지 성능 점수 (배출량 기반 추정)
    // CO2 배출량 → 에너지 소비량 역산 (전력 기준 약 0.456 kg/kWh)
    const estimatedEnergy = emissionPerArea / 0.456 * 2.75; // 1차에너지 환산
    
    let energyPoints = 0;
    let energyLabel = "";
    for (const level of criteria.energyScore.levels) {
        if (estimatedEnergy < level.threshold) {
            energyPoints = level.points;
            energyLabel = level.label;
            break;
        }
    }
    
    // 온실가스 점수
    let ghgPoints = 0;
    for (const level of criteria.ghgScore.levels) {
        if (emissionPerArea < level.threshold) {
            ghgPoints = level.points;
            break;
        }
    }
    
    // 기타 항목 기본 점수 (실제로는 설계/시공 관련)
    const basePoints = 50; // 기본 점수
    
    // 총점 계산
    const totalScore = Math.min(100, basePoints + energyPoints + ghgPoints);
    
    // 등급 결정
    let grade = "미달";
    let gradeColor = "#95a5a6";
    for (const [gradeName, gradeInfo] of Object.entries(criteria.grades)) {
        if (totalScore >= gradeInfo.minScore) {
            grade = gradeName;
            gradeColor = gradeInfo.color;
            break;
        }
    }
    
    // UI 업데이트
    document.getElementById('gseedScore').textContent = totalScore;
    document.getElementById('gseedGrade').textContent = grade;
    document.getElementById('gseedGrade').style.background = `${gradeColor}33`;
    document.getElementById('gseedGrade').style.color = gradeColor;
    document.getElementById('gseedEnergy').textContent = `${energyPoints}/${criteria.energyScore.maxPoints}`;
    document.getElementById('gseedGhg').textContent = `${ghgPoints}/${criteria.ghgScore.maxPoints}`;
    
    // 링 애니메이션
    const ring = document.getElementById('gseedRingFill');
    const circumference = 2 * Math.PI * 45; // r=45
    const offset = circumference - (totalScore / 100) * circumference;
    ring.style.strokeDashoffset = offset;
    ring.style.stroke = gradeColor;
}

function calculateZEB(category, area) {
    const renewable = parseFloat(document.getElementById('renewableEnergy').value) || 0;
    const baseEnergy = GSEED_CRITERIA.baselineEnergy[category] || 200;
    
    // 연간 1차에너지소요량 (kWh/년)
    const annualEnergy = baseEnergy * area;
    
    // 에너지자립률 계산
    const selfRate = annualEnergy > 0 ? (renewable / annualEnergy) * 100 : 0;
    
    // UI 업데이트
    document.getElementById('zebRate').textContent = selfRate > 0 ? `${selfRate.toFixed(1)}%` : '-%';
    
    // 등급 결정
    let grade = null;
    for (const g of ZEB_CRITERIA.grades) {
        if (selfRate >= g.minRate) {
            grade = g;
            break;
        }
    }
    
    const gradeBadge = document.getElementById('zebGrade').querySelector('.grade-badge');
    const tip = document.getElementById('zebTip');
    
    if (grade) {
        gradeBadge.textContent = grade.label;
        gradeBadge.className = `grade-badge zeb-${grade.grade}`;
        tip.innerHTML = `${grade.desc}<br>🎯 축하합니다!`;
    } else if (selfRate > 0) {
        const needed = ZEB_CRITERIA.grades[ZEB_CRITERIA.grades.length - 1].minRate;
        const neededEnergy = (needed / 100) * annualEnergy;
        gradeBadge.textContent = '미달';
        gradeBadge.className = 'grade-badge';
        tip.innerHTML = `ZEB 5등급까지 ${(neededEnergy - renewable).toLocaleString()} kWh 추가 필요`;
    } else {
        gradeBadge.textContent = '-';
        gradeBadge.className = 'grade-badge';
        tip.innerHTML = '신재생에너지 생산량을 입력하면<br>ZEB 등급을 예측합니다.';
    }
}

function updateTotals() {
    const scope1Total = emissionList.filter(i => i.scope === 'scope1').reduce((s, i) => s + i.total, 0);
    const scope2Total = emissionList.filter(i => i.scope === 'scope2').reduce((s, i) => s + i.total, 0);
    const scope3Total = emissionList.filter(i => i.scope === 'scope3').reduce((s, i) => s + i.total, 0);
    const grandTotal = scope1Total + scope2Total + scope3Total;
    
    document.getElementById('totalScope1').textContent = formatScientific(scope1Total);
    document.getElementById('totalScope2').textContent = formatScientific(scope2Total);
    document.getElementById('totalScope3').textContent = formatScientific(scope3Total);
    document.getElementById('grandTotal').textContent = formatScientific(grandTotal);
    
    // 원단위 분석 업데이트
    updateUnitAnalysis(grandTotal);
    
    // 차트 업데이트
    updateChart();
    
    // localStorage 자동 저장
    saveToLocalStorage();
}

// ===== 엑셀 내보내기 =====
function exportToExcel() {
    if (emissionList.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
    }
    
    // 현재 GWP 기준
    const gwpKey = document.getElementById('gwpStandard').value;
    const gwpInfo = GWP_OPTIONS[gwpKey];
    
    let csv = '\uFEFF';
    
    // ===== 1. 요약 시트 =====
    csv += '=== 온실가스 배출량 계산 결과 ===\n';
    csv += `작성일시,${new Date().toLocaleString('ko-KR')}\n`;
    csv += `적용 GWP 기준,${gwpInfo.name}\n`;
    csv += `GWP 값,"CO2=1, CH4=${gwpInfo.CH4}, N2O=${gwpInfo.N2O}"\n\n`;
    
    csv += '--- 배출량 요약 ---\n';
    csv += '구분,항목,사용량,CO2 (tCO2),CH4 (tCH4),N2O (tN2O),합계 (tCO2eq)\n';
    
    emissionList.forEach(item => {
        let scope;
        if (item.scope === 'scope1') scope = 'Scope 1';
        else if (item.scope === 'scope2') scope = 'Scope 2';
        else scope = 'Scope 3';
        csv += `${scope},${item.name},"${item.detail}",${item.co2},${item.ch4},${item.n2o},${item.total}\n`;
    });
    
    const scope1Total = emissionList.filter(i => i.scope === 'scope1').reduce((s, i) => s + i.total, 0);
    const scope2Total = emissionList.filter(i => i.scope === 'scope2').reduce((s, i) => s + i.total, 0);
    const scope3Total = emissionList.filter(i => i.scope === 'scope3').reduce((s, i) => s + i.total, 0);
    csv += `\nScope 1 총합,,,,,,${scope1Total.toFixed(4)}\n`;
    csv += `Scope 2 총합,,,,,,${scope2Total.toFixed(4)}\n`;
    csv += `Scope 3 총합,,,,,,${scope3Total.toFixed(4)}\n`;
    csv += `총 배출량,,,,,,${(scope1Total + scope2Total + scope3Total).toFixed(4)}\n`;
    
    // ===== 2. 상세 정보 (검토용) =====
    csv += '\n\n=== 입력 상세 정보 (검토용) ===\n\n';
    
    // Scope 1 상세
    const scope1Items = emissionList.filter(i => i.scope === 'scope1');
    if (scope1Items.length > 0) {
        csv += '--- Scope 1: 직접 배출 (연료 연소) 상세 ---\n';
        csv += '연료,상태,사용량,단위,세부구분,배출계수기준,열량계수기준,열량Tier,열량값(MJ/kg),열량T3입력,배출Tier,배출값(kg/TJ),배출T3입력,산화Tier,산화계수\n';
        
        scope1Items.forEach(item => {
            const m = item.meta || {};
            csv += `"${m.fuel || ''}","${m.state || ''}",${m.usage || ''},${m.unit || ''},`;
            csv += `${m.sector || ''},${m.emissionYear || ''},${m.heatYear || ''},`;
            csv += `${m.heatTier || ''},"${m.heatValue || ''}","${m.heatT3 || ''}",`;
            csv += `${m.emissionTier || ''},"${m.emissionValue || ''}","${m.emissionT3 || ''}",`;
            csv += `${m.oxidationTier || ''},${m.oxidationValue || ''}\n`;
        });
    }
    
    // Scope 2 상세
    const scope2Items = emissionList.filter(i => i.scope === 'scope2');
    if (scope2Items.length > 0) {
        csv += '\n--- Scope 2: 간접 배출 (전기/열) 상세 ---\n';
        csv += '에너지원,사용량,단위,배출계수기준,열Tier,CO2계수,CH4계수,N2O계수,지역,계획기간,T3직접입력\n';
        
        scope2Items.forEach(item => {
            const m = item.meta || {};
            csv += `"${m.source || ''}",${m.usage || ''},${m.unit || ''},${m.emissionYear || ''},`;
            csv += `${m.heatTier || ''},"${m.co2Coef || ''}","${m.ch4Coef || ''}","${m.n2oCoef || ''}",`;
            csv += `"${m.region || ''}","${m.period || ''}","${m.heatT3 || ''}"\n`;
        });
    }
    
    // Scope 3 상세
    const scope3Items = emissionList.filter(i => i.scope === 'scope3');
    if (scope3Items.length > 0) {
        csv += '\n--- Scope 3: 기타 간접 배출 (출장/통근) 상세 ---\n';
        csv += '구분,교통수단,거리(km),인원,출근일수,배출계수(kg/km),배출량(tCO2eq)\n';
        
        scope3Items.forEach(item => {
            const category = item.category === 'travel' ? '출장' : '통근';
            const workdays = item.workdays || '-';
            csv += `${category},"${item.transportName || ''}",${item.distance || ''},${item.people || ''},${workdays},${item.coef || ''},${item.total}\n`;
        });
    }
    
    // ===== 3. 적용 기준 안내 =====
    csv += '\n\n=== 적용 기준 ===\n';
    csv += '항목,설명\n';
    csv += `GWP 기준,${gwpInfo.name}\n`;
    csv += `GWP 값,"CO2=1  CH4=${gwpInfo.CH4}  N2O=${gwpInfo.N2O}"\n`;
    csv += 'Tier 1,IPCC 기본값 사용\n';
    csv += 'Tier 2,국가 고유값 사용\n';
    csv += 'Tier 3,직접 측정값 사용\n';
    csv += '산화계수,"고체=0.98  액체=0.99  기체=0.995 (T2 기준)"\n';
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `GHG_계산결과_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

// ===== PDF 리포트 =====
function exportToPdf() {
    if (emissionList.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // 한글 폰트 설정 (기본 폰트 사용)
    doc.setFont('helvetica');
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;
    
    // 제목
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('온실가스 배출량 산정 보고서', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Building GHG Calculator v2.0 | ${new Date().toLocaleDateString('ko-KR')}`, pageWidth / 2, yPos, { align: 'center' });
    
    // 구분선
    yPos += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    
    // 1. 요약 정보
    yPos += 12;
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text('1. Summary', margin, yPos);
    
    const scope1Total = emissionList.filter(i => i.scope === 'scope1').reduce((s, i) => s + i.total, 0);
    const scope2Total = emissionList.filter(i => i.scope === 'scope2').reduce((s, i) => s + i.total, 0);
    const scope3Total = emissionList.filter(i => i.scope === 'scope3').reduce((s, i) => s + i.total, 0);
    const grandTotal = scope1Total + scope2Total + scope3Total;
    
    // 요약 테이블
    yPos += 5;
    doc.autoTable({
        startY: yPos,
        head: [['Scope', 'Emissions (tCO2eq)', 'Ratio (%)']],
        body: [
            ['Scope 1 (Direct)', scope1Total.toFixed(4), grandTotal > 0 ? ((scope1Total / grandTotal) * 100).toFixed(1) + '%' : '0%'],
            ['Scope 2 (Indirect - Energy)', scope2Total.toFixed(4), grandTotal > 0 ? ((scope2Total / grandTotal) * 100).toFixed(1) + '%' : '0%'],
            ['Scope 3 (Other Indirect)', scope3Total.toFixed(4), grandTotal > 0 ? ((scope3Total / grandTotal) * 100).toFixed(1) + '%' : '0%'],
            ['Total', grandTotal.toFixed(4), '100%']
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [70, 130, 180], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: margin, right: margin }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
    
    // 2. 적용 기준
    doc.setFontSize(14);
    doc.text('2. Applied Standards', margin, yPos);
    
    const gwpStandard = document.getElementById('gwpStandard')?.value || 'SAR';
    const emissionStandard = document.getElementById('emissionStandard')?.value || '17년';
    const heatStandard = document.getElementById('heatStandard')?.value || '17년';
    const buildingType = document.getElementById('buildingType')?.value || '주거용';
    
    yPos += 5;
    doc.autoTable({
        startY: yPos,
        body: [
            ['Calculation Standard', 'IPCC 2006 Guidelines'],
            ['GWP Standard', gwpStandard === 'SAR' ? 'IPCC SAR (1995)' : gwpStandard],
            ['Emission Factor', emissionStandard === '17년' ? 'Korea National (2017)' : 'Korea National (2022)'],
            ['Calorific Value', heatStandard === '17년' ? 'Korea National (2017)' : 'Korea National (2022)'],
            ['Building Type', buildingType === '주거용' ? 'Residential' : 'Commercial/Public']
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        margin: { left: margin, right: margin }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
    
    // 3. 상세 내역
    doc.setFontSize(14);
    doc.text('3. Emission Details', margin, yPos);
    
    yPos += 5;
    const detailData = emissionList.map(item => [
        item.scope === 'scope1' ? 'Scope 1' : item.scope === 'scope2' ? 'Scope 2' : 'Scope 3',
        item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name,
        item.detail.length > 20 ? item.detail.substring(0, 20) + '...' : item.detail,
        item.co2Str || item.co2?.toFixed(4) || '0',
        item.ch4Str || item.ch4?.toFixed(6) || '0',
        item.n2oStr || item.n2o?.toFixed(6) || '0',
        item.totalStr || item.total?.toFixed(4) || '0'
    ]);
    
    doc.autoTable({
        startY: yPos,
        head: [['Scope', 'Source', 'Detail', 'CO2', 'CH4', 'N2O', 'Total (tCO2eq)']],
        body: detailData,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [70, 130, 180], textColor: 255 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: 35 },
            2: { cellWidth: 30 },
            3: { cellWidth: 20 },
            4: { cellWidth: 20 },
            5: { cellWidth: 20 },
            6: { cellWidth: 22 }
        },
        margin: { left: margin, right: margin }
    });
    
    // 페이지 하단에 참고 정보
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Page ${i} of ${pageCount} | Generated by Building GHG Calculator`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }
    
    // PDF 다운로드
    const filename = `GHG_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
    
    showToast('PDF 리포트가 생성되었습니다!');
}

// ===== 유틸리티 =====
function formatNumber(num, decimals = 2) {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('ko-KR', { maximumFractionDigits: decimals });
}

function formatScientific(num) {
    if (num === 0) return '0';
    if (Math.abs(num) < 0.0001 || Math.abs(num) >= 10000) {
        return num.toExponential(2);
    }
    return num.toFixed(4);
}

// ===== 차트 =====
function initChart() {
    // 차트 탭 이벤트
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentChartType = tab.dataset.chart;
            updateChart();
        });
    });
}

function updateChart() {
    const chartSection = document.getElementById('chartSection');
    const canvas = document.getElementById('emissionChart');
    
    if (emissionList.length === 0) {
        chartSection.style.display = 'none';
        return;
    }
    
    chartSection.style.display = 'block';
    
    // 기존 차트 제거
    if (emissionChart) {
        emissionChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    if (currentChartType === 'pie') {
        createPieChart(ctx);
    } else if (currentChartType === 'bar') {
        createBarChart(ctx);
    } else if (currentChartType === 'line') {
        createLineChart(ctx);
    }
}

function createPieChart(ctx) {
    const scope1Total = emissionList.filter(i => i.scope === 'scope1').reduce((s, i) => s + i.total, 0);
    const scope2Total = emissionList.filter(i => i.scope === 'scope2').reduce((s, i) => s + i.total, 0);
    const scope3Total = emissionList.filter(i => i.scope === 'scope3').reduce((s, i) => s + i.total, 0);
    
    const data = [];
    const labels = [];
    const colors = [];
    
    if (scope1Total > 0) {
        data.push(scope1Total);
        labels.push('Scope 1');
        colors.push('#ff6b6b');
    }
    if (scope2Total > 0) {
        data.push(scope2Total);
        labels.push('Scope 2');
        colors.push('#4ecdc4');
    }
    if (scope3Total > 0) {
        data.push(scope3Total);
        labels.push('Scope 3');
        colors.push('#ffd93d');
    }
    
    emissionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                        font: { size: 11 },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percent = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value.toFixed(4)} tCO2eq (${percent}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
}

function createBarChart(ctx) {
    // 항목별 데이터 (상위 10개)
    const sortedList = [...emissionList].sort((a, b) => b.total - a.total).slice(0, 10);
    
    const labels = sortedList.map(i => i.name.length > 15 ? i.name.substring(0, 15) + '...' : i.name);
    const data = sortedList.map(i => i.total);
    const colors = sortedList.map(i => {
        if (i.scope === 'scope1') return '#ff6b6b';
        if (i.scope === 'scope2') return '#4ecdc4';
        return '#ffd93d';
    });
    
    emissionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.x.toFixed(4)} tCO2eq`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { 
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
                        font: { size: 10 }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { 
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function createLineChart(ctx) {
    // 항목 추가 순서대로 누적 배출량 표시
    const sortedList = [...emissionList].sort((a, b) => a.id - b.id);
    
    // Scope별 누적 데이터 계산
    let cumScope1 = 0, cumScope2 = 0, cumScope3 = 0;
    const scope1Data = [];
    const scope2Data = [];
    const scope3Data = [];
    const labels = [];
    
    sortedList.forEach((item, idx) => {
        if (item.scope === 'scope1') cumScope1 += item.total;
        else if (item.scope === 'scope2') cumScope2 += item.total;
        else cumScope3 += item.total;
        
        scope1Data.push(cumScope1);
        scope2Data.push(cumScope2);
        scope3Data.push(cumScope3);
        labels.push(`#${idx + 1}`);
    });
    
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
    const textSecondary = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    
    emissionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Scope 1',
                    data: scope1Data,
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Scope 2',
                    data: scope2Data,
                    borderColor: '#4ecdc4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Scope 3',
                    data: scope3Data,
                    borderColor: '#ffd93d',
                    backgroundColor: 'rgba(255, 217, 61, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: { size: 11 },
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const idx = context[0].dataIndex;
                            return sortedList[idx]?.name || `항목 ${idx + 1}`;
                        },
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(4)} tCO2eq (누적)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { 
                        color: textSecondary,
                        font: { size: 10 }
                    },
                    title: {
                        display: true,
                        text: '추가 순서',
                        color: textSecondary,
                        font: { size: 11 }
                    }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { 
                        color: textColor,
                        font: { size: 10 }
                    },
                    title: {
                        display: true,
                        text: '누적 배출량 (tCO2eq)',
                        color: textSecondary,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

// ===== Scope 3 =====
// 현재 선택된 교통 배출계수 기준
let currentTransportStandard = 'ESTIMATE';

function initScope3() {
    // 배출계수 기준 선택 이벤트
    document.querySelectorAll('input[name="transportStandard"]').forEach(radio => {
        radio.addEventListener('change', onTransportStandardChange);
    });
    
    // 탭 전환
    document.querySelectorAll('.scope3-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // 탭 활성화
            document.querySelectorAll('.scope3-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // 패널 전환
            document.getElementById('travelPanel').style.display = targetTab === 'travel' ? 'block' : 'none';
            document.getElementById('commutePanel').style.display = targetTab === 'commute' ? 'block' : 'none';
            document.getElementById('wastePanel').style.display = targetTab === 'waste' ? 'block' : 'none';
            document.getElementById('waterPanel').style.display = targetTab === 'water' ? 'block' : 'none';
            
            // 교통 배출계수 기준 선택 표시/숨김 (출장/통근만)
            const standardSelector = document.getElementById('transportStandardSelector');
            if (targetTab === 'travel' || targetTab === 'commute') {
                standardSelector.style.display = 'block';
            } else {
                standardSelector.style.display = 'none';
            }
        });
    });
    
    // 출장 이벤트
    document.getElementById('travelTransport').addEventListener('change', onTravelTransportChange);
    document.getElementById('travelDistance').addEventListener('input', calculateTravel);
    document.getElementById('travelPeople').addEventListener('input', calculateTravel);
    
    // 통근 이벤트
    document.getElementById('commuteTransport').addEventListener('change', onCommuteTransportChange);
    document.getElementById('commuteDistance').addEventListener('input', calculateCommute);
    document.getElementById('commuteWorkdays').addEventListener('input', calculateCommute);
    document.getElementById('commutePeople').addEventListener('input', calculateCommute);
    
    // 연료 기반 이벤트
    document.getElementById('fuelType').addEventListener('change', onFuelTypeChange);
    document.getElementById('fuelInputMethod').addEventListener('change', onFuelInputMethodChange);
    document.getElementById('fuelAmount').addEventListener('input', calculateFuelEmission);
    document.getElementById('fuelDistance').addEventListener('input', calculateFuelEmission);
    document.getElementById('fuelEfficiency').addEventListener('input', calculateFuelEmission);
    document.getElementById('addFuelBtn').addEventListener('click', addFuelToList);
    
    // 폐기물 이벤트
    document.getElementById('wasteType').addEventListener('change', onWasteTypeChange);
    document.getElementById('wasteAmount').addEventListener('input', calculateWaste);
    
    // 용수 이벤트
    document.getElementById('waterType').addEventListener('change', onWaterTypeChange);
    document.getElementById('waterAmount').addEventListener('input', calculateWater);
    
    // 추가 버튼
    document.getElementById('addTravelBtn').addEventListener('click', addTravelToList);
    document.getElementById('addCommuteBtn').addEventListener('click', addCommuteToList);
    document.getElementById('addWasteBtn').addEventListener('click', addWasteToList);
    document.getElementById('addWaterBtn').addEventListener('click', addWaterToList);
    
    // 초기 계산
    onTravelTransportChange();
    onCommuteTransportChange();
    onWasteTypeChange();
    onWaterTypeChange();
}

function onTravelTransportChange() {
    const transportId = document.getElementById('travelTransport').value;
    const data = getTransportEmissionFactor(transportId);
    
    if (data) {
        document.getElementById('travelCoef').textContent = data.co2;
        document.getElementById('travelCoefUnit').textContent = `kg/${data.unit}`;
        document.getElementById('travelNote').textContent = data.description + (data.source ? ` [${data.source}]` : '');
        
        // 인·km 단위는 탑승인원 필요, km 단위는 불필요
        const peopleGroup = document.getElementById('travelPeopleGroup');
        if (data.unit === '인·km') {
            peopleGroup.style.display = 'none';
            document.getElementById('travelPeople').value = 1;
        } else {
            peopleGroup.style.display = 'block';
        }
        
        document.getElementById('travelUnit').textContent = data.unit === '인·km' ? '인·km' : 'km';
    }
    
    calculateTravel();
}

// 배출계수 기준 변경 핸들러
function onTransportStandardChange() {
    const selected = document.querySelector('input[name="transportStandard"]:checked').value;
    currentTransportStandard = selected;
    
    // 설명 업데이트
    const noteEl = document.getElementById('standardNote');
    const descriptions = {
        'ESTIMATE': '⚠️ 공식 출처 미확인, 대략적 규모 파악용',
        'DEFRA': '✅ 영국 정부 공식 배출계수 (국제적으로 가장 많이 인용)',
        'FUEL_BASED': '📋 연료 기반 계산 - 에너지관리공단 공식 배출계수 (kg/TJ)'
    };
    noteEl.textContent = descriptions[selected] || '';
    
    // 연료 기반 선택 시 추가 UI 표시
    const fuelInputs = document.getElementById('fuelBasedInputs');
    const travelPanel = document.getElementById('travelPanel');
    const commutePanel = document.getElementById('commutePanel');
    
    if (selected === 'FUEL_BASED') {
        fuelInputs.classList.add('visible');
        // 출장/통근 탭의 교통수단 선택은 숨기고 연료 기반 UI만 표시
        calculateFuelEmission();
    } else {
        fuelInputs.classList.remove('visible');
    }
    
    // 경고 메시지 업데이트
    const warnings = document.querySelectorAll('.coef-warning');
    warnings.forEach(w => {
        if (selected === 'ESTIMATE') {
            w.textContent = '⚠️ 참고용 추정치 (공식 출처 미확인)';
            w.style.color = '#f0ad4e';
            w.style.background = 'rgba(240, 173, 78, 0.1)';
            w.style.borderColor = '#f0ad4e';
            w.style.display = 'block';
        } else if (selected === 'DEFRA') {
            w.textContent = '✅ UK DEFRA 2024 공식 배출계수';
            w.style.color = '#5cb85c';
            w.style.background = 'rgba(92, 184, 92, 0.1)';
            w.style.borderColor = '#5cb85c';
            w.style.display = 'block';
        } else {
            w.style.display = 'none';
        }
    });
    
    // 현재 선택된 교통수단의 배출계수 업데이트
    onTravelTransportChange();
    onCommuteTransportChange();
}

// 현재 기준에 맞는 배출계수 가져오기
function getTransportEmissionFactor(transportId) {
    if (currentTransportStandard === 'DEFRA') {
        return DEFRA_EMISSION_FACTORS[transportId] || TRANSPORT_EMISSION_FACTORS[transportId];
    }
    return TRANSPORT_EMISSION_FACTORS[transportId];
}

function calculateTravel() {
    const transportId = document.getElementById('travelTransport').value;
    const distance = parseFloat(document.getElementById('travelDistance').value) || 0;
    const people = parseFloat(document.getElementById('travelPeople').value) || 1;
    const data = getTransportEmissionFactor(transportId);
    
    if (!data) return;
    
    let totalKm = distance;
    if (data.unit === 'km') {
        // 승용차: 탑승인원 무관하게 총 km
        totalKm = distance;
    }
    // 인·km 단위는 이미 인당 거리이므로 그대로 사용
    
    const co2 = (totalKm * data.co2 * people) / 1000; // kg → t
    document.getElementById('travelTotal').textContent = co2.toFixed(4);
}

function onCommuteTransportChange() {
    const transportId = document.getElementById('commuteTransport').value;
    const data = getTransportEmissionFactor(transportId);
    
    if (data) {
        document.getElementById('commuteCoef').textContent = data.co2;
        document.getElementById('commuteCoefUnit').textContent = `kg/${data.unit}`;
        document.getElementById('commuteNote').textContent = data.description + (data.source ? ` [${data.source}]` : '');
    }
    
    calculateCommute();
}

function calculateCommute() {
    const transportId = document.getElementById('commuteTransport').value;
    const distance = parseFloat(document.getElementById('commuteDistance').value) || 0;
    const workdays = parseFloat(document.getElementById('commuteWorkdays').value) || 250;
    const people = parseFloat(document.getElementById('commutePeople').value) || 1;
    const data = getTransportEmissionFactor(transportId);
    
    if (!data) return;
    
    // 편도 × 2 (왕복) × 연간 출근일수 × 인원
    const totalKm = distance * 2 * workdays;
    const co2 = (totalKm * data.co2 * people) / 1000; // kg → t
    
    document.getElementById('commuteTotal').textContent = co2.toFixed(4);
}

function addTravelToList() {
    const transportId = document.getElementById('travelTransport').value;
    const data = getTransportEmissionFactor(transportId);
    const distance = document.getElementById('travelDistance').value;
    const people = document.getElementById('travelPeople').value;
    const total = parseFloat(document.getElementById('travelTotal').textContent) || 0;
    
    // 현재 기준 정보
    const standardInfo = EMISSION_FACTOR_STANDARDS[currentTransportStandard];
    
    const item = {
        id: ++itemIdCounter,
        scope: 'scope3',
        icon: '✈️',
        name: `출장: ${data.name}`,
        detail: `${distance}km × ${people}명`,
        co2: total,
        ch4: 0,
        n2o: 0,
        total: total,
        co2Str: total.toFixed(4),
        ch4Str: '0',
        n2oStr: '0',
        totalStr: total.toFixed(4),
        // 상세 정보
        category: 'travel',
        transportId: transportId,
        transportName: data.name,
        distance: distance,
        people: people,
        coef: data.co2,
        emissionStandard: currentTransportStandard,
        emissionStandardName: standardInfo?.shortName || '추정치',
        source: data.source || '추정'
    };
    
    emissionList.push(item);
    renderList();
    updateTotals();
}

function addCommuteToList() {
    const transportId = document.getElementById('commuteTransport').value;
    const data = getTransportEmissionFactor(transportId);
    const distance = document.getElementById('commuteDistance').value;
    const workdays = document.getElementById('commuteWorkdays').value;
    const people = document.getElementById('commutePeople').value;
    const total = parseFloat(document.getElementById('commuteTotal').textContent) || 0;
    
    // 현재 기준 정보
    const standardInfo = EMISSION_FACTOR_STANDARDS[currentTransportStandard];
    
    const item = {
        id: ++itemIdCounter,
        scope: 'scope3',
        icon: '🚌',
        name: `통근: ${data.name}`,
        detail: `${distance}km(왕복) × ${workdays}일 × ${people}명`,
        co2: total,
        ch4: 0,
        n2o: 0,
        total: total,
        co2Str: total.toFixed(4),
        ch4Str: '0',
        n2oStr: '0',
        totalStr: total.toFixed(4),
        // 상세 정보
        category: 'commute',
        transportId: transportId,
        transportName: data.name,
        distance: distance,
        workdays: workdays,
        people: people,
        coef: data.co2,
        emissionStandard: currentTransportStandard,
        emissionStandardName: standardInfo?.shortName || '추정치',
        source: data.source || '추정'
    };
    
    emissionList.push(item);
    renderList();
    updateTotals();
}

// ===== 연료 기반 계산 =====
function onFuelTypeChange() {
    const fuelType = document.getElementById('fuelType').value;
    const data = FUEL_BASED_EMISSION_FACTORS[fuelType];
    
    if (data) {
        document.getElementById('fuelUnit').textContent = data.unit;
        // 기본 연비 업데이트
        document.getElementById('fuelEfficiency').value = DEFAULT_FUEL_EFFICIENCY[fuelType] || 12.5;
    }
    
    calculateFuelEmission();
}

function onFuelInputMethodChange() {
    const method = document.getElementById('fuelInputMethod').value;
    const directInput = document.getElementById('fuelDirectInput');
    const distanceInput = document.getElementById('fuelDistanceInput');
    
    if (method === 'fuel') {
        directInput.style.display = 'flex';
        distanceInput.style.display = 'none';
    } else {
        directInput.style.display = 'none';
        distanceInput.style.display = 'flex';
    }
    
    calculateFuelEmission();
}

function calculateFuelEmission() {
    const fuelType = document.getElementById('fuelType').value;
    const inputMethod = document.getElementById('fuelInputMethod').value;
    const data = FUEL_BASED_EMISSION_FACTORS[fuelType];
    
    if (!data) return;
    
    let fuelAmount = 0;
    
    if (inputMethod === 'fuel') {
        fuelAmount = parseFloat(document.getElementById('fuelAmount').value) || 0;
    } else {
        const distance = parseFloat(document.getElementById('fuelDistance').value) || 0;
        const efficiency = parseFloat(document.getElementById('fuelEfficiency').value) || 1;
        fuelAmount = distance / efficiency;  // 거리 / 연비 = 연료량
    }
    
    // 에너지량 계산 (TJ)
    const energyTJ = fuelAmount * data.netHeatValue * 1e-6;  // MJ → TJ
    
    // 배출량 계산 (kg)
    const co2 = energyTJ * data.co2;
    const ch4 = energyTJ * data.ch4;
    const n2o = energyTJ * data.n2o;
    
    // GWP 적용
    const gwp = GWP_OPTIONS[document.getElementById('gwpStandard')?.value || '국가_인벤토리_SAR'];
    const ch4GWP = gwp?.ch4 || 21;
    const n2oGWP = gwp?.n2o || 310;
    
    // tCO2eq 계산
    const totalCO2eq = (co2 + ch4 * ch4GWP + n2o * n2oGWP) / 1000;  // kg → t
    
    // UI 업데이트
    document.getElementById('fuelCO2').textContent = co2.toFixed(2);
    document.getElementById('fuelCH4').textContent = ch4.toFixed(4);
    document.getElementById('fuelN2O').textContent = n2o.toFixed(4);
    document.getElementById('fuelTotal').textContent = totalCO2eq.toFixed(4);
}

function addFuelToList() {
    const fuelType = document.getElementById('fuelType').value;
    const inputMethod = document.getElementById('fuelInputMethod').value;
    const data = FUEL_BASED_EMISSION_FACTORS[fuelType];
    
    if (!data) return;
    
    let fuelAmount = 0;
    let detail = '';
    
    if (inputMethod === 'fuel') {
        fuelAmount = parseFloat(document.getElementById('fuelAmount').value) || 0;
        detail = `${fuelAmount} ${data.unit}`;
    } else {
        const distance = parseFloat(document.getElementById('fuelDistance').value) || 0;
        const efficiency = parseFloat(document.getElementById('fuelEfficiency').value) || 1;
        fuelAmount = distance / efficiency;
        detail = `${distance}km (연비: ${efficiency}km/${data.unit})`;
    }
    
    // 계산
    const energyTJ = fuelAmount * data.netHeatValue * 1e-6;
    const co2 = energyTJ * data.co2 / 1000;  // t
    const ch4 = energyTJ * data.ch4 / 1000;  // t
    const n2o = energyTJ * data.n2o / 1000;  // t
    
    const gwp = GWP_OPTIONS[document.getElementById('gwpStandard')?.value || '국가_인벤토리_SAR'];
    const total = co2 + ch4 * (gwp?.ch4 || 21) + n2o * (gwp?.n2o || 310);
    
    const item = {
        id: ++itemIdCounter,
        scope: 'scope3',
        icon: '⛽',
        name: `연료: ${data.name}`,
        detail: detail,
        co2: co2,
        ch4: ch4,
        n2o: n2o,
        total: total,
        co2Str: co2.toFixed(4),
        ch4Str: ch4.toFixed(6),
        n2oStr: n2o.toFixed(6),
        totalStr: total.toFixed(4),
        // 상세 정보
        category: 'fuel',
        fuelType: fuelType,
        fuelName: data.name,
        fuelAmount: fuelAmount,
        fuelUnit: data.unit,
        energyTJ: energyTJ,
        emissionStandard: 'FUEL_BASED',
        emissionStandardName: '연료기반',
        source: data.source
    };
    
    emissionList.push(item);
    renderList();
    updateTotals();
}

// ===== 폐기물 =====
function onWasteTypeChange() {
    const wasteId = document.getElementById('wasteType').value;
    const data = WASTE_EMISSION_FACTORS[wasteId];
    
    if (data) {
        document.getElementById('wasteCoef').textContent = data.co2;
        document.getElementById('wasteNote').textContent = data.description;
    }
    
    calculateWaste();
}

function calculateWaste() {
    const wasteId = document.getElementById('wasteType').value;
    const amount = parseFloat(document.getElementById('wasteAmount').value) || 0;
    const data = WASTE_EMISSION_FACTORS[wasteId];
    
    if (!data) return;
    
    const co2 = (amount * data.co2) / 1000; // kg → t
    document.getElementById('wasteTotal').textContent = co2.toFixed(4);
}

function addWasteToList() {
    const wasteId = document.getElementById('wasteType').value;
    const data = WASTE_EMISSION_FACTORS[wasteId];
    const amount = document.getElementById('wasteAmount').value;
    const total = parseFloat(document.getElementById('wasteTotal').textContent) || 0;
    
    const item = {
        id: ++itemIdCounter,
        scope: 'scope3',
        icon: '🗑️',
        name: `폐기물: ${data.name}`,
        detail: `${amount} ton`,
        co2: total,
        ch4: 0,
        n2o: 0,
        total: total,
        co2Str: total.toFixed(4),
        ch4Str: '0',
        n2oStr: '0',
        totalStr: total.toFixed(4),
        // 상세 정보
        category: 'waste',
        wasteId: wasteId,
        wasteName: data.name,
        amount: amount,
        coef: data.co2
    };
    
    emissionList.push(item);
    renderList();
    updateTotals();
}

// ===== 용수 =====
function onWaterTypeChange() {
    const waterId = document.getElementById('waterType').value;
    const data = WATER_EMISSION_FACTORS[waterId];
    
    if (data) {
        document.getElementById('waterCoef').textContent = data.co2;
        document.getElementById('waterNote').textContent = data.description;
    }
    
    calculateWater();
}

function calculateWater() {
    const waterId = document.getElementById('waterType').value;
    const amount = parseFloat(document.getElementById('waterAmount').value) || 0;
    const data = WATER_EMISSION_FACTORS[waterId];
    
    if (!data) return;
    
    const co2 = (amount * data.co2) / 1000; // kg → t
    document.getElementById('waterTotal').textContent = co2.toFixed(4);
}

function addWaterToList() {
    const waterId = document.getElementById('waterType').value;
    const data = WATER_EMISSION_FACTORS[waterId];
    const amount = document.getElementById('waterAmount').value;
    const total = parseFloat(document.getElementById('waterTotal').textContent) || 0;
    
    const item = {
        id: ++itemIdCounter,
        scope: 'scope3',
        icon: '💧',
        name: `용수: ${data.name}`,
        detail: `${amount} m³`,
        co2: total,
        ch4: 0,
        n2o: 0,
        total: total,
        co2Str: total.toFixed(4),
        ch4Str: '0',
        n2oStr: '0',
        totalStr: total.toFixed(4),
        // 상세 정보
        category: 'water',
        waterId: waterId,
        waterName: data.name,
        amount: amount,
        coef: data.co2
    };
    
    emissionList.push(item);
    renderList();
    updateTotals();
}

// ===== 저장/불러오기 =====
const STORAGE_KEY = 'ghg_calculator_data';

function initStorage() {
    // 파일 저장/불러오기 버튼 이벤트
    document.getElementById('saveFileBtn')?.addEventListener('click', saveToFile);
    document.getElementById('loadFileBtn')?.addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput')?.addEventListener('change', loadFromFile);
}

// localStorage 자동 저장
function saveToLocalStorage() {
    const data = {
        version: '2.6',
        savedAt: new Date().toISOString(),
        itemIdCounter: itemIdCounter,
        emissionList: emissionList,
        settings: {
            buildingType: document.getElementById('buildingType')?.value,
            emissionYear: document.getElementById('emissionYear')?.value,
            heatYear: document.getElementById('heatYear')?.value,
            gwpStandard: document.getElementById('gwpStandard')?.value
        },
        buildingInfo: {
            category: document.getElementById('buildingCategory')?.value,
            area: document.getElementById('buildingArea')?.value,
            occupants: document.getElementById('buildingOccupants')?.value,
            renewable: document.getElementById('renewableEnergy')?.value
        }
    };
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        showToast('💾 자동 저장됨');
    } catch (e) {
        console.error('저장 실패:', e);
    }
}

// localStorage에서 불러오기
function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        
        const data = JSON.parse(saved);
        
        // 데이터 복원
        if (data.emissionList && data.emissionList.length > 0) {
            emissionList = data.emissionList;
            itemIdCounter = data.itemIdCounter || emissionList.length;
            
            // 설정 복원
            if (data.settings) {
                if (data.settings.buildingType) {
                    document.getElementById('buildingType').value = data.settings.buildingType;
                }
                if (data.settings.emissionYear) {
                    document.getElementById('emissionYear').value = data.settings.emissionYear;
                }
                if (data.settings.heatYear) {
                    document.getElementById('heatYear').value = data.settings.heatYear;
                }
                if (data.settings.gwpStandard) {
                    document.getElementById('gwpStandard').value = data.settings.gwpStandard;
                    onGWPChange();
                }
            }
            
            // 건물 정보 복원
            if (data.buildingInfo) {
                if (data.buildingInfo.category) {
                    document.getElementById('buildingCategory').value = data.buildingInfo.category;
                }
                if (data.buildingInfo.area) {
                    document.getElementById('buildingArea').value = data.buildingInfo.area;
                }
                if (data.buildingInfo.occupants) {
                    document.getElementById('buildingOccupants').value = data.buildingInfo.occupants;
                }
                if (data.buildingInfo.renewable) {
                    document.getElementById('renewableEnergy').value = data.buildingInfo.renewable;
                }
            }
            
            renderList();
            updateTotals();
            showToast(`📂 이전 데이터 불러옴 (${emissionList.length}개)`);
        }
    } catch (e) {
        console.error('불러오기 실패:', e);
    }
}

// JSON 파일로 내보내기
function saveToFile() {
    if (emissionList.length === 0) {
        alert('저장할 데이터가 없습니다.');
        return;
    }
    
    const data = {
        version: '2.6',
        savedAt: new Date().toISOString(),
        itemIdCounter: itemIdCounter,
        emissionList: emissionList,
        settings: {
            buildingType: document.getElementById('buildingType')?.value,
            emissionYear: document.getElementById('emissionYear')?.value,
            heatYear: document.getElementById('heatYear')?.value,
            gwpStandard: document.getElementById('gwpStandard')?.value
        }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `GHG_데이터_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    
    showToast('📥 파일 저장 완료');
}

// JSON 파일에서 불러오기
function loadFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!data.emissionList) {
                throw new Error('올바른 GHG 데이터 파일이 아닙니다.');
            }
            
            // 기존 데이터 초기화 여부 확인
            if (emissionList.length > 0) {
                if (!confirm('기존 데이터를 덮어쓰시겠습니까?\n(취소하면 기존 데이터에 추가됩니다)')) {
                    // 추가 모드
                    const maxId = Math.max(...emissionList.map(i => i.id), 0);
                    data.emissionList.forEach(item => {
                        item.id = maxId + item.id;
                        emissionList.push(item);
                    });
                    itemIdCounter = Math.max(...emissionList.map(i => i.id));
                } else {
                    // 덮어쓰기 모드
                    emissionList = data.emissionList;
                    itemIdCounter = data.itemIdCounter || emissionList.length;
                }
            } else {
                emissionList = data.emissionList;
                itemIdCounter = data.itemIdCounter || emissionList.length;
            }
            
            // 설정 복원
            if (data.settings) {
                if (data.settings.buildingType) {
                    document.getElementById('buildingType').value = data.settings.buildingType;
                }
                if (data.settings.emissionYear) {
                    document.getElementById('emissionYear').value = data.settings.emissionYear;
                }
                if (data.settings.heatYear) {
                    document.getElementById('heatYear').value = data.settings.heatYear;
                }
                if (data.settings.gwpStandard) {
                    document.getElementById('gwpStandard').value = data.settings.gwpStandard;
                    onGWPChange();
                }
            }
            
            renderList();
            updateTotals();
            saveToLocalStorage();
            
            showToast(`📂 ${data.emissionList.length}개 항목 불러옴`);
        } catch (err) {
            alert('파일 읽기 실패: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// 토스트 메시지
function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ===== 도움말 & 참고값 기능 =====

// 도움말 초기화
function initHelpSystem() {
    // 도움말 버튼 이벤트
    document.querySelectorAll('.help-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const helpType = btn.dataset.help;
            toggleHelpPanel(helpType);
        });
    });
    
    // 참고값 표시 버튼
    const showRefBtn = document.getElementById('showReferenceBtn');
    const closeRefBtn = document.getElementById('closeReferenceBtn');
    const refPanel = document.getElementById('referencePanel');
    
    if (showRefBtn) {
        showRefBtn.addEventListener('click', () => {
            refPanel.style.display = refPanel.style.display === 'none' ? 'block' : 'none';
            updateReferencePanel();
        });
    }
    
    if (closeRefBtn) {
        closeRefBtn.addEventListener('click', () => {
            refPanel.style.display = 'none';
        });
    }
    
    // 건물 유형 변경 시 참고값 업데이트
    const buildingCategory = document.getElementById('buildingCategory');
    if (buildingCategory) {
        buildingCategory.addEventListener('change', updateReferencePanel);
    }
    
    // Scope 2 사용량 입력 검증
    const scope2Usage = document.getElementById('scope2Usage');
    if (scope2Usage) {
        scope2Usage.addEventListener('input', validateScope2Input);
        scope2Usage.addEventListener('change', validateScope2Input);
    }
}

// 도움말 패널 토글
function toggleHelpPanel(helpType) {
    const panel = document.getElementById(`helpPanel_${helpType}`);
    if (!panel) return;
    
    // 다른 패널 닫기
    document.querySelectorAll('.help-panel').forEach(p => {
        if (p.id !== `helpPanel_${helpType}`) {
            p.style.display = 'none';
        }
    });
    
    // 현재 패널 토글
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// 참고값 패널 업데이트
function updateReferencePanel() {
    const buildingCategory = document.getElementById('buildingCategory')?.value || 'office';
    const refData = ENERGY_REFERENCE[buildingCategory];
    
    if (!refData) return;
    
    // 건물 유형 이름
    const typeSpan = document.getElementById('referenceBuildingType');
    if (typeSpan) typeSpan.textContent = refData.name;
    
    // 전기 참고값
    const elecValue = document.getElementById('refElectricity');
    const elecTypical = document.getElementById('refElecTypical');
    if (elecValue && refData.electricity) {
        elecValue.textContent = `${refData.electricity.min}~${refData.electricity.max} ${refData.electricity.unit}`;
    }
    if (elecTypical && refData.electricity) {
        elecTypical.textContent = refData.electricity.typical;
    }
    
    // 가스 참고값
    const gasValue = document.getElementById('refGas');
    const gasTypical = document.getElementById('refGasTypical');
    if (gasValue && refData.gas) {
        gasValue.textContent = `${refData.gas.min}~${refData.gas.max} ${refData.gas.unit}`;
    }
    if (gasTypical && refData.gas) {
        gasTypical.textContent = refData.gas.typical;
    }
    
    // 설명
    const descSpan = document.getElementById('refDescription');
    if (descSpan) descSpan.textContent = refData.description;
}

// Scope 2 입력값 검증
function validateScope2Input() {
    const usage = parseFloat(document.getElementById('scope2Usage')?.value) || 0;
    const unit = document.getElementById('scope2Unit')?.value || 'MWh';
    const source = document.getElementById('scope2Source')?.value || '';
    const area = parseFloat(document.getElementById('buildingArea')?.value) || 0;
    
    const warningDiv = document.getElementById('scope2Warning');
    const warningText = document.getElementById('scope2WarningText');
    const input = document.getElementById('scope2Usage');
    
    if (!warningDiv || !warningText || !input) return;
    
    // 면적 정보가 없으면 검증 스킵
    if (!area || area <= 0) {
        warningDiv.style.display = 'none';
        input.classList.remove('warning-state', 'error-state');
        return;
    }
    
    // 전기인 경우만 검증
    if (!source.startsWith('전기')) {
        warningDiv.style.display = 'none';
        input.classList.remove('warning-state', 'error-state');
        return;
    }
    
    // MWh를 kWh로 변환
    const usageKWh = unit === 'MWh' ? usage * 1000 : usage * 277778; // TJ → kWh
    const perArea = usageKWh / area;
    
    const buildingCategory = document.getElementById('buildingCategory')?.value || 'office';
    const refData = ENERGY_REFERENCE[buildingCategory];
    
    if (!refData || !refData.electricity) {
        warningDiv.style.display = 'none';
        input.classList.remove('warning-state', 'error-state');
        return;
    }
    
    const { min, max, typical } = refData.electricity;
    
    // 검증
    if (perArea < min * 0.3 || perArea > max * 2) {
        // 에러 수준 (너무 작거나 너무 큼)
        warningDiv.style.display = 'flex';
        warningDiv.classList.add('error');
        warningText.textContent = `면적당 ${Math.round(perArea)} kWh/m² - ${refData.name} 기준(${min}~${max})에서 크게 벗어남`;
        input.classList.remove('warning-state');
        input.classList.add('error-state');
    } else if (perArea < min * 0.7 || perArea > max * 1.3) {
        // 경고 수준
        warningDiv.style.display = 'flex';
        warningDiv.classList.remove('error');
        warningText.textContent = `면적당 ${Math.round(perArea)} kWh/m² - ${refData.name} 일반값(${typical})과 차이 있음`;
        input.classList.remove('error-state');
        input.classList.add('warning-state');
    } else {
        // 정상 범위
        warningDiv.style.display = 'none';
        input.classList.remove('warning-state', 'error-state');
    }
}

// 건물정보 변경 시 참고값과 검증 업데이트
function onBuildingInfoChangeExtended() {
    updateReferencePanel();
    validateScope2Input();
}
