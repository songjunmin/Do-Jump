// 전투 엔진 (§3). 서버에서만 호출한다. 클라이언트는 결과를 받아 연출만 재생한다.
import { FACTION_BONUS, LEADER_MAX_TURNS, MAX_SKILLS_APPLIED, SLOT_CHANCE, SLOT_PRIORITY } from './config';
import { SKILLS, type FactionId, type SkillType } from './data';
import type { BattleCard } from './cards';

export type Rng = () => number;

export interface SkillRoll {
  slot: number; // 0-based
  skillId: string;
  skillName: string;
  chance: number;
  triggered: boolean;
  applied: boolean;
  /** 발동했지만 적용되지 않은 이유 */
  blocked?: 'cap' | 'duplicate';
}

export interface SideResult {
  deck: (BattleCard | null)[];
  faction: FactionId | null;
  rolls: SkillRoll[];
  applied: string[];
  base: number;
  mult: number;
  total: number;
}

/** 슬롯별 확률로 스킬을 굴린다. 최대 3개, 같은 스킬명은 1회만 (§3.2) */
export function rollSkills(deck: (BattleCard | null)[], rng: Rng): { rolls: SkillRoll[]; applied: string[] } {
  const rolls: SkillRoll[] = [];
  deck.forEach((card, slot) => {
    if (!card || !card.skill) return;
    const s = SKILLS[card.skill];
    if (!s) return;
    const chance = SLOT_CHANCE[slot] ?? 0;
    rolls.push({ slot, skillId: s.id, skillName: s.name, chance, triggered: rng() < chance, applied: false });
  });
  const applied: string[] = [];
  const names = new Set<string>();
  for (const slot of SLOT_PRIORITY) {
    const r = rolls.find((x) => x.slot === slot);
    if (!r || !r.triggered) continue;
    if (names.has(r.skillName)) { r.blocked = 'duplicate'; continue; }
    if (applied.length >= MAX_SKILLS_APPLIED) { r.blocked = 'cap'; continue; }
    r.applied = true;
    names.add(r.skillName);
    applied.push(r.skillId);
  }
  return { rolls, applied };
}

const sumSkill = (applied: string[], type: SkillType) =>
  applied.reduce((a, id) => a + (SKILLS[id]?.type === type ? SKILLS[id].value : 0), 0);

/** 소속 진형 일치 카드 장당 +3% (플랫) */
function baseTotal(deck: (BattleCard | null)[], faction: FactionId | null, stat: 'atk' | 'def'): number {
  let sum = 0;
  for (const card of deck) {
    if (!card) continue;
    const bonus = faction && card.faction === faction ? 1 + FACTION_BONUS : 1;
    sum += card[stat] * bonus;
  }
  return Math.round(sum);
}

export interface DuelResult {
  attacker: SideResult;
  defender: SideResult;
  win: boolean;
}

/** 결투장 판정: 공격 총합 > 방어 총합이면 승리, 동점은 방어 승 (§3.3) */
export function duel(
  atkDeck: (BattleCard | null)[], atkFaction: FactionId | null,
  defDeck: (BattleCard | null)[], defFaction: FactionId | null,
  rng: Rng = Math.random,
): DuelResult {
  const a = rollSkills(atkDeck, rng);
  const d = rollSkills(defDeck, rng);
  const atkBase = baseTotal(atkDeck, atkFaction, 'atk');
  const defBase = baseTotal(defDeck, defFaction, 'def');
  const atkMult = 1 + sumSkill(a.applied, 'ATK_UP');
  const defMult = Math.max(0, 1 + sumSkill(d.applied, 'DEF_UP') - sumSkill(a.applied, 'ENEMY_DEF_DOWN'));
  const atkTotal = Math.round(atkBase * atkMult);
  const defTotal = Math.round(defBase * defMult);
  return {
    attacker: { deck: atkDeck, faction: atkFaction, rolls: a.rolls, applied: a.applied, base: atkBase, mult: atkMult, total: atkTotal },
    defender: { deck: defDeck, faction: defFaction, rolls: d.rolls, applied: d.applied, base: defBase, mult: defMult, total: defTotal },
    win: atkTotal > defTotal,
  };
}

export interface RaidResult {
  attack: SideResult;
  defense: SideResult;
  bossPower: number;
  bossHpBefore: number;
  bossHpAfter: number;
  /** 교환 횟수 */
  hits: number;
  dealt: number;
  killed: boolean;
  /** 교환별 기록 (연출용) */
  timeline: { dealt: number; bossHp: number; pool: number }[];
}

/**
 * 레이드 1교전 (§3.4). 스킬은 교전 시작 시 1회만 굴리고 이후는 결정론적.
 * 공격 먼저 → 보스 반격 → 방어도 0 이하면 퇴각.
 */
export function raidEngage(
  atkDeck: (BattleCard | null)[], defDeck: (BattleCard | null)[], faction: FactionId | null,
  boss: { hp: number; power: number }, rng: Rng = Math.random,
): RaidResult {
  const a = rollSkills(atkDeck, rng);
  const d = rollSkills(defDeck, rng);
  const atkBase = baseTotal(atkDeck, faction, 'atk');
  const defBase = baseTotal(defDeck, faction, 'def');
  // 레이드에서는 '상대 방어 하향'을 피해 증가로 취급한다
  const atkMult = 1 + sumSkill(a.applied, 'ATK_UP') + sumSkill(a.applied, 'ENEMY_DEF_DOWN');
  const defMult = 1 + sumSkill(d.applied, 'DEF_UP');
  const atk = Math.round(atkBase * atkMult);
  let pool = Math.round(defBase * defMult);
  const poolStart = pool;
  let hp = boss.hp;
  let dealt = 0;
  let hits = 0;
  const timeline: RaidResult['timeline'] = [];
  if (atk > 0) {
    while (pool > 0 && hp > 0) {
      const hit = Math.min(atk, hp);
      hp -= hit;
      dealt += hit;
      hits++;
      if (hp > 0) pool -= boss.power;
      timeline.push({ dealt: hit, bossHp: hp, pool: Math.max(0, pool) });
    }
  }
  return {
    attack: { deck: atkDeck, faction, rolls: a.rolls, applied: a.applied, base: atkBase, mult: atkMult, total: atk },
    defense: { deck: defDeck, faction, rolls: d.rolls, applied: d.applied, base: defBase, mult: defMult, total: poolStart },
    bossPower: boss.power, bossHpBefore: boss.hp, bossHpAfter: hp, hits, dealt, killed: hp <= 0, timeline,
  };
}

export interface LeaderBattleResult {
  leader: BattleCard;
  leaderHp: number;
  bossHp: number;
  win: boolean;
  turns: { by: 'leader' | 'boss'; dmg: number; leaderHp: number; bossHp: number }[];
}

/**
 * 퀘스트 장 보스전: 리더 카드 1장 vs 보스, 자동 턴제.
 * 리더 체력 = 방어력 × 3. 리더가 먼저 공격하고, 정해진 턴 안에 쓰러뜨리지 못하면 패배.
 */
export function leaderBattle(leader: BattleCard, boss: { hp: number; atk: number }): LeaderBattleResult {
  // 리더 HP = 방어력. 리더 공격 먼저 → 보스 반격 반복, 스킬 없음
  let lhp = leader.def;
  let bhp = boss.hp;
  const turns: LeaderBattleResult['turns'] = [];
  for (let i = 0; i < LEADER_MAX_TURNS && lhp > 0 && bhp > 0; i++) {
    const d = Math.min(leader.atk, bhp);
    bhp -= d;
    turns.push({ by: 'leader', dmg: d, leaderHp: lhp, bossHp: bhp });
    if (bhp <= 0) break;
    const e = Math.min(boss.atk, lhp);
    lhp -= e;
    turns.push({ by: 'boss', dmg: e, leaderHp: lhp, bossHp: bhp });
  }
  return { leader, leaderHp: leader.def, bossHp: boss.hp, win: bhp <= 0, turns };
}
