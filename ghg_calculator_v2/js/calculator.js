/**
 * ===============================================
 * 온실가스 계산기 v2.6 - 계산 엔진
 * ===============================================
 * 
 * 계산 공식 (IPCC 2006 GL 기반):
 * 
 * [Scope 1 - 직접배출]
 * 배출량[tGHG] = 연료사용량 × 열량계수 × 배출계수 × 산화계수 × 10^-6
 * 
 * [Scope 2 - 간접배출]
 * 전기: 배출량[tGHG] = 전기사용량[MWh] × 배출계수[kgGHG/MWh] × 10^-3
 * 열: 배출량[tGHG] = 열사용량[TJ] × 배출계수[kgGHG/TJ] × 10^-3
 * 
 * [CO2eq 환산]
 * CO2eq = CO2×1 + CH4×21 + N2O×310
 */

const GHGCalculator = {
    /**
     * 시설규모 판정
     * @param {number} annualEmission - 연간 GHG 배출량 (만톤/년)
     * @returns {string} - 시설규모 (A/B/C/D/E)
     */
    getFacilitySize(annualEmission) {
        for (const threshold of GHG_DATA.FACILITY_SIZE_THRESHOLDS) {
            if (annualEmission < threshold.max) {
                return threshold.size;
            }
        }
        return "A";
    },

    /**
     * 최소 Tier 기준 조회
     * @param {string} facilitySize - 시설규모
     * @returns {object} - { heat, emission, oxidation }
     */
    getMinTier(facilitySize) {
        return GHG_DATA.MIN_TIER[facilitySize] || GHG_DATA.MIN_TIER["E"];
    },

    /**
     * 연료 데이터 조회
     * @param {string} fuelName - 연료명
     * @returns {object|null} - 연료 데이터
     */
    getFuelData(fuelName) {
        return GHG_DATA.FUELS[fuelName] || null;
    },

    /**
     * 열량계수 조회
     * @param {string} fuelName - 연료명
     * @param {string} tier - T1/T2/T3
     * @param {string} year - 국가고유(17년)/국가고유(22년)
     * @param {number} customValue - T3일 경우 직접입력값
     * @returns {number} - 열량계수 (MJ/단위)
     */
    getCalorificValue(fuelName, tier, year = "국가고유(22년)", customValue = 0) {
        const fuel = this.getFuelData(fuelName);
        if (!fuel) return 0;

        if (tier === "T1") {
            return fuel.calorific.T1;
        } else if (tier === "T2") {
            return year === "국가고유(17년)" ? fuel.calorific.T2_17 : fuel.calorific.T2_22;
        } else if (tier === "T3") {
            return customValue || 0;
        }
        return 0;
    },

    /**
     * CO2 배출계수 조회
     * @param {string} fuelName - 연료명
     * @param {string} tier - T1/T2/T3
     * @param {string} year - 국가고유(17년)/국가고유(22년)
     * @param {number} customValue - T3일 경우 직접입력값
     * @returns {number} - 배출계수 (kgCO2/TJ)
     */
    getEmissionFactorCO2(fuelName, tier, year = "국가고유(22년)", customValue = 0) {
        const fuel = this.getFuelData(fuelName);
        if (!fuel) return 0;

        if (tier === "T1") {
            return fuel.emission_CO2.T1;
        } else if (tier === "T2") {
            return year === "국가고유(17년)" ? fuel.emission_CO2.T2_17 : fuel.emission_CO2.T2_22;
        } else if (tier === "T3") {
            return customValue || 0;
        }
        return 0;
    },

    /**
     * CH4 배출계수 조회
     * @param {string} fuelName - 연료명
     * @param {string} tier - T1/T2/T3
     * @param {string} buildingType - 주거용/상업용,공공
     * @param {number} customValue - T3일 경우 직접입력값
     * @returns {number} - 배출계수 (kgCH4/TJ)
     */
    getEmissionFactorCH4(fuelName, tier, buildingType = "주거용", customValue = 0) {
        const fuel = this.getFuelData(fuelName);
        if (!fuel) return 0;

        if (tier === "T1") {
            return fuel.emission_CH4.T1;
        } else if (tier === "T2") {
            // 석탄류는 주거용/상업용 구분
            if (fuel.category === "석탄류" && fuel.emission_CH4.T2_residential !== undefined) {
                return buildingType === "주거용" 
                    ? fuel.emission_CH4.T2_residential 
                    : fuel.emission_CH4.T2_commercial;
            }
            return fuel.emission_CH4.T2;
        } else if (tier === "T3") {
            return customValue || 0;
        }
        return 0;
    },

    /**
     * N2O 배출계수 조회
     * @param {string} fuelName - 연료명
     * @param {string} tier - T1/T2/T3
     * @param {number} customValue - T3일 경우 직접입력값
     * @returns {number} - 배출계수 (kgN2O/TJ)
     */
    getEmissionFactorN2O(fuelName, tier, customValue = 0) {
        const fuel = this.getFuelData(fuelName);
        if (!fuel) return 0;

        if (tier === "T1") {
            return fuel.emission_N2O.T1;
        } else if (tier === "T2") {
            return fuel.emission_N2O.T2;
        } else if (tier === "T3") {
            return customValue || 0;
        }
        return 0;
    },

    /**
     * 산화계수 조회
     * @param {string} fuelName - 연료명
     * @param {string} tier - T1/T2/T3
     * @param {number} customValue - T3일 경우 직접입력값
     * @returns {number} - 산화계수
     */
    getOxidationFactor(fuelName, tier, customValue = 1) {
        const fuel = this.getFuelData(fuelName);
        if (!fuel) return 1;

        if (tier === "T1") {
            return 1; // IPCC 기본값
        } else if (tier === "T2") {
            return GHG_DATA.OXIDATION_FACTORS[fuel.category] || 1;
        } else if (tier === "T3") {
            return customValue || 1;
        }
        return 1;
    },

    /**
     * Scope 1 배출량 계산 (연료 연소)
     * 
     * 공식: 배출량[tGHG] = 사용량 × 열량계수 × 배출계수 × 산화계수 × 10^-6
     * 
     * @param {object} params
     * @param {string} params.fuelName - 연료명
     * @param {number} params.usage - 연료 사용량
     * @param {string} params.unit - 단위 (ton, kL, 천m3, MWh)
     * @param {string} params.buildingType - 주거용/상업용,공공
     * @param {string} params.heatTier - 열량계수 Tier
     * @param {string} params.emissionTier - 배출계수 Tier
     * @param {string} params.oxidationTier - 산화계수 Tier
     * @param {string} params.emissionYear - 배출계수 기준년도
     * @param {string} params.heatYear - 열량계수 기준년도
     * @param {object} params.customValues - T3 직접입력값들
     * @returns {object} - { CO2, CH4, N2O, CO2eq, CH4eq, N2Oeq, total }
     */
    calculateScope1(params) {
        const {
            fuelName,
            usage,
            buildingType = "주거용",
            heatTier = "T2",
            emissionTier = "T2",
            oxidationTier = "T2",
            emissionYear = "국가고유(22년)",
            heatYear = "국가고유(22년)",
            customValues = {}
        } = params;

        // 연료 데이터 확인
        const fuel = this.getFuelData(fuelName);
        if (!fuel || !usage) {
            return { CO2: 0, CH4: 0, N2O: 0, CO2eq: 0, CH4eq: 0, N2Oeq: 0, total: 0 };
        }

        // 매개변수 조회
        const calorific = this.getCalorificValue(fuelName, heatTier, heatYear, customValues.heat);
        const efCO2 = this.getEmissionFactorCO2(fuelName, emissionTier, emissionYear, customValues.CO2);
        const efCH4 = this.getEmissionFactorCH4(fuelName, emissionTier, buildingType, customValues.CH4);
        const efN2O = this.getEmissionFactorN2O(fuelName, emissionTier, customValues.N2O);
        const oxidation = this.getOxidationFactor(fuelName, oxidationTier, customValues.oxidation);

        // TJ 환산
        // 열량계수 단위: MJ/단위 → TJ 변환: × 10^-6
        const energyTJ = usage * calorific * 1e-6;

        // 배출량 계산 (kgGHG → tGHG: × 10^-3)
        // 전체 공식: 사용량 × 열량계수 × 배출계수 × 산화계수 × 10^-6
        // = (사용량 × 열량계수 × 10^-6 [TJ]) × 배출계수[kgGHG/TJ] × 산화계수 × 10^-3 [tGHG]
        const CO2 = energyTJ * efCO2 * oxidation * 1e-3;
        const CH4 = energyTJ * efCH4 * oxidation * 1e-3;
        const N2O = energyTJ * efN2O * oxidation * 1e-3;

        // CO2eq 환산
        const CO2eq = CO2 * GHG_DATA.GWP.CO2;
        const CH4eq = CH4 * GHG_DATA.GWP.CH4;
        const N2Oeq = N2O * GHG_DATA.GWP.N2O;
        const total = CO2eq + CH4eq + N2Oeq;

        return {
            CO2: CO2,
            CH4: CH4,
            N2O: N2O,
            CO2eq: CO2eq,
            CH4eq: CH4eq,
            N2Oeq: N2Oeq,
            total: total,
            // 디버그용
            debug: {
                calorific,
                efCO2,
                efCH4,
                efN2O,
                oxidation,
                energyTJ
            }
        };
    },

    /**
     * Scope 2 배출량 계산 (외부 공급 전기/열)
     * 
     * 전기: 배출량[tGHG] = 사용량[MWh] × 배출계수[kgGHG/MWh] × 10^-3
     * 열: 배출량[tGHG] = 사용량[TJ] × 배출계수[kgGHG/TJ] × 10^-3
     * 
     * @param {object} params
     * @param {string} params.source - 에너지원 (전기, 열전용, 열병합, 열평균, 지역난방)
     * @param {number} params.usage - 사용량
     * @param {string} params.unit - 단위 (MWh, TJ)
     * @param {string} params.region - 지역난방 지역 (지역난방일 경우)
     * @param {string} params.period - 계획기간 (3기/4기)
     * @returns {object} - { CO2, CH4, N2O, CO2eq, CH4eq, N2Oeq, total }
     */
    calculateScope2(params) {
        const {
            source,
            usage,
            unit = "MWh",
            region = "수도권지사",
            period = "4기"
        } = params;

        if (!usage) {
            return { CO2: 0, CH4: 0, N2O: 0, CO2eq: 0, CH4eq: 0, N2Oeq: 0, total: 0 };
        }

        let efCO2, efCH4, efN2O;
        let conversionFactor = 1e-3; // kg → t

        // 지역난방인 경우
        if (source === "지역난방") {
            const districtData = GHG_DATA.DISTRICT_HEATING[period]?.[region];
            if (!districtData) {
                return { CO2: 0, CH4: 0, N2O: 0, CO2eq: 0, CH4eq: 0, N2Oeq: 0, total: 0 };
            }
            efCO2 = districtData.CO2;
            efCH4 = districtData.CH4;
            efN2O = districtData.N2O;

            // 지역난방 배출계수는 kgGHG/TJ
            // TJ 단위로 변환 필요
            let usageTJ = usage;
            if (unit === "MWh") {
                usageTJ = usage * 0.0036; // 1 MWh = 0.0036 TJ
            }

            const CO2 = usageTJ * efCO2 * 1e-3;
            const CH4 = usageTJ * efCH4 * 1e-3;
            const N2O = usageTJ * efN2O * 1e-3;

            const CO2eq = CO2 * GHG_DATA.GWP.CO2;
            const CH4eq = CH4 * GHG_DATA.GWP.CH4;
            const N2Oeq = N2O * GHG_DATA.GWP.N2O;

            return {
                CO2, CH4, N2O,
                CO2eq, CH4eq, N2Oeq,
                total: CO2eq + CH4eq + N2Oeq
            };
        }

        // 전기/열(스팀) 배출계수 조회
        const sourceData = GHG_DATA.SCOPE2[source];
        if (!sourceData) {
            return { CO2: 0, CH4: 0, N2O: 0, CO2eq: 0, CH4eq: 0, N2Oeq: 0, total: 0 };
        }

        efCO2 = sourceData.CO2;
        efCH4 = sourceData.CH4;
        efN2O = sourceData.N2O;

        // 열(스팀)의 경우 TJ 단위로 변환
        let usageConverted = usage;
        if (sourceData.unit === "TJ") {
            // 배출계수가 kgGHG/TJ 단위
            if (unit === "MWh") {
                usageConverted = usage * 0.0036; // 1 MWh = 0.0036 TJ
            }
        }

        const CO2 = usageConverted * efCO2 * 1e-3;
        const CH4 = usageConverted * efCH4 * 1e-3;
        const N2O = usageConverted * efN2O * 1e-3;

        const CO2eq = CO2 * GHG_DATA.GWP.CO2;
        const CH4eq = CH4 * GHG_DATA.GWP.CH4;
        const N2Oeq = N2O * GHG_DATA.GWP.N2O;

        return {
            CO2, CH4, N2O,
            CO2eq, CH4eq, N2Oeq,
            total: CO2eq + CH4eq + N2Oeq
        };
    },

    /**
     * 숫자 포맷팅 (소수점 + 천단위 구분)
     * @param {number} value - 숫자
     * @param {number} decimals - 소수점 자릿수
     * @returns {string}
     */
    formatNumber(value, decimals = 4) {
        if (value === 0) return "0";
        if (Math.abs(value) < 0.0001) {
            return value.toExponential(2);
        }
        return value.toLocaleString('ko-KR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        });
    }
};

// 모듈 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GHGCalculator;
}

