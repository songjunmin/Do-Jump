// 퀘스트 장·파트·보스 데이터 (§5.1). 이름은 임시 오리지널.
import type { Rank } from './config';
import { CARDS } from './data';

export type DropBand = 'early' | 'mid' | 'late';

/** 구간별 드랍: base = 주로 나오는 등급, upper = 간헐적/금색 상자 등급 */
export const DROP_BANDS: Record<DropBand, { label: string; base: Rank; upper: Rank }> = {
  early: { label: '초반', base: 'N', upper: 'HN' },
  mid: { label: '중반', base: 'HN', upper: 'R' },
  late: { label: '후반', base: 'R', upper: 'HR' },
};

export interface QuestPart {
  name: string;
  /** 스텝(Enter 1회)당 체력 소모. 장마다 다름: 초반 1 → 후반 10~15 */
  stamina: number;
  /** 스텝 1회당 달성도 상승 % (파트 ≈ 12~15스텝) */
  gain: number;
  /** 이 파트에서 만나는 적 */
  monster: { name: string; glyph: string; hp: number };
  /** 이 파트의 보물상자 드랍 (스테이지마다 고정) */
  drops: { base: string[]; upper: string[] };
}

/** 스텝 이벤트 확률 */
export const STEP_EVENTS = { move: 0.5, enemy: 0.35, treasure: 0.15 };
/** 장별 파트 길이(스텝 수) */
const STEPS_BY_CHAPTER = [12, 12, 13, 14, 15, 15];
/** 파트 완료까지 필요한 스텝 수 */
export const stepsToClear = (part: QuestPart) => Math.ceil(100 / part.gain);
/** 스텝 1회 획득 경험치 = 소비 체력 */
export const stepExp = (part: QuestPart) => part.stamina;
/** 스텝 1회 은화 범위 = 소비 체력 × 10~12 */
export const stepSilver = (part: QuestPart) => ({ min: part.stamina * 10, max: part.stamina * 12 });

export interface QuestBoss { name: string; glyph: string; hp: number; atk: number }

export interface Chapter {
  id: number;
  name: string;
  band: DropBand;
  /** 진행 화면 배경 */
  bg: string;
  parts: QuestPart[];
  boss: QuestBoss;
}

// gain은 아래에서 장별 스텝 수로 채운다
const p = (name: string, stamina: number, mName: string, glyph: string, hp: number): QuestPart =>
  ({ name, stamina, gain: 10, monster: { name: mName, glyph, hp }, drops: { base: [], upper: [] } });

export const CHAPTERS: Chapter[] = [
  {
    id: 1, name: '잿빛 국경', band: 'early', bg: 'linear-gradient(180deg,#3b4a5e 0%,#22262f 60%,#1a1c22 100%)',
    parts: [
      p('무너진 초소', 1, '들개', '🐕', 600),
      p('버려진 마을', 1, '굶주린 도적', '🥷', 800),
      p('안개 낀 다리', 1, '늪 거머리', '🪱', 900),
      p('국경 숲', 1, '가시 멧돼지', '🐗', 1100),
      p('봉화대', 1, '해골 병사', '💀', 1300),
    ],
    boss: { name: '국경의 도적왕', glyph: '🪓', hp: 4_000, atk: 250 },
  },
  {
    id: 2, name: '갈대 습지', band: 'early', bg: 'linear-gradient(180deg,#3d5a4a 0%,#1f2c26 60%,#161c19 100%)',
    parts: [
      p('갈대밭 입구', 1, '습지 개구리', '🐸', 1200),
      p('썩은 나무다리', 1, '독두꺼비', '🐊', 1400),
      p('물안개 호수', 1, '물귀신', '👻', 1600),
      p('뿌리 동굴', 1, '뿌리 정령', '🌿', 1800),
      p('늪지 제단', 1, '늪 주술사', '🧙', 2000),
    ],
    boss: { name: '늪의 여왕 메르사', glyph: '🐍', hp: 9_000, atk: 450 },
  },
  {
    id: 3, name: '폐광 도시', band: 'mid', bg: 'linear-gradient(180deg,#5a4a3d 0%,#2c241f 60%,#1c1816 100%)',
    parts: [
      p('광산 입구', 2, '광산 박쥐', '🦇', 2200),
      p('붕괴된 갱도', 2, '바위 거미', '🕷', 2500),
      p('녹슨 레일', 2, '폭주 광차', '🛒', 2800),
      p('수정 동굴', 3, '수정 골렘', '💎', 3100),
      p('지하 호수', 3, '눈먼 물고기', '🐟', 3400),
      p('대장간 터', 3, '불꽃 정령', '🔥', 3800),
    ],
    boss: { name: '광산의 주인 고르가', glyph: '⛏', hp: 16_000, atk: 700 },
  },
  {
    id: 4, name: '서리 고원', band: 'mid', bg: 'linear-gradient(180deg,#5d7186 0%,#2a323d 60%,#1a1e24 100%)',
    parts: [
      p('얼어붙은 길', 4, '서리 늑대', '🐺', 4000),
      p('눈보라 계곡', 4, '설인', '🦍', 4400),
      p('빙하 틈새', 5, '얼음 망령', '❄', 4800),
      p('하얀 수도원', 5, '타락한 수도승', '🧎', 5200),
      p('설산 정상', 6, '하피', '🦅', 5600),
    ],
    boss: { name: '빙관의 기사 스카디르', glyph: '🛡', hp: 26_000, atk: 1_000 },
  },
  {
    id: 5, name: '황혼 사막', band: 'late', bg: 'linear-gradient(180deg,#8a5d3b 0%,#3a271c 60%,#211814 100%)',
    parts: [
      p('모래 언덕', 7, '전갈 병사', '🦂', 6000),
      p('신기루 오아시스', 7, '모래 마녀', '🧝', 6500),
      p('무너진 신전', 8, '석상 수호자', '🗿', 7000),
      p('왕들의 무덤', 8, '미라 군주', '🧟', 7500),
      p('태양의 문', 9, '불새', '🐦', 8000),
    ],
    boss: { name: '사막의 폭군 아즈라', glyph: '☀', hp: 40_000, atk: 1_400 },
  },
  {
    id: 6, name: '별 떨어진 성', band: 'late', bg: 'linear-gradient(180deg,#3b2f5e 0%,#1f1a30 60%,#141221 100%)',
    parts: [
      p('외성벽', 10, '그림자 기사', '♞', 8500),
      p('부서진 정원', 11, '가시 장미 정령', '🥀', 9000),
      p('왕좌의 회랑', 12, '유령 근위대', '👤', 9500),
      p('별의 탑', 13, '별빛 마도사', '✨', 10000),
      p('천문대', 14, '시간의 파수꾼', '⌛', 10500),
      p('왕좌', 15, '왕의 그림자', '🌑', 11000),
    ],
    boss: { name: '추락한 별의 왕', glyph: '👑', hp: 60_000, atk: 1_900 },
  },
];

export const partKey = (chapter: number, part: number) => `${chapter}-${part}`;

// 드랍 풀: 장의 구간(초반/중반/후반) 등급에서 파트마다 다른 조합을 고정 배정
for (const ch of CHAPTERS) {
  const band = DROP_BANDS[ch.band];
  const base = CARDS.filter((c) => c.rank === band.base).map((c) => c.id);
  const upper = CARDS.filter((c) => c.rank === band.upper).map((c) => c.id);
  ch.parts.forEach((part, i) => {
    part.gain = Math.ceil(100 / STEPS_BY_CHAPTER[ch.id - 1]);
    const o = (ch.id * 7 + i * 3) % Math.max(1, base.length);
    part.drops = {
      base: [base[o % base.length], base[(o + 1) % base.length]],
      upper: [upper[(ch.id + i) % upper.length]],
    };
  });
}
