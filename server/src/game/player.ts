// 플레이어 상태와 행동. 순수 함수로 두고 server.ts가 저장·불러오기만 맡는다.
import * as C from './config';
import { BOSSES, BOTS, CARDS, CARD_MAP, type FactionId } from './data';
import { displayName, isMaxed, master, newInstance, rankOf, toBattleCard, type BattleCard, type CardInstance } from './cards';
import { applyEnhance, applyEvolve } from './growth';
import { duel as runDuel, raidEngage as runRaid, type DuelResult, type RaidResult, type Rng } from './engine';

export type DeckIds = (string | null)[];
export interface Preset { name: string; atk: DeckIds; def: DeckIds }

export interface PersonalBoss { typeId: string; name: string; kind: string; glyph: string; hp: number; maxHp: number; power: number; spawnedAt: number; expiresAt: number; dealtByMe: number }

export interface PlayerState {
  v: 1;
  name: string;
  faction: FactionId;
  level: number;
  exp: number;
  statPoints: number;
  atkCost: number;
  defCost: number;
  stamina: number;
  staminaAt: number;
  staminaReserve: number;
  tickets: number;
  ticketAt: number;
  silver: number;
  stardust: number;
  vitality: number;
  shards: { HR: number; SR: number; SSR: number };
  cards: CardInstance[];
  seq: number;
  presets: Preset[];
  activePreset: number;
  quest: { chapter: number; part: number; step: number; actions: number };
  duel: { score: number; weekKey: number; bestTier: number; dayKey: number; used: number; wins: number; losses: number; recent: Record<string, number> };
  raid: { boss: PersonalBoss | null; kills: number; engagements: number };
  flags: { evolveHintShown: boolean };
  notices: string[];
  createdAt: number;
}

export interface Ctx { now: number; rng: Rng }

const emptyDeck = (): DeckIds => [null, null, null, null, null];
const dayKey = (now: number) => Math.floor((now + C.TZ_OFFSET_MS) / 86_400_000);
/** 월요일 00:00 (KST) 기준 주 번호. 1970-01-01은 목요일 → +3일 보정 */
const weekKey = (now: number) => Math.floor((dayKey(now) + 3) / 7);

export const tierOf = (score: number) => {
  let t = 0;
  C.TIERS.forEach((x, i) => { if (score >= x.min) t = i; });
  return t;
};
export const staminaMax = (s: PlayerState) => C.STAMINA_BASE_MAX + C.STAMINA_PER_LEVEL * (s.level - 1);

function grantCard(s: PlayerState, cardId: string, now: number, form = 1, level = 1): CardInstance | null {
  if (s.cards.length >= C.INVENTORY_CAP) return null;
  const inst = newInstance(cardId, `c${++s.seq}`, now, form, level);
  s.cards.push(inst);
  return inst;
}

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length) % arr.length];
const cardsOf = (rank: string, faction?: FactionId) =>
  CARDS.filter((c) => c.rank === rank && (!faction || c.faction === faction)).map((c) => c.id);

export function createPlayer(name: string, faction: FactionId, ctx: Ctx): PlayerState {
  if (faction !== 'dawn' && faction !== 'dusk') throw new Error('진형을 선택하세요.');
  const s: PlayerState = {
    v: 1, name: (name || '모험가').slice(0, 12), faction, level: 1, exp: 0, statPoints: 0,
    atkCost: C.START_COST, defCost: C.START_COST,
    stamina: C.STAMINA_BASE_MAX, staminaAt: ctx.now, staminaReserve: 0,
    tickets: C.TICKET_CAP, ticketAt: ctx.now,
    silver: 30_000, stardust: 1, vitality: 1, shards: { HR: 0, SR: 0, SSR: 0 },
    cards: [], seq: 0,
    presets: [0, 1, 2].map((i) => ({ name: ['결투장', '레이드', '예비'][i], atk: emptyDeck(), def: emptyDeck() })),
    activePreset: 0,
    quest: { chapter: 1, part: 1, step: 0, actions: 0 },
    duel: { score: 0, weekKey: weekKey(ctx.now), bestTier: 0, dayKey: dayKey(ctx.now), used: 0, wins: 0, losses: 0, recent: {} },
    raid: { boss: null, kills: 0, engagements: 0 },
    flags: { evolveHintShown: false },
    notices: [],
    createdAt: ctx.now,
  };
  // 진형별 샘플 덱 (§7): R 카드 + 진화 체험용 같은 카드 4장 + 도시락
  const starter: Record<FactionId, { give: string[]; atk: number[]; def: number[] }> = {
    // 인덱스는 give 배열 기준. 0번 카드의 사본(1~3번)은 덱에 넣지 않고 진화 재료로 남긴다
    dawn: { give: ['r_lancer', 'r_lancer', 'r_lancer', 'r_lancer', 'r_nun', 'r_archer', 'r_paladin'], atk: [5, 6, 0, 4], def: [6, 5, 4, 0] },
    dusk: { give: ['r_venom', 'r_venom', 'r_venom', 'r_venom', 'r_raven', 'r_ironmask', 'r_ironmask'], atk: [4, 5, 0, 6], def: [5, 4, 6, 0] },
  };
  const st = starter[faction];
  const given = st.give.map((id) => grantCard(s, id, ctx.now)!.uid);
  for (const id of cardsOf('N')) grantCard(s, id, ctx.now);
  for (const id of cardsOf('N', faction)) grantCard(s, id, ctx.now);
  // 3번 슬롯(확정 발동)에 스킬 카드를 둔다
  const toDeck = (idx: number[]): DeckIds => [given[idx[0]], given[idx[1]], given[idx[2]], given[idx[3]], null];
  for (const p of [s.presets[0], s.presets[1]]) { p.atk = toDeck(st.atk); p.def = toDeck(st.def); }
  spawnBoss(s, ctx);
  return s;
}

/** 시간 경과 회복·리셋을 반영한다. 매 호출 시작 시 실행 */
export function tick(s: PlayerState, ctx: Ctx): void {
  const now = ctx.now;
  // 체력: 1분당 1, 상한 초과분은 예비 풀로
  const gained = Math.floor((now - s.staminaAt) / C.STAMINA_REGEN_MS);
  if (gained > 0) {
    s.staminaAt += gained * C.STAMINA_REGEN_MS;
    const max = staminaMax(s);
    const room = Math.max(0, max - s.stamina);
    const toMain = Math.min(room, gained);
    s.stamina += toMain;
    s.staminaReserve = Math.min(C.STAMINA_RESERVE_MAX, s.staminaReserve + (gained - toMain));
  }
  // 보스 입장권: 3시간당 1, 상한 10 (별가루로 초과 보유한 분은 유지)
  if (s.tickets >= C.TICKET_CAP) s.ticketAt = now;
  else {
    const t = Math.floor((now - s.ticketAt) / C.TICKET_REGEN_MS);
    if (t > 0) { s.tickets = Math.min(C.TICKET_CAP, s.tickets + t); s.ticketAt += t * C.TICKET_REGEN_MS; }
  }
  // 결투장 일일 시도
  const dk = dayKey(now);
  if (s.duel.dayKey !== dk) { s.duel.dayKey = dk; s.duel.used = 0; }
  // 주간 리셋: 최고 도달 티어 보상 1회 + 점수 소프트 회귀
  const wk = weekKey(now);
  if (s.duel.weekKey !== wk) {
    const reward = (s.duel.bestTier + 1) * 5_000;
    s.silver += reward;
    s.notices.push(`지난주 결투장 최고 티어 ${C.TIERS[s.duel.bestTier].name} 보상: 은화 ${reward.toLocaleString()}`);
    const t = tierOf(s.duel.score);
    s.duel.score = Math.floor((s.duel.score + C.TIERS[t].min) / 2);
    s.duel.bestTier = tierOf(s.duel.score);
    s.duel.weekKey = wk;
  }
  // 개인 보스 72시간 창구
  if (s.raid.boss && now > s.raid.boss.expiresAt) {
    s.notices.push(`${s.raid.boss.name}이(가) 떠났습니다.`);
    spawnBoss(s, ctx);
  }
  for (const k of Object.keys(s.duel.recent)) if (now - s.duel.recent[k] > C.DUEL_REMATCH_BLOCK_MS) delete s.duel.recent[k];
}

function spawnBoss(s: PlayerState, ctx: Ctx) {
  const b = BOSSES[s.raid.kills % BOSSES.length];
  const scale = 1 + 0.25 * Math.min(8, s.raid.kills);
  const hp = Math.round(b.hp * scale);
  s.raid.boss = { typeId: b.id, name: b.name, kind: b.kind, glyph: b.glyph, hp, maxHp: hp, power: b.power, spawnedAt: ctx.now, expiresAt: ctx.now + C.PERSONAL_BOSS_WINDOW_MS, dealtByMe: 0 };
}

const findCard = (s: PlayerState, uid: string) => {
  const c = s.cards.find((x) => x.uid === uid);
  if (!c) throw new Error('카드를 찾을 수 없습니다.');
  return c;
};

export function cardsInDecks(s: PlayerState): Set<string> {
  const set = new Set<string>();
  for (const p of s.presets) for (const id of [...p.atk, ...p.def]) if (id) set.add(id);
  return set;
}

function removeCards(s: PlayerState, uids: string[]) {
  const set = new Set(uids);
  s.cards = s.cards.filter((c) => !set.has(c.uid));
}

function assertMaterial(s: PlayerState, mat: CardInstance) {
  if (mat.locked) throw new Error(`${master(mat.cardId).name}은(는) 보호 중인 카드입니다.`);
  if (cardsInDecks(s).has(mat.uid)) throw new Error(`${master(mat.cardId).name}은(는) 덱에 편성된 카드입니다.`);
}

export function enhance(s: PlayerState, targetUid: string, materialUids: string[]) {
  const target = findCard(s, targetUid);
  const uniq = Array.from(new Set(materialUids));
  if (uniq.includes(targetUid)) throw new Error('강화 대상을 재료로 쓸 수 없습니다.');
  const mats = uniq.map((u) => findCard(s, u));
  mats.forEach((m) => assertMaterial(s, m));
  const cost = C.enhanceCost(target.level, mats.length);
  if (s.silver < cost) throw new Error(`은화가 부족합니다. (필요 ${cost.toLocaleString()})`);
  const p = applyEnhance(target, mats);
  s.silver -= cost;
  removeCards(s, uniq);
  return p;
}

export function evolve(s: PlayerState, targetUid: string, matUid: string) {
  const target = findCard(s, targetUid);
  const mat = findCard(s, matUid);
  assertMaterial(s, mat);
  const showHint = !s.flags.evolveHintShown && !isMaxed(target);
  const cost = C.evolveCost(C.RANKS.indexOf(rankOf(target)), target.form);
  if (s.silver < cost) throw new Error(`은화가 부족합니다. (필요 ${cost.toLocaleString()})`);
  const p = applyEvolve(target, mat);
  s.silver -= cost;
  removeCards(s, [matUid]);
  if (showHint) s.flags.evolveHintShown = true;
  return { ...p, showHint };
}

export function toggleLock(s: PlayerState, uid: string) {
  const c = findCard(s, uid);
  c.locked = !c.locked;
}

export function deckCost(s: PlayerState, ids: DeckIds) {
  return ids.reduce((a, id) => a + (id ? master(findCard(s, id).cardId).cost : 0), 0);
}

export function saveDeck(s: PlayerState, presetIdx: number, side: 'atk' | 'def', ids: DeckIds) {
  if (!(presetIdx >= 0 && presetIdx < C.PRESET_COUNT)) throw new Error('잘못된 프리셋입니다.');
  if (side !== 'atk' && side !== 'def') throw new Error('잘못된 덱 종류입니다.');
  if (!Array.isArray(ids) || ids.length !== C.DECK_SIZE) throw new Error('덱은 5칸입니다.');
  const clean = ids.map((x) => (x ? String(x) : null));
  const used = clean.filter(Boolean) as string[];
  if (new Set(used).size !== used.length) throw new Error('같은 카드를 한 덱에 두 번 넣을 수 없습니다.');
  used.forEach((u) => findCard(s, u));
  const cost = deckCost(s, clean);
  const limit = side === 'atk' ? s.atkCost : s.defCost;
  if (cost > limit) throw new Error(`${side === 'atk' ? '공격' : '방어'} 코스트 초과 (${cost} / ${limit})`);
  s.presets[presetIdx][side] = clean;
}

export function selectPreset(s: PlayerState, idx: number) {
  if (!(idx >= 0 && idx < C.PRESET_COUNT)) throw new Error('잘못된 프리셋입니다.');
  s.activePreset = idx;
}

export function allocate(s: PlayerState, atk: number, def: number) {
  atk = Math.max(0, Math.floor(atk || 0));
  def = Math.max(0, Math.floor(def || 0));
  if (atk + def === 0) throw new Error('분배할 포인트를 입력하세요.');
  if (atk + def > s.statPoints) throw new Error('포인트가 부족합니다.');
  s.statPoints -= atk + def;
  s.atkCost += atk;
  s.defCost += def;
}

export function setFaction(s: PlayerState, f: FactionId) {
  if (f !== 'dawn' && f !== 'dusk') throw new Error('잘못된 진형입니다.');
  if (s.level >= 10) throw new Error('레벨 10 이후 진형 변경은 아직 지원하지 않습니다.');
  s.faction = f;
}

export function claimReserve(s: PlayerState) {
  const room = staminaMax(s) - s.stamina;
  if (s.staminaReserve <= 0) throw new Error('예비 체력이 없습니다.');
  if (room <= 0) throw new Error('체력이 가득 찼습니다.');
  const take = Math.min(room, s.staminaReserve);
  s.stamina += take;
  s.staminaReserve -= take;
  return take;
}

export function useVitality(s: PlayerState) {
  if (s.vitality <= 0) throw new Error('활력수가 없습니다.');
  if (s.stamina >= staminaMax(s)) throw new Error('체력이 가득 찼습니다.');
  s.vitality--;
  s.stamina = staminaMax(s);
}

export function useStardust(s: PlayerState) {
  if (s.stardust <= 0) throw new Error('별가루가 없습니다.');
  if (s.tickets + C.STARDUST_TICKETS > C.TICKET_HARD_CAP) throw new Error(`입장권은 최대 ${C.TICKET_HARD_CAP}장까지 보유할 수 있습니다.`);
  s.stardust--;
  s.tickets += C.STARDUST_TICKETS;
}

function addPlayerExp(s: PlayerState, exp: number): number {
  let ups = 0;
  s.exp += exp;
  while (s.exp >= C.playerExpToNext(s.level)) {
    s.exp -= C.playerExpToNext(s.level);
    s.level++;
    s.statPoints += C.POINTS_PER_LEVEL;
    ups++;
  }
  return ups;
}

/** 퀘스트 행동 1회 (§5.1) */
export function questStep(s: PlayerState, ctx: Ctx) {
  if (s.stamina < C.QUEST_STAMINA) throw new Error('체력이 부족합니다.');
  s.stamina -= C.QUEST_STAMINA;
  s.quest.actions++;
  s.quest.step++;
  const silver = C.QUEST_STAMINA * C.QUEST_SILVER_PER_STAMINA;
  s.silver += silver;
  const levelUps = addPlayerExp(s, C.QUEST_STAMINA);
  const out: { silver: number; levelUps: number; card?: string; cardName?: string; partClear?: boolean; chapterClear?: boolean; vitality?: number; full?: boolean } = { silver, levelUps };
  // 3~5회마다 카드 보상. 장이 진행될수록 상위 등급
  if (s.quest.actions % C.QUEST_REWARD_EVERY === 0) {
    const ch = s.quest.chapter;
    const rRate = Math.min(0.3, 0.05 * ch);
    const id = ctx.rng() < rRate ? pick(cardsOf('R'), ctx.rng) : pick(cardsOf('N'), ctx.rng);
    const inst = grantCard(s, id, ctx.now);
    if (inst) { out.card = inst.uid; out.cardName = displayName(inst); } else out.full = true;
  }
  if (s.quest.step >= C.QUEST_STEPS_PER_PART) {
    s.quest.step = 0;
    s.statPoints += C.POINTS_PER_PART;
    out.partClear = true;
    s.quest.part++;
    if (s.quest.part > C.QUEST_PARTS_PER_CHAPTER) {
      s.quest.part = 1;
      s.quest.chapter++;
      s.vitality++;
      out.chapterClear = true;
      out.vitality = 1;
      // 금색 보상칸: 상위 등급 카드 확정
      const inst = grantCard(s, pick(s.quest.chapter >= 4 ? cardsOf('HR') : cardsOf('R'), ctx.rng), ctx.now);
      if (inst) { out.card = inst.uid; out.cardName = displayName(inst); }
    }
  }
  return out;
}

/** 프로토타입 전용: 성장 사이클을 빠르게 확인하기 위한 보급 */
export function protoSupply(s: PlayerState, ctx: Ctx) {
  if (!C.PROTOTYPE_MODE) throw new Error('테스트 보급은 비활성화되어 있습니다.');
  const got: string[] = [];
  for (let i = 0; i < 6; i++) { const c = grantCard(s, pick(cardsOf('N'), ctx.rng), ctx.now); if (c) got.push(c.uid); }
  const r = grantCard(s, pick(cardsOf('R'), ctx.rng), ctx.now); if (r) got.push(r.uid);
  if (ctx.rng() < 0.35) { const h = grantCard(s, pick(cardsOf('HR'), ctx.rng), ctx.now); if (h) got.push(h.uid); }
  s.silver += 50_000;
  s.stardust += 1;
  s.vitality += 1;
  return { cards: got, names: got.map((u) => displayName(s.cards.find((c) => c.uid === u)!)) };
}

export function activeDeck(s: PlayerState, side: 'atk' | 'def'): (BattleCard | null)[] {
  const ids = s.presets[s.activePreset][side];
  return ids.map((id) => {
    const c = id ? s.cards.find((x) => x.uid === id) : null;
    return c ? toBattleCard(c) : null;
  });
}

export const deckIsEmpty = (d: (BattleCard | null)[]) => d.every((x) => !x);

/** 결투장 상대 후보 */
export interface Opponent { id: string; name: string; isBot: boolean; score: number; faction: FactionId; deck: (BattleCard | null)[] }

export function botOpponents(): Opponent[] {
  return BOTS.map((b) => ({
    id: b.id, name: `[봇] ${b.name}`, isBot: true, score: C.TIERS[b.tier].min + 150, faction: b.faction,
    deck: b.deck.map(([cardId, form, level], i) => {
      if (!CARD_MAP[cardId]) return null;
      const inst = newInstance(cardId, `${b.id}_${i}`, 0, form, level);
      // 봇 카드는 적당한 진화식(4-2 수준)을 가정해 계승분을 근사한다
      const cap = C.LEVEL_CAP[rankOf(inst)];
      inst.level = Math.min(level, cap);
      return toBattleCard(inst);
    }),
  }));
}

export function pickOpponent(s: PlayerState, pool: Opponent[], ctx: Ctx): Opponent {
  const myTier = tierOf(s.duel.score);
  const inRange = pool.filter((o) => Math.abs(tierOf(o.score) - myTier) <= 1 && !deckIsEmpty(o.deck));
  const fresh = inRange.filter((o) => !s.duel.recent[o.id]);
  const list = fresh.length ? fresh : inRange.length ? inRange : pool;
  return pick(list, ctx.rng);
}

export function duelAction(s: PlayerState, opp: Opponent, ctx: Ctx): { result: DuelResult; delta: number; opponent: { name: string; isBot: boolean; score: number; tier: number } } {
  if (s.duel.used >= C.DUEL_DAILY_ATTEMPTS) throw new Error('오늘 결투장 시도를 모두 사용했습니다.');
  const atk = activeDeck(s, 'atk');
  if (deckIsEmpty(atk)) throw new Error('공격 덱을 먼저 편성하세요.');
  const result = runDuel(atk, s.faction, opp.deck, opp.faction, ctx.rng);
  const adj = Math.max(-5, Math.min(5, Math.round((opp.score - s.duel.score) / 40)));
  const delta = result.win ? 25 + adj : -(20 - adj);
  // 하방 보호: 이번 주 최고 티어 시작점 아래로 내려가지 않는다
  const floor = C.TIERS[s.duel.bestTier].min;
  s.duel.score = Math.max(floor, s.duel.score + delta);
  s.duel.bestTier = Math.max(s.duel.bestTier, tierOf(s.duel.score));
  s.duel.used++;
  if (result.win) { s.duel.wins++; s.silver += 2_000; } else s.duel.losses++;
  s.duel.recent[opp.id] = ctx.now;
  return { result, delta, opponent: { name: opp.name, isBot: opp.isBot, score: opp.score, tier: tierOf(opp.score) } };
}

export function raidAction(s: PlayerState, ctx: Ctx): { result: RaidResult; reward?: { silver: number; card?: string; cardName?: string } } {
  if (!s.raid.boss) spawnBoss(s, ctx);
  const boss = s.raid.boss!;
  if (s.tickets <= 0) throw new Error('보스 입장권이 없습니다.');
  const atk = activeDeck(s, 'atk');
  const def = activeDeck(s, 'def');
  if (deckIsEmpty(atk) || deckIsEmpty(def)) throw new Error('공격 덱과 방어 덱을 모두 편성하세요.');
  if (s.tickets >= C.TICKET_CAP) s.ticketAt = ctx.now; // 상한에서 내려올 때 회복 타이머 시작
  s.tickets--;
  const result = runRaid(atk, def, s.faction, { hp: boss.hp, power: boss.power }, ctx.rng);
  boss.hp = result.bossHpAfter;
  boss.dealtByMe += result.dealt;
  s.raid.engagements++;
  let reward: { silver: number; card?: string; cardName?: string } | undefined;
  if (result.killed) {
    s.raid.kills++;
    reward = { silver: 20_000 };
    s.silver += reward.silver;
    const inst = grantCard(s, pick(ctx.rng() < 0.3 ? cardsOf('HR') : cardsOf('R'), ctx.rng), ctx.now);
    if (inst) { reward.card = inst.uid; reward.cardName = displayName(inst); }
    spawnBoss(s, ctx);
  }
  return { result, reward };
}
