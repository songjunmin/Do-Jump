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
  /** 탐색 1회당 체력 소모 (10~15) */
  stamina: number;
  /** 탐색 1회당 달성도 상승 % */
  gain: number;
  /** 장소 아이콘 */
  glyph: string;
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

const p = (name: string, stamina: number, gain: number, glyph: string): QuestPart => ({ name, stamina, gain, glyph });

export const CHAPTERS: Chapter[] = [
  {
    id: 1, name: '잿빛 국경', band: 'early', bg: 'linear-gradient(180deg,#3b4a5e 0%,#22262f 60%,#1a1c22 100%)',
    parts: [
      p('무너진 초소', 10, 25, '🏚'),
      p('버려진 마을', 10, 25, '🏘'),
      p('안개 낀 다리', 11, 25, '🌉'),
      p('국경 숲', 11, 20, '🌲'),
      p('봉화대', 12, 20, '🔥'),
    ],
    boss: { name: '국경의 도적왕', glyph: '🪓', hp: 4_000, atk: 250 },
  },
  {
    id: 2, name: '갈대 습지', band: 'early', bg: 'linear-gradient(180deg,#3d5a4a 0%,#1f2c26 60%,#161c19 100%)',
    parts: [
      p('갈대밭 입구', 11, 25, '🌾'),
      p('썩은 나무다리', 11, 25, '🪵'),
      p('물안개 호수', 12, 20, '🌫'),
      p('뿌리 동굴', 12, 20, '🕳'),
      p('늪지 제단', 12, 20, '🗿'),
    ],
    boss: { name: '늪의 여왕 메르사', glyph: '🐍', hp: 9_000, atk: 450 },
  },
  {
    id: 3, name: '폐광 도시', band: 'mid', bg: 'linear-gradient(180deg,#5a4a3d 0%,#2c241f 60%,#1c1816 100%)',
    parts: [
      p('광산 입구', 12, 25, '⛏'),
      p('붕괴된 갱도', 12, 20, '🪨'),
      p('녹슨 레일', 13, 20, '🛤'),
      p('수정 동굴', 13, 20, '💎'),
      p('지하 호수', 13, 20, '💧'),
      p('대장간 터', 14, 20, '⚒'),
    ],
    boss: { name: '광산의 주인 고르가', glyph: '⛏', hp: 16_000, atk: 700 },
  },
  {
    id: 4, name: '서리 고원', band: 'mid', bg: 'linear-gradient(180deg,#5d7186 0%,#2a323d 60%,#1a1e24 100%)',
    parts: [
      p('얼어붙은 길', 13, 20, '❄'),
      p('눈보라 계곡', 13, 20, '🌨'),
      p('빙하 틈새', 14, 20, '🧊'),
      p('하얀 수도원', 14, 20, '⛪'),
      p('설산 정상', 14, 20, '🏔'),
    ],
    boss: { name: '빙관의 기사 스카디르', glyph: '🛡', hp: 26_000, atk: 1_000 },
  },
  {
    id: 5, name: '황혼 사막', band: 'late', bg: 'linear-gradient(180deg,#8a5d3b 0%,#3a271c 60%,#211814 100%)',
    parts: [
      p('모래 언덕', 14, 20, '🏜'),
      p('신기루 오아시스', 14, 20, '🌴'),
      p('무너진 신전', 15, 20, '🏛'),
      p('왕들의 무덤', 15, 20, '⚱'),
      p('태양의 문', 15, 20, '☀'),
    ],
    boss: { name: '사막의 폭군 아즈라', glyph: '☀', hp: 40_000, atk: 1_400 },
  },
  {
    id: 6, name: '별 떨어진 성', band: 'late', bg: 'linear-gradient(180deg,#3b2f5e 0%,#1f1a30 60%,#141221 100%)',
    parts: [
      p('외성벽', 15, 20, '🧱'),
      p('부서진 정원', 15, 20, '🥀'),
      p('왕좌의 회랑', 15, 20, '🕯'),
      p('별의 탑', 15, 20, '🗼'),
      p('천문대', 15, 20, '🔭'),
      p('왕좌', 15, 20, '👑'),
    ],
    boss: { name: '추락한 별의 왕', glyph: '👑', hp: 60_000, atk: 1_900 },
  },
];

export const partKey = (chapter: number, part: number) => `${chapter}-${part}`;
