// 퀘스트 장·파트·보스 데이터 (§5.1). 이름은 임시 오리지널.
import type { Rank } from './config';

export type DropBand = 'early' | 'mid' | 'late';

/** 구간별 드랍: base = 주로 나오는 등급, upper = 간헐적/금색 상자 등급 */
export const DROP_BANDS: Record<DropBand, { label: string; base: Rank; upper: Rank }> = {
  early: { label: '초반', base: 'N', upper: 'HN' },
  mid: { label: '중반', base: 'HN', upper: 'R' },
  late: { label: '후반', base: 'R', upper: 'HR' },
};

export interface QuestPart {
  name: string;
  /** 전투 1회당 체력 소모 (10~15) */
  stamina: number;
  /** 전투 1회당 달성도 상승 % */
  gain: number;
  monster: { name: string; glyph: string; hp: number };
}

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

const p = (name: string, stamina: number, gain: number, mName: string, glyph: string, hp: number): QuestPart =>
  ({ name, stamina, gain, monster: { name: mName, glyph, hp } });

export const CHAPTERS: Chapter[] = [
  {
    id: 1, name: '잿빛 국경', band: 'early', bg: 'linear-gradient(180deg,#3b4a5e 0%,#22262f 60%,#1a1c22 100%)',
    parts: [
      p('무너진 초소', 10, 25, '들개', '🐕', 600),
      p('버려진 마을', 10, 25, '굶주린 도적', '🥷', 800),
      p('안개 낀 다리', 11, 25, '늪 거머리', '🪱', 900),
      p('국경 숲', 11, 20, '가시 멧돼지', '🐗', 1100),
      p('봉화대', 12, 20, '해골 병사', '💀', 1300),
    ],
    boss: { name: '국경의 도적왕', glyph: '🪓', hp: 4_000, atk: 250 },
  },
  {
    id: 2, name: '갈대 습지', band: 'early', bg: 'linear-gradient(180deg,#3d5a4a 0%,#1f2c26 60%,#161c19 100%)',
    parts: [
      p('갈대밭 입구', 11, 25, '습지 개구리', '🐸', 1200),
      p('썩은 나무다리', 11, 25, '독두꺼비', '🐊', 1400),
      p('물안개 호수', 12, 20, '물귀신', '👻', 1600),
      p('뿌리 동굴', 12, 20, '뿌리 정령', '🌿', 1800),
      p('늪지 제단', 12, 20, '늪 주술사', '🧙', 2000),
    ],
    boss: { name: '늪의 여왕 메르사', glyph: '🐍', hp: 9_000, atk: 450 },
  },
  {
    id: 3, name: '폐광 도시', band: 'mid', bg: 'linear-gradient(180deg,#5a4a3d 0%,#2c241f 60%,#1c1816 100%)',
    parts: [
      p('광산 입구', 12, 25, '광산 박쥐', '🦇', 2200),
      p('붕괴된 갱도', 12, 20, '바위 거미', '🕷', 2500),
      p('녹슨 레일', 13, 20, '폭주 광차', '🛒', 2800),
      p('수정 동굴', 13, 20, '수정 골렘', '💎', 3100),
      p('지하 호수', 13, 20, '눈먼 물고기', '🐟', 3400),
      p('대장간 터', 14, 20, '불꽃 정령', '🔥', 3800),
    ],
    boss: { name: '광산의 주인 고르가', glyph: '⛏', hp: 16_000, atk: 700 },
  },
  {
    id: 4, name: '서리 고원', band: 'mid', bg: 'linear-gradient(180deg,#5d7186 0%,#2a323d 60%,#1a1e24 100%)',
    parts: [
      p('얼어붙은 길', 13, 20, '서리 늑대', '🐺', 4000),
      p('눈보라 계곡', 13, 20, '설인', '🦍', 4400),
      p('빙하 틈새', 14, 20, '얼음 망령', '❄', 4800),
      p('하얀 수도원', 14, 20, '타락한 수도승', '🧎', 5200),
      p('설산 정상', 14, 20, '하피', '🦅', 5600),
    ],
    boss: { name: '빙관의 기사 스카디르', glyph: '🛡', hp: 26_000, atk: 1_000 },
  },
  {
    id: 5, name: '황혼 사막', band: 'late', bg: 'linear-gradient(180deg,#8a5d3b 0%,#3a271c 60%,#211814 100%)',
    parts: [
      p('모래 언덕', 14, 20, '전갈 병사', '🦂', 6000),
      p('신기루 오아시스', 14, 20, '모래 마녀', '🧝', 6500),
      p('무너진 신전', 15, 20, '석상 수호자', '🗿', 7000),
      p('왕들의 무덤', 15, 20, '미라 군주', '🧟', 7500),
      p('태양의 문', 15, 20, '불새', '🐦', 8000),
    ],
    boss: { name: '사막의 폭군 아즈라', glyph: '☀', hp: 40_000, atk: 1_400 },
  },
  {
    id: 6, name: '별 떨어진 성', band: 'late', bg: 'linear-gradient(180deg,#3b2f5e 0%,#1f1a30 60%,#141221 100%)',
    parts: [
      p('외성벽', 15, 20, '그림자 기사', '♞', 8500),
      p('부서진 정원', 15, 20, '가시 장미 정령', '🥀', 9000),
      p('왕좌의 회랑', 15, 20, '유령 근위대', '👤', 9500),
      p('별의 탑', 15, 20, '별빛 마도사', '✨', 10000),
      p('천문대', 15, 20, '시간의 파수꾼', '⌛', 10500),
      p('왕좌', 15, 20, '왕의 그림자', '🌑', 11000),
    ],
    boss: { name: '추락한 별의 왕', glyph: '👑', hp: 60_000, atk: 1_900 },
  },
];

export const partKey = (chapter: number, part: number) => `${chapter}-${part}`;
