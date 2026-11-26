// 카드 인스턴스와 스탯 계산 (§1.3, §2)
import { FORM_MULT, LEVEL_CAP, LV1_RATIO, MAX_FORM, RANKS, type Rank } from './config';
import { CARD_MAP, SKILLS, type CardMaster, type FactionId, type Skill } from './data';

/** 카드 인스턴스. base_cards_used / max_enhance_count / tradable은 §9.3 필수 저장 항목 */
export interface CardInstance {
  uid: string;
  cardId: string;
  form: number;
  level: number;
  exp: number;
  /** 진화식 @: 이 카드에 투입된 1단계 카드 장수 */
  base_cards_used: number;
  /** 진화식 #: 전체 과정의 맥강 횟수 */
  max_enhance_count: number;
  /** 경매장 도입 대비 플래그 */
  tradable: boolean;
  /** 보호 설정 */
  locked: boolean;
  /** 진화로 계승된 스탯 */
  inhAtk: number;
  inhDef: number;
  createdAt: number;
}

/** 전투에 들어가는 카드 스냅샷 */
export interface BattleCard {
  uid: string;
  cardId: string;
  name: string;
  rank: Rank;
  faction: FactionId;
  form: number;
  level: number;
  atk: number;
  def: number;
  cost: number;
  skill: string | null;
}

export function master(cardId: string): CardMaster {
  const m = CARD_MAP[cardId];
  if (!m) throw new Error(`알 수 없는 카드: ${cardId}`);
  return m;
}

/** 현재 등급: form 4에서 한 칸 상승. LG가 상한 */
export function rankOf(inst: Pick<CardInstance, 'cardId' | 'form'>): Rank {
  const base = RANKS.indexOf(master(inst.cardId).rank);
  return RANKS[Math.min(base + (inst.form >= MAX_FORM ? 1 : 0), RANKS.length - 1)];
}

export const levelCap = (inst: Pick<CardInstance, 'cardId' | 'form'>) => LEVEL_CAP[rankOf(inst)];
export const isMaxed = (inst: CardInstance) => inst.level >= levelCap(inst);
export const canEvolve = (inst: CardInstance) => inst.form < MAX_FORM && master(inst.cardId).rank !== 'LG';

export function displayName(inst: Pick<CardInstance, 'cardId' | 'form'>): string {
  const m = master(inst.cardId);
  if (inst.form >= MAX_FORM) return `[${m.title}] ${m.name}`;
  return m.name + '+'.repeat(Math.max(0, inst.form - 1));
}

/** 레벨·진화 단계 기준 스탯 (계승분 포함) */
export function statsOf(inst: Pick<CardInstance, 'cardId' | 'form' | 'level' | 'inhAtk' | 'inhDef'>): { atk: number; def: number } {
  const m = master(inst.cardId);
  const mult = FORM_MULT[Math.min(inst.form, MAX_FORM) - 1];
  const cap = levelCap(inst);
  const t = cap <= 1 ? 1 : (Math.min(inst.level, cap) - 1) / (cap - 1);
  const f = LV1_RATIO + (1 - LV1_RATIO) * t;
  return {
    atk: Math.round(m.maxAtk * mult * f) + inst.inhAtk,
    def: Math.round(m.maxDef * mult * f) + inst.inhDef,
  };
}

export function skillOf(cardId: string): Skill | null {
  const s = master(cardId).skill;
  return s ? SKILLS[s] : null;
}

export function toBattleCard(inst: CardInstance): BattleCard {
  const m = master(inst.cardId);
  const s = statsOf(inst);
  return {
    uid: inst.uid, cardId: inst.cardId, name: displayName(inst), rank: rankOf(inst), faction: m.faction,
    form: inst.form, level: inst.level, atk: s.atk, def: s.def, cost: m.cost, skill: m.skill,
  };
}

export function newInstance(cardId: string, uid: string, now: number, form = 1, level = 1): CardInstance {
  master(cardId);
  return {
    uid, cardId, form, level, exp: 0,
    base_cards_used: form === 1 ? 1 : 2 ** (form - 1),
    max_enhance_count: 0, tradable: true, locked: false, inhAtk: 0, inhDef: 0, createdAt: now,
  };
}

/** 진화식 표기 @-# */
export const evoFormula = (inst: CardInstance) => `${inst.base_cards_used}-${inst.max_enhance_count}`;
