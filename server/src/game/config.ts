// 밸런스 상수. 기획서 수치를 한곳에 모아 프로토타입에서 조정하기 쉽게 둔다.

export const RANKS = ['N', 'HN', 'R', 'HR', 'SR', 'SSR', 'LG'] as const;
export type Rank = (typeof RANKS)[number];

/** 등급별 레벨 상한 (§1.1) */
export const LEVEL_CAP: Record<Rank, number> = { N: 20, HN: 30, R: 40, HR: 50, SR: 60, SSR: 70, LG: 80 };

export const RANK_LABEL: Record<Rank, string> = {
  N: '노멀', HN: '하이노멀', R: '레어', HR: '하이레어', SR: 'S레어', SSR: 'SS레어', LG: '레전드',
};

/** 진화 단계(form 1~4)별 스탯 배율. 최종 진화(form 4)에서 등급 +1 (§2.2) */
export const FORM_MULT = [1, 1.15, 1.3, 1.6];
/** Lv1 스탯 / 최대 레벨 스탯 비율 */
export const LV1_RATIO = 0.5;
export const MAX_FORM = 4;

/** 진화 계승률 (§2.2) */
export const INHERIT_MAXED = 0.1;
export const INHERIT_NORMAL = 0.05;

/** 슬롯별 스킬 발동 확률 (§3.2). 인덱스 0 = 1번 슬롯 */
export const SLOT_CHANCE = [0.3, 0.65, 1.0, 0.5, 0.2];
/** 발동 우선순위: 3 → 2 → 4 → 1 → 5 (0-based 인덱스) */
export const SLOT_PRIORITY = [2, 1, 3, 0, 4];
export const MAX_SKILLS_APPLIED = 3;
export const DECK_SIZE = 5;
export const PRESET_COUNT = 3;

/** 소속 진형 일치 보너스 (§1.5) */
export const FACTION_BONUS = 0.03;

/** 강화 (§2.1) */
export const ENHANCE_MAX_MATERIALS = 10;
export const MATERIAL_EXP: Record<Rank, number> = { N: 150, HN: 250, R: 500, HR: 1000, SR: 2000, SSR: 4000, LG: 8000 };
export const CLEAR_CARD_BONUS = 0.5;
export const expToNext = (level: number) => 6 * level + 10;
/** 재료 1장당 은화 비용 — 대상 레벨 제곱 비례 */
export const enhanceCost = (level: number, materials: number) => materials * (50 + 2 * level * level);
export const evolveCost = (rankIdx: number, form: number) => 1000 * (rankIdx + 1) * form;

/** 플레이어 자원 (§4) */
/** 체력 상한 시작값. 이후 속성 포인트 1 = 체력 상한 +1 */
export const STAMINA_START_MAX = 35;
export const STAMINA_REGEN_MS = 60_000;
/** 예비 체력 풀 상한 = 체력 상한 × 3 */
export const STAMINA_RESERVE_MULT = 3;
export const TICKET_REGEN_MS = 3 * 60 * 60_000;
export const TICKET_CAP = 10;
export const TICKET_HARD_CAP = 20;
export const STARDUST_TICKETS = 10;
export const DUEL_DAILY_ATTEMPTS = 10;
export const START_COST = 60;
export const POINTS_PER_LEVEL = 3;
export const POINTS_PER_PART = 1;
export const INVENTORY_CAP = 200;
/** 플레이어 레벨업 경험치 (Lv1 → 10) */
export const playerExpToNext = (level: number) => 5 + level * 5;

/** 뽑기 (은화). 10회는 1회분 할인 */
export const GACHA_COST = 1_000;
export const GACHA_RATES: { rank: Rank; p: number }[] = [
  { rank: 'N', p: 0.6 }, { rank: 'HN', p: 0.28 }, { rank: 'R', p: 0.1 }, { rank: 'HR', p: 0.02 },
];
export const gachaCost = (count: number) => (count >= 10 ? GACHA_COST * (count - 1) : GACHA_COST * count);

/** 카드 판매 기본가 (등급별) */
export const SELL_PRICE: Record<Rank, number> = { N: 50, HN: 100, R: 300, HR: 1000, SR: 3000, SSR: 8000, LG: 20000 };
/** 보스전에서 리더 카드의 체력 = 방어력 × 배수 */
export const LEADER_HP_MULT = 3;
export const LEADER_MAX_TURNS = 40;

/** 결투장 (§5.2) */
export const TIERS = [
  { name: '브론즈', min: 0 },
  { name: '실버', min: 400 },
  { name: '골드', min: 800 },
  { name: '플래티넘', min: 1200 },
  { name: '다이아', min: 1600 },
  { name: '챔피언', min: 2000 },
];
export const DUEL_REMATCH_BLOCK_MS = 30 * 60_000;

/** 레이드 (§5.3) */
export const PERSONAL_BOSS_WINDOW_MS = 72 * 60 * 60_000;

/** 한국 시간 기준 일/주 리셋 */
export const TZ_OFFSET_MS = 9 * 60 * 60_000;

/**
 * 프로토타입 전용 '테스트 보급' 버튼 허용 여부.
 * 정식 출시 전에 false로 바꾼다.
 */
export const PROTOTYPE_MODE = true;
