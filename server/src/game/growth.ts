// 강화·진화 (§2.1, §2.2)
import {
  CLEAR_CARD_BONUS, ENHANCE_MAX_MATERIALS, INHERIT_MAXED, INHERIT_NORMAL, MATERIAL_EXP, RANKS,
  enhanceCost, evolveCost, expToNext,
} from './config';
import { canEvolve, isMaxed, levelCap, master, rankOf, statsOf, type CardInstance } from './cards';

/** 재료 1장이 주는 경험치: 등급·진화 단계·코스트가 높을수록 많다 */
export function materialExp(mat: CardInstance): number {
  const base = MATERIAL_EXP[rankOf(mat)];
  return Math.round(base * (1 + 0.5 * (mat.form - 1)) + master(mat.cardId).cost * 10);
}

export const isClearCard = (c: CardInstance) => c.level === 1 && c.exp === 0;

export interface EnhancePreview { gainedExp: number; cost: number; levelFrom: number; levelTo: number; maxed: boolean; clearBonus: boolean }

export function previewEnhance(target: CardInstance, materials: CardInstance[]): EnhancePreview {
  const clearBonus = isClearCard(target);
  let gained = materials.reduce((a, m) => a + materialExp(m), 0);
  if (clearBonus) gained = Math.round(gained * (1 + CLEAR_CARD_BONUS));
  const cap = levelCap(target);
  let level = target.level;
  let exp = target.exp + gained;
  while (level < cap && exp >= expToNext(level)) { exp -= expToNext(level); level++; }
  return { gainedExp: gained, cost: enhanceCost(target.level, materials.length), levelFrom: target.level, levelTo: level, maxed: level >= cap, clearBonus };
}

/** 강화 적용. 재료 제거·비용 차감은 호출 측에서 한다 */
export function applyEnhance(target: CardInstance, materials: CardInstance[]): EnhancePreview {
  if (materials.length === 0) throw new Error('재료를 1장 이상 선택하세요.');
  if (materials.length > ENHANCE_MAX_MATERIALS) throw new Error(`재료는 한 번에 최대 ${ENHANCE_MAX_MATERIALS}장입니다.`);
  if (isMaxed(target)) throw new Error('이미 최대 레벨입니다.');
  const p = previewEnhance(target, materials);
  const cap = levelCap(target);
  let level = target.level;
  let exp = target.exp + p.gainedExp;
  while (level < cap && exp >= expToNext(level)) { exp -= expToNext(level); level++; }
  target.level = level;
  target.exp = level >= cap ? 0 : exp;
  return p;
}

export interface EvolvePreview {
  formTo: number; rankTo: string; cost: number; inhAtk: number; inhDef: number;
  baseCardsUsed: number; maxEnhanceCount: number; targetMaxed: boolean; materialMaxed: boolean;
}

export function previewEvolve(target: CardInstance, mat: CardInstance): EvolvePreview {
  if (target.uid === mat.uid) throw new Error('같은 카드를 재료로 쓸 수 없습니다.');
  if (target.cardId !== mat.cardId) throw new Error('진화 재료는 같은 이름의 카드만 가능합니다.');
  if (!canEvolve(target)) throw new Error('더 이상 진화할 수 없습니다.');
  const ts = statsOf(target);
  const ms = statsOf(mat);
  const tm = isMaxed(target);
  const mm = isMaxed(mat);
  const tr = tm ? INHERIT_MAXED : INHERIT_NORMAL;
  const mr = mm ? INHERIT_MAXED : INHERIT_NORMAL;
  const formTo = target.form + 1;
  return {
    formTo,
    rankTo: rankOf({ cardId: target.cardId, form: formTo }),
    cost: evolveCost(RANKS.indexOf(rankOf(target)), target.form),
    inhAtk: Math.round(ts.atk * tr + ms.atk * mr),
    inhDef: Math.round(ts.def * tr + ms.def * mr),
    baseCardsUsed: target.base_cards_used + mat.base_cards_used,
    maxEnhanceCount: target.max_enhance_count + mat.max_enhance_count + (tm ? 1 : 0) + (mm ? 1 : 0),
    targetMaxed: tm,
    materialMaxed: mm,
  };
}

/** 진화 적용: 레벨 초기화, 스탯 일부 계승, 코스트 불변 */
export function applyEvolve(target: CardInstance, mat: CardInstance): EvolvePreview {
  const p = previewEvolve(target, mat);
  target.form = p.formTo;
  target.level = 1;
  target.exp = 0;
  target.inhAtk = p.inhAtk;
  target.inhDef = p.inhDef;
  target.base_cards_used = p.baseCardsUsed;
  target.max_enhance_count = p.maxEnhanceCount;
  target.tradable = target.tradable && mat.tradable;
  return p;
}
