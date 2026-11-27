// 마스터 데이터: 진형, 스킬, 카드 18종(더미), 보스, 결투장 봇.
// 모든 이름은 임시 오리지널 이름이다.
import type { Rank } from './config';

export type FactionId = 'dawn' | 'dusk';
export const FACTIONS: Record<FactionId, { name: string; short: string; color: string; desc: string }> = {
  dawn: { name: '새벽 기사단', short: '새벽', color: '#e0a526', desc: '무너진 왕도를 되찾으려는 기사와 수도자들' },
  dusk: { name: '황혼 결사', short: '황혼', color: '#8e4fd6', desc: '낡은 왕권을 끝내려는 밤의 동맹' },
};

export const CURRENCY = {
  silver: { name: '은화', desc: '강화·진화 비용' },
  stardust: { name: '별가루', desc: '보스 입장권 10장 충전' },
  vitality: { name: '활력수', desc: '체력 전량 회복' },
} as const;

export type SkillType = 'ATK_UP' | 'DEF_UP' | 'ENEMY_DEF_DOWN';
export interface Skill { id: string; name: string; type: SkillType; value: number; desc: string }

/** 프로토타입 스킬 3종 + 무스킬(깡공·깡방) 2종 (§9.1) */
export const SKILLS: Record<string, Skill> = {
  rally: { id: 'rally', name: '돌격의 함성', type: 'ATK_UP', value: 0.05, desc: '아군 공격력 +5%' },
  bulwark: { id: 'bulwark', name: '강철 방벽', type: 'DEF_UP', value: 0.08, desc: '아군 방어력 +8%' },
  sunder: { id: 'sunder', name: '갑옷 부수기', type: 'ENEMY_DEF_DOWN', value: 0.05, desc: '상대 방어력 -5% (레이드: 피해 +5%)' },
};

export type Style = 'atk' | 'bal' | 'def';
export interface CardMaster {
  id: string;
  name: string;
  /** 최종 진화(form 4) 시 붙는 고유 타이틀 */
  title: string;
  rank: Rank;
  faction: FactionId;
  style: Style;
  cost: number;
  /** form 1 최대 레벨 기준 스탯 */
  maxAtk: number;
  maxDef: number;
  skill: string | null;
  glyph: string;
}

const c = (
  id: string, name: string, title: string, rank: Rank, faction: FactionId, style: Style,
  cost: number, maxAtk: number, maxDef: number, skill: string | null, glyph: string,
): CardMaster => ({ id, name, title, rank, faction, style, cost, maxAtk, maxDef, skill, glyph });

/**
 * 더미 카드 22종 (N 6 / HN 4 / R 7 / HR 5).
 * 스킬이 있는 카드는 스탯 총합을 조금 낮게, 무스킬 카드는 높게 책정했다.
 */
export const CARDS: CardMaster[] = [
  // N — 도시락
  c('n_spear', '견습 창병', '노련한', 'N', 'dawn', 'atk', 4, 900, 600, null, '🗡'),
  c('n_scout', '새벽 정찰병', '숙련된', 'N', 'dawn', 'bal', 4, 750, 750, null, '🏹'),
  c('n_wall', '성벽 수비병', '굳건한', 'N', 'dawn', 'def', 5, 600, 950, null, '🛡'),
  c('n_minion', '그림자 졸개', '교활한', 'N', 'dusk', 'atk', 4, 950, 550, null, '🗡'),
  c('n_thrower', '황혼 투척병', '숙련된', 'N', 'dusk', 'bal', 4, 760, 740, null, '💣'),
  c('n_gate', '결사 문지기', '굳건한', 'N', 'dusk', 'def', 5, 580, 980, null, '🛡'),
  // HN
  c('hn_squire', '새벽 종자', '충직한', 'HN', 'dawn', 'atk', 6, 1350, 900, null, '⚔'),
  c('hn_medic', '들판 치유사', '자애로운', 'HN', 'dawn', 'def', 6, 850, 1400, null, '✚'),
  c('hn_cutthroat', '골목 칼잡이', '악명 높은', 'HN', 'dusk', 'atk', 6, 1400, 850, null, '🗡'),
  c('hn_lookout', '망루 감시자', '잠들지 않는', 'HN', 'dusk', 'def', 6, 880, 1380, null, '👁'),
  // R
  c('r_lancer', '창기병 카엘', '여명의 창', 'R', 'dawn', 'atk', 11, 2900, 1900, 'rally', '⚔'),
  c('r_nun', '방패수녀 엘린', '은빛 서약', 'R', 'dawn', 'def', 11, 1850, 2950, 'bulwark', '✚'),
  c('r_archer', '궁수 로웬', '매의 눈', 'R', 'dawn', 'atk', 10, 3300, 2000, null, '🏹'),
  c('r_paladin', '성기사 다리온', '불굴', 'R', 'dawn', 'def', 10, 2000, 3350, null, '🛡'),
  c('r_venom', '독날 미라', '맹독의 춤', 'R', 'dusk', 'atk', 11, 2850, 1950, 'sunder', '🗡'),
  c('r_raven', '밤까마귀 진', '그믐 사냥꾼', 'R', 'dusk', 'atk', 10, 3350, 1950, null, '🪶'),
  c('r_ironmask', '철가면 고르딘', '부서지지 않는', 'R', 'dusk', 'def', 10, 1950, 3400, null, '🛡'),
  // HR
  c('hr_sunblade', '태양검 세라핀', '정오의 검성', 'HR', 'dawn', 'atk', 15, 4600, 3000, 'rally', '☀'),
  c('hr_bastion', '성채의 바르톨', '최후의 성문', 'HR', 'dawn', 'def', 15, 2900, 4700, 'bulwark', '🏰'),
  c('hr_eclipse', '월식의 마녀 노크타', '검은 태양', 'HR', 'dusk', 'atk', 16, 4700, 3000, 'sunder', '🌑'),
  c('hr_blackknight', '칠흑 기사 바엘', '심연의 방패', 'HR', 'dusk', 'def', 15, 2950, 4750, 'bulwark', '♞'),
  c('hr_obsidian', '흑요 암살자 레이븐', '소리 없는 칼날', 'HR', 'dusk', 'bal', 14, 4300, 4100, null, '✦'),
];

export const CARD_MAP: Record<string, CardMaster> = Object.fromEntries(CARDS.map((x) => [x.id, x]));

/** 보스 변주 (§5.3). 보스 공격력 시작값 2,000 */
export interface BossType { id: string; name: string; kind: string; hp: number; power: number; glyph: string }
export const BOSSES: BossType[] = [
  { id: 'golem', name: '잿빛 거상', kind: '중장형', hp: 300_000, power: 1_200, glyph: '🗿' },
  { id: 'wyvern', name: '폭풍 비룡', kind: '맹공형', hp: 150_000, power: 3_500, glyph: '🐉' },
  { id: 'knight', name: '망령 기사왕', kind: '균형형', hp: 220_000, power: 2_000, glyph: '👑' },
];

/** 주간 공유 보스: 모든 플레이어가 함께 HP를 깎는다. 주마다 순환 */
export const WEEKLY_BOSSES: BossType[] = [
  { id: 'w_abyss', name: '심연의 거룡', kind: '공유 보스', hp: 3_000_000, power: 2_600, glyph: '🐲' },
  { id: 'w_titan', name: '폭풍의 거신', kind: '공유 보스', hp: 3_600_000, power: 2_200, glyph: '🌩' },
];

/** 결투장 설계 봇: 티어별 기준 방어 덱. [cardId, form, level] */
export interface BotDef { id: string; name: string; tier: number; faction: FactionId; deck: [string, number, number][] }
export const BOTS: BotDef[] = [
  { id: 'bot_b1', name: '훈련 교관', tier: 0, faction: 'dawn', deck: [['n_wall', 1, 10], ['n_scout', 1, 10], ['r_paladin', 1, 1], ['n_wall', 1, 15], ['n_gate', 1, 10]] },
  { id: 'bot_b2', name: '골목 패거리', tier: 0, faction: 'dusk', deck: [['n_gate', 1, 20], ['n_minion', 1, 15], ['r_ironmask', 1, 5], ['n_thrower', 1, 15], ['n_gate', 1, 20]] },
  { id: 'bot_b3', name: '초소 경비대', tier: 0, faction: 'dawn', deck: [['n_wall', 2, 20], ['r_nun', 1, 1], ['r_paladin', 1, 10], ['n_scout', 1, 20], ['n_wall', 1, 20]] },
  { id: 'bot_s1', name: '은빛 순찰대', tier: 1, faction: 'dawn', deck: [['r_paladin', 1, 15], ['r_nun', 1, 15], ['r_paladin', 1, 20], ['n_wall', 2, 20], ['r_archer', 1, 10]] },
  { id: 'bot_s2', name: '밤길 도적단', tier: 1, faction: 'dusk', deck: [['r_ironmask', 1, 20], ['r_venom', 1, 10], ['r_ironmask', 1, 15], ['n_gate', 2, 20], ['r_raven', 1, 10]] },
  { id: 'bot_s3', name: '변방 수비대', tier: 1, faction: 'dawn', deck: [['r_nun', 1, 25], ['r_paladin', 1, 25], ['n_wall', 3, 20], ['r_paladin', 1, 20], ['n_scout', 2, 20]] },
  { id: 'bot_g1', name: '왕도 근위대', tier: 2, faction: 'dawn', deck: [['r_paladin', 2, 30], ['r_nun', 2, 25], ['r_paladin', 1, 40], ['r_nun', 1, 35], ['r_archer', 1, 30]] },
  { id: 'bot_g2', name: '그림자 길드', tier: 2, faction: 'dusk', deck: [['r_ironmask', 2, 30], ['hr_blackknight', 1, 10], ['r_ironmask', 1, 40], ['r_venom', 1, 30], ['r_raven', 1, 30]] },
  { id: 'bot_p1', name: '성채 수호단', tier: 3, faction: 'dawn', deck: [['r_paladin', 3, 40], ['hr_bastion', 1, 25], ['r_nun', 3, 40], ['hr_bastion', 1, 20], ['r_paladin', 2, 40]] },
  { id: 'bot_p2', name: '심연 결사대', tier: 3, faction: 'dusk', deck: [['r_ironmask', 3, 40], ['hr_blackknight', 1, 30], ['hr_blackknight', 1, 25], ['r_ironmask', 2, 40], ['hr_obsidian', 1, 20]] },
  { id: 'bot_d1', name: '여명의 방진', tier: 4, faction: 'dawn', deck: [['r_paladin', 4, 50], ['hr_bastion', 2, 40], ['hr_bastion', 1, 50], ['r_nun', 4, 50], ['hr_sunblade', 1, 40]] },
  { id: 'bot_d2', name: '칠흑의 장벽', tier: 4, faction: 'dusk', deck: [['r_ironmask', 4, 50], ['hr_blackknight', 2, 40], ['hr_blackknight', 1, 50], ['hr_obsidian', 1, 40], ['r_ironmask', 4, 45]] },
  { id: 'bot_c1', name: '전설의 문지기', tier: 5, faction: 'dawn', deck: [['hr_bastion', 3, 50], ['hr_bastion', 4, 50], ['hr_bastion', 2, 50], ['r_paladin', 4, 50], ['hr_sunblade', 2, 50]] },
  { id: 'bot_c2', name: '밤의 왕좌', tier: 5, faction: 'dusk', deck: [['hr_blackknight', 3, 50], ['hr_blackknight', 4, 50], ['hr_obsidian', 2, 50], ['r_ironmask', 4, 50], ['hr_blackknight', 2, 50]] },
];
