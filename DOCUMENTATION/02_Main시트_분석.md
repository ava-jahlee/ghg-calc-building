# Main 시트 상세 분석

## 📐 시트 구조
- 크기: 43행 × 17열
- 병합된 셀: 16개

### 병합된 셀 목록
```
F32:F36, F21:F22, P9:Q10, B18:B23, E4:E5
B32:B36, G13:G15, B11:B12, B13:B17, E6:E7
```

---

## 🎯 셀 맵핑 (사용자 입력 영역)

### 기본 설정
| 셀 | 내용 | 타입 | 기본값 |
|----|------|------|--------|
| F3 | 분야 | 고정값 | "1A. 에너지" |
| G3 | 부문 | 고정값 | "1A4. 기타" |
| H3 | 세부 | 드롭다운 | "주거용" / "상업용/공공" |
| G5 | 연간 GHG 배출량 | 숫자 입력 | 1 (만ton/yr) |
| F5 | 시설규모 | 자동계산 | "A" / "B" / "C" |
| F7 | 배출계수 기준년도 | 드롭다운 | "국가고유(17년)" / "국가고유(22년)" |
| G7 | 열량계수 기준년도 | 드롭다운 | "국가고유(17년)" / "국가고유(22년)" |

### Scope 1 입력
| 셀 | 내용 | 타입 | 설명 |
|----|------|------|------|
| C12 | 연료 | 드롭다운 | 연료 종류 선택 |
| D12 | GHG 종류 | 드롭다운 | CO2 / CH4 / N2O |
| E12 | 연료 상태 | 드롭다운/자동 | Default / 고체 / 액체 / 기체 |
| F12 | 연료 사용량 | 숫자 입력 | 연료 사용량 |
| G12 | 단위 | 드롭다운 | ton / 천m³ / kL / MWh |
| D15 | 열량계수 Tier | 드롭다운 | T1 / T2 / T3 |
| E15 | 배출계수 Tier | 드롭다운 | T1 / T2 / T3 |
| F15 | 산화계수 Tier | 자동(=E15) | T1 / T2 / T3 |

### Scope 2 입력
| 셀 | 내용 | 타입 | 설명 |
|----|------|------|------|
| C31 | 연료 | 드롭다운 | 전기(소비단)/전기(발전단)/열전용/열병합/열평균 |
| D31 | GHG 종류 | 드롭다운 | CO2 / CH4 / N2O |
| E31 | 사용량 | 숫자 입력 | 전기/열 사용량 |
| F31 | 단위 | 드롭다운 | MWh / TJ |
| G33 | 지역 | 드롭다운 | 수도권지사 등 (지역난방 선택 시) |
| H33 | 계획기간 | 드롭다운 | 3기 / 4기 |

---

## 📊 자동 계산 셀 (수식)

### 기본 설정 계산

#### F5: 시설규모 결정
```excel
=IF(AND('_Law&GL22'!B109<=Main!G5,'_Law&GL22'!C109>Main!G5),"A",
  IF(AND('_Law&GL22'!B110<=Main!G5,'_Law&GL22'!C110>Main!G5),"B", "C"))
```
**로직:**
- G5(연간 배출량) < 5만ton → "A"
- 5만ton ≤ G5 < 50만ton → "B"  
- G5 ≥ 50만ton → "C"

---

### Scope 1 계산

#### D14, E14, F14: 최소 Tier 기준
```excel
D14: =IF($F$5="A", "T2", IF($F$5="B", "T2", "T3"))  // 열량계수
E14: =IF($F$5="A", "T1", IF($F$5="B", "T2", "T3"))  // 배출계수
F14: =IF($F$5="A", "T1", IF($F$5="B", "T2", "T3"))  // 산화계수
```

#### F15: 산화계수 Tier (배출계수 Tier와 동일)
```excel
=E15
```

#### G16: 연료 상태 자동 조회
```excel
=IF(E12="Default", VLOOKUP(C12,'_Law&GL22'!B36:U103,19,0), E12)
```

#### H14, H15, H16: GWP 조회
```excel
=VLOOKUP($D$12,'_Law&GL22'!$K$24:$L$26,2,0)
```
- CO2 → 1
- CH4 → 21
- N2O → 310

#### D20: 열량계수 (CO2용)
```excel
=IF($D$19="T3", $D$16, 
  VLOOKUP(Main!$C$12,'_Law&GL22'!$B$35:$U$100,
    IF(Main!$D$19="T1",14,IF($D$19="T2",16)),0))
```
**로직:**
- T3인 경우: 사용자 입력값(D16) 사용
- T1인 경우: _Law&GL22 시트의 14열 (IPCC 기본값)
- T2인 경우: _Law&GL22 시트의 16열 (국가고유값)

#### E20: 배출계수 (CO2용)
```excel
=IF($E$19="T3", $E$16, 
  VLOOKUP(Main!$C$12,'_Law&GL22'!$B$35:$U$100,
    IF(Main!$E$19="T1",3,IF($E$19="T2",9)),0))
```
**로직:**
- T3인 경우: 사용자 입력값(E16) 사용
- T1인 경우: _Law&GL22 시트의 3열 (IPCC CO2 배출계수)
- T2인 경우: _Law&GL22 시트의 9열 (국가고유 CO2 배출계수)

#### E21: 배출계수 (CH4용)
```excel
=IF($E$19="T3", $E$16, 
  VLOOKUP(Main!$C$12,'_Law&GL22'!$B$35:$U$100,
    IF(Main!$E$19="T1",4,IF($E$19="T2",10)),0))
```

#### E22: 배출계수 (N2O용)
```excel
=IF($E$19="T3", $E$16, 
  VLOOKUP(Main!$C$12,'_Law&GL22'!$B$35:$U$100,
    IF(Main!$E$19="T1",5,IF($E$19="T2",11)),0))
```

#### F20: 산화계수
```excel
=IF(C12="전기(발전단)", 1, 
  IF(G16="고체",
    IF(F15="T3",F16,VLOOKUP(G16,'_Law&GL22'!L14:O16,IF(Main!F15="T1",2,3),0)),
    VLOOKUP(Main!G16,'_Law&GL22'!L14:O16,
      IF(Main!F15="T1",2,IF(Main!F15="T2",3,IF(Main!F15="T3",4))),0)))
```
**산화계수 참조 테이블 (_Law&GL22!L14:O16):**
| 연료상태 | T1 | T2 | T3 |
|----------|-----|-----|-----|
| 고체 | 1 | 0.98 | 사용자입력 |
| 액체 | 1 | 0.99 | 사용자입력 |
| 기체 | 1 | 0.995 | 사용자입력 |

#### G20: CO2 배출량 계산 (tGHG)
```excel
=PRODUCT(0.000001,
  IF(ISNONTEXT(D20),D20,"-"),
  IF(ISNONTEXT(E20),E20,"-"),
  IF(ISNONTEXT(F20),F20,"-"),
  F12)
```
**공식:** 배출량 = 10⁻⁶ × 열량계수 × 배출계수 × 산화계수 × 사용량

#### H20: CO2 이산화탄소 환산톤 (tCO2eq)
```excel
=G20*'_Law&GL22'!L24
```
**공식:** tCO2eq = tGHG × GWP(CO2) = tGHG × 1

#### G21: CH4 배출량 계산 (tGHG)
```excel
=PRODUCT(0.000001,
  IF(ISNONTEXT(D21),D21,"-"), 
  IF(ISNONTEXT(E21),E21,"-"), 
  F12)
```
**주의:** CH4와 N2O는 산화계수를 적용하지 않음

#### H21: CH4 이산화탄소 환산톤 (tCO2eq)
```excel
=G21*'_Law&GL22'!L25
```
**공식:** tCO2eq = tGHG × GWP(CH4) = tGHG × 21

#### G22: N2O 배출량 계산 (tGHG)
```excel
=PRODUCT(0.000001,
  IF(ISNONTEXT(D22),D22,"-"), 
  IF(ISNONTEXT(E22),E22,"-"), 
  F12)
```

#### H22: N2O 이산화탄소 환산톤 (tCO2eq)
```excel
=G22*'_Law&GL22'!L26
```
**공식:** tCO2eq = tGHG × GWP(N2O) = tGHG × 310

#### G25: Scope 1 총 배출량 (∑tCO2eq)
```excel
=SUM($H$20:$H$22)
```

---

### Scope 2 계산

#### D33: 전력 배출계수 Tier
```excel
=IF(C31="전기(소비단)", "T2", "-")
```

#### E33: 열 배출계수 Tier
```excel
=IF(C31="전기(소비단)", "-", "T3")
```

#### H34, H35, H36: 지역난방 배출계수 조회
```excel
H34 (CO2): =IF(H33="3기",VLOOKUP(Main!G33,_Supplier!B6:E21,2,0),
                          VLOOKUP(G33,_Supplier!B14:E21,2,0))
H35 (CH4): =IF(H33="3기",VLOOKUP(Main!G33,_Supplier!B6:E21,3,0),
                          VLOOKUP(G33,_Supplier!B14:E21,3,0))
H36 (N2O): =IF(H33="3기",VLOOKUP(Main!G33,_Supplier!B6:E21,4,0),
                          VLOOKUP(G33,_Supplier!B14:E21,4,0))
```

#### C39: 선택된 GHG (D31 참조)
```excel
=D31
```

#### D39: 전력 배출계수 조회
```excel
=IF($C$31="전기(소비단)", 
  VLOOKUP($C$31, '_Law&GL22'!$B$100:$U$103, 
    IF($C$39="CO2", 9, IF($C$39="CH4", 10, IF($C$39="N2O",11))), 0), 
  "-")
```

#### E39: 열 배출계수 조회
```excel
=IF(E38="-","-",
  IF(E38="T2",
    VLOOKUP(C31,'_Law&GL22'!B100:U103,
      IF(Main!C39="CO2",9,IF(Main!C39="CH4",10,IF(Main!C39="N2O",11))),0),
    IF(E38="T3",E35,VLOOKUP(C39,G34:H36,2,0))))
```

#### F39: GWP 조회
```excel
=VLOOKUP(C39,'_Law&GL22'!K24:L26,2,0)
```

#### D42: Scope 2 배출량 (tGHG)
```excel
=IF(C31="전기(소비단)", 
  PRODUCT(E31, D39, 0.001), 
  PRODUCT(E31, E39, 0.001))
```
**공식:** 
- 전기: 배출량 = 사용량(MWh) × 배출계수(kgGHG/MWh) × 0.001
- 열: 배출량 = 사용량(TJ) × 배출계수(kgGHG/TJ) × 0.001

#### E42: Scope 2 이산화탄소 환산톤 (tCO2eq)
```excel
=D42*F39
```
**공식:** tCO2eq = tGHG × GWP

---

## 🧮 핵심 계산 공식 요약

### Scope 1 (직접 배출)
```
배출량[tGHG] = 사용량 × 열량계수 × 배출계수 × 산화계수 × 10⁻⁶

tCO2eq = 배출량[tGHG] × GWP

총 Scope 1 = CO2_tCO2eq + CH4_tCO2eq + N2O_tCO2eq
```

### Scope 2 (간접 배출)
```
전기:
  배출량[tGHG] = 사용량[MWh] × 배출계수[kgGHG/MWh] × 0.001
  
열:
  배출량[tGHG] = 사용량[TJ] × 배출계수[kgGHG/TJ] × 0.001
  
tCO2eq = 배출량[tGHG] × GWP
```

---

## ⚠️ 주의사항

1. **CH4, N2O 계산 시 산화계수 미적용**
   - CO2만 산화계수 적용
   - CH4, N2O는 열량계수 × 배출계수 × 사용량만 계산

2. **단위 변환**
   - 0.000001 = 10⁻⁶ (kg → ton, kJ → TJ 변환 포함)
   - 0.001 = kg → ton 변환

3. **Tier별 데이터 열 참조** (VLOOKUP 범위 내 열 번호)
   - T1: IPCC 기본값
     - 열량계수: VLOOKUP 14열 (시트 O열)
     - 배출계수: VLOOKUP 3/4/5열 (시트 D/E/F열) - CO2/CH4/N2O
   - T2: 국가고유값
     - 열량계수: VLOOKUP 16열 (시트 Q열)
     - 배출계수: VLOOKUP 9/10/11열 (시트 J/K/L열) - CO2/CH4/N2O
   - T3: 사용자 직접 입력
   
   ※ VLOOKUP 범위: `'_Law&GL22'!$B$35:$U$100` (B열 = 1열)

