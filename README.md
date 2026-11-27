# 여명과 황혼 TCG (가제)

Verse8에 출시할 웹 카드 게임의 **프로토타입**입니다. 기획서 §9.1 범위(전투 함수 2개, 더미 카드 18종, 스킬, 강화·진화 1사이클)를 플레이 가능한 형태로 만들고, 결투장·레이드·퀘스트·덱 프리셋까지 이후 확장을 받을 수 있는 구조로 잡았습니다.

## 구조 (Verse8 / Agent8 표준)

```
index.html, vite.config.ts      Vite + React 클라이언트
src/
  api/index.ts                  서버 호출 계층 (Verse8: @agent8/gameserver remoteFunction)
  api/localServer.ts            오프라인 미리보기 전용: 같은 서버 코드를 브라우저에서 실행
  screens/                      홈 · 퀘스트(목록/진행/보스) · 카드(강화/진화) · 덱 · 결투장 · 레이드 · 전투 연출
server/
  src/server.ts                 Verse8 게임 서버 (remote function 모음). 빌드 결과: server/dist/server.js
  src/game/config.ts            밸런스 상수 (기획서 수치)
  src/game/data.ts              진형 · 화폐 · 스킬 · 카드 22종 · 보스 · 결투장 봇
  src/game/questData.ts         퀘스트 6장 · 파트 · 몬스터 · 장 보스 · 구간별 드랍
  src/game/cards.ts             카드 인스턴스, 스탯 계산
  src/game/engine.ts            duel(), raidEngage(), rollSkills()
  src/game/growth.ts            강화 · 진화
  src/game/player.ts            플레이어 상태와 모든 행동
  test/server.test.ts           Verse8 테스트 러너(isolated-vm)용 통합 테스트
  unit/engine.test.ts           순수 로직 단위 테스트 (bun test)
```

### 기획서 §9.3 필수 사항

| 항목 | 구현 |
|---|---|
| 전투는 서버에서 계산 | `duel`, `raidEngage`는 `server/src/server.ts`에서만 실행. 클라이언트는 결과를 받아 연출만 재생 |
| 레이드 교전 = API 1콜 | `raidEngage()` 한 번이 교전 전체를 계산해 타임라인과 함께 반환 |
| 카드 인스턴스 필수 필드 | `base_cards_used`, `max_enhance_count`, `tradable`, `locked`(보호)를 생성 시점부터 저장 |
| 덱 프리셋 2~3개 | 프리셋 3개(공격/방어 덱 각 5칸) |
| 전투 스킵 | 결투장·레이드 연출 모두 스킵 버튼 제공 |

데이터 저장: 유저 상태는 `$global.updateMyState({ p })`, 결투장 유령 덱(다른 유저의 방어 덱 스냅샷)은 `$global` 컬렉션 `defense_decks`.

## 실행

```bash
npm install            # 또는 bun install
cd server && npm install && cd ..

npm run dev            # Verse8 서버에 연결하는 개발 서버 (VITE_AGENT8_VERSE 필요)
npm run build          # Verse8 배포용 빌드 (dist/)
npm run build:offline  # 서버 없이 도는 단일 HTML 미리보기 (dist-offline/index.html)
npm test               # 단위 테스트 + Verse8 서버 테스트
```

Verse8에 올릴 때는 verse8 MCP의 `verse8_attach` → `verse8_preview` → `verse8_deploy` 순서를 따릅니다. 게임 서버는 `server/src/server.ts`에서 빌드됩니다.

## 기획서와 다르게 둔 이름 (임시 오리지널)

원작의 고유명사는 쓰지 않았습니다.

| 기획서 | 이 프로젝트 |
|---|---|
| 루피 | 은화 |
| 홀리파우더 | 별가루 |
| 큐어워터 | 활력수 |
| 진형 2개 (미결) | 새벽 기사단 / 황혼 결사 |

## 홈

- 리더 카드(크게) + 현재 공격 덱 5장 썸네일, 탭하면 카드 상세, [덱 편집]
- 오늘 할 일: 결투장 시도, 보스 입장권, 레이드 보스 내 기여 %, 퀘스트 현재 위치 (탭하면 해당 탭)
- 바로가기 2×2: 퀘스트 / 강화 / 진화 / 뽑기. 강화·진화는 대상 카드 고르기 화면으로 바로 연결
- 조건부 카드: 미분배 속성 포인트(분배 UI 포함), 예비 체력 수령, 레이드 보스 마감 24시간 이내 안내
- 뽑기: 은화 1회 1,000 / 10회 9,000 (N 60% · HN 28% · R 10% · HR 2%)

## 퀘스트

- 목록: 장 제목·배너, 체력·경험치 바, 파트마다 달성도 · 소비 체력 · 획득 경험치 · 은화 범위 · 드랍 카드 3종(미획득은 ?)
- 진행: 화면 전환 없는 고정 레이아웃(장면 액자 / 리더 카드 / 체력·경험치·달성도 바 / Enter). Enter 1회 = 1스텝
- 스텝: 이동 / 적 등장(리더 카드별 공격 이펙트) / 보물상자. 획득 은화는 장면 위 텍스트 + 코인 낙하, 경험치는 바 옆 플로팅 텍스트
- 수치는 장마다 다름: 소비 체력 1(1·2장) → 2~3 → 4~6 → 7~9 → 10~15(6장). 경험치 = 소비 체력, 은화 = 소비 체력 × 10~12
- 파트 길이 12~15스텝, 파트 첫 클리어 시 속성 포인트 +1 (재진행은 지급 없음)
- 카드 획득 팝업: 퀘스트 계속하기 / 카드를 판매하고 계속하기(판매가·보유 수 표시) / 퀘스트로 돌아가기
- Auto: 체력 부족·파트 클리어·레벨 업에서 정지, 카드 획득 팝업에서 일시정지. Skip: 연출 단축
- 장 보스: 모든 파트 완료 시 해금, 리더 카드 1장 자동 턴제, 승리해야 다음 장 해금, 클리어 후 재도전 불가
- 리더 지정은 카드 탭의 카드 상세에서

## 카드 목록

- 보유카드 리스트 (n/200), 리스트 / 판매 탭, 진형 필터, 정렬(등급·캐릭터·레벨·공격·방어·코스트·성장도·최근 획득)
- 카드별 Lv · 코스트 · 공격 · 방어 · 성장도 %(레벨 상한 대비). 리더 카드는 맨 위에 고정

## 프로토타입 전용 기능

`server/src/game/config.ts`의 `PROTOTYPE_MODE = true`일 때만 동작합니다. 출시 전 `false`로 바꿉니다.

- 테스트 보급: N 6장 + R 1장(+HR 확률) + 은화·별가루·활력수
- 데이터 초기화

## 미구현 (다음 단계)

주간 공유 보스, 뽑기·천장, 파편(분해·사본), 동료 초대, 진형 변경 과금, 결투장 주간 보상 상세.
