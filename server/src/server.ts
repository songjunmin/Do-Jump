/**
 * Verse8 (Agent8) 게임 서버.
 * 전투·강화·진화·보상 계산은 모두 여기서 한다 (기획서 §9.3: 클라이언트 계산 금지).
 * 클라이언트는 server.remoteFunction('<메서드명>', [인자]) 로 호출하고, 반환된 결과로 연출만 재생한다.
 *
 * 저장소
 *  - 유저 상태: $global.getMyState()/updateMyState() 의 `p` 필드 (PlayerState)
 *  - 결투장 유령 덱: $global 컬렉션 `defense_decks` (id = 계정)
 */
import type { FactionId } from './game/data';
import { PROTOTYPE_MODE } from './game/config';
import * as P from './game/player';
import { tierOf, type Ctx, type Opponent, type PlayerState } from './game/player';

const GHOST_COLLECTION = 'defense_decks';
const WEEKLY_COLLECTION = 'weekly_boss';

interface WeeklyDoc { weekKey: number; typeId: string; name: string; glyph: string; kind: string; hp: number; maxHp: number; power: number; defeatedAt: number | null; engagements: number }

/** 이번 주 공유 보스 문서 (없으면 만든다) */
async function weeklyDoc(c: Ctx): Promise<WeeklyDoc> {
  const wk = P.weekKey(c.now);
  const id = `w${wk}`;
  let found: WeeklyDoc | null = null;
  try { found = (await $global.getCollectionItem(WEEKLY_COLLECTION, id)) as unknown as WeeklyDoc; } catch { found = null; }
  if (found) return found;
  {
    const t = P.weeklyBossType(c.now);
    const doc: WeeklyDoc = { weekKey: wk, typeId: t.id, name: t.name, glyph: t.glyph, kind: t.kind, hp: t.hp, maxHp: t.hp, power: t.power, defeatedAt: null, engagements: 0 };
    try { await $global.addCollectionItem(WEEKLY_COLLECTION, doc, { id }); } catch { /* 동시에 만든 경우 */ }
    return doc;
  }
}

/** 클라이언트에 보내는 주간 보스 요약 */
function weeklyView(d: WeeklyDoc, s: PlayerState, c: Ctx) {
  const endsAt = (d.weekKey + 1) * 7 * 86_400_000 - 3 * 86_400_000 - 9 * 3_600_000;
  return { ...d, endsAt, myDealt: s.weekly.dealt, myEngagements: s.weekly.engagements, claimed: s.weekly.claimed, contribution: d.maxHp ? s.weekly.dealt / d.maxHp : 0, now: c.now };
}

interface GhostDeck { account: string; name: string; score: number; faction: FactionId; deck: Opponent['deck']; updatedAt: number }

function ctx(): Ctx {
  return { now: Date.now(), rng: Math.random };
}

async function load(): Promise<PlayerState | null> {
  const st = await $global.getMyState();
  return (st && st.p) || null;
}

async function loadOrThrow(c: Ctx): Promise<PlayerState> {
  const s = await load();
  if (!s) throw new Error('캐릭터가 없습니다. 먼저 진형을 선택하세요.');
  P.tick(s, c);
  return s;
}

async function save(s: PlayerState) {
  await $global.updateMyState({ p: s });
}

function view(s: PlayerState, c: Ctx) {
  return { state: s, serverTime: c.now };
}

/** 방어 덱이 바뀌거나 점수가 바뀌면 유령 덱 스냅샷을 갱신한다 */
async function publishGhost(s: PlayerState, c: Ctx) {
  const deck = P.activeDeck(s, 'def');
  const item: GhostDeck = { account: $sender.account, name: s.name, score: s.duel.score, faction: s.faction, deck, updatedAt: c.now };
  try {
    await $global.updateCollectionItem(GHOST_COLLECTION, { __id: $sender.account, ...item } as any);
  } catch {
    await $global.addCollectionItem(GHOST_COLLECTION, item, { id: $sender.account });
  }
}

async function ghostOpponents(): Promise<Opponent[]> {
  try {
    const items = (await $global.getCollectionItems(GHOST_COLLECTION, { limit: 200 })) as unknown as GhostDeck[];
    return items
      .filter((g) => g.account && g.account.toLowerCase() !== $sender.account.toLowerCase())
      .map((g) => ({ id: `u:${g.account}`, name: g.name, isBot: false, score: g.score, faction: g.faction, deck: g.deck }));
  } catch {
    return [];
  }
}

export class Server {
  /** 내 상태 조회. 캐릭터가 없으면 state = null */
  async getState() {
    const c = ctx();
    const s = await load();
    if (!s) return { state: null, serverTime: c.now };
    P.tick(s, c);
    await save(s);
    return view(s, c);
  }

  async createPlayer(name: string, faction: FactionId) {
    const c = ctx();
    const existing = await load();
    if (existing) throw new Error('이미 캐릭터가 있습니다.');
    const s = P.createPlayer(String(name || ''), faction, c);
    await save(s);
    await publishGhost(s, c);
    return view(s, c);
  }

  async setFaction(faction: FactionId) {
    const c = ctx();
    const s = await loadOrThrow(c);
    P.setFaction(s, faction);
    await save(s);
    await publishGhost(s, c);
    return view(s, c);
  }

  async allocate(atk: number, def: number, hp = 0) {
    const c = ctx();
    const s = await loadOrThrow(c);
    P.allocate(s, atk, def, hp);
    await save(s);
    return view(s, c);
  }

  async claimReserve() {
    const c = ctx();
    const s = await loadOrThrow(c);
    const amount = P.claimReserve(s);
    await save(s);
    return { ...view(s, c), result: { amount } };
  }

  async useVitality() {
    const c = ctx();
    const s = await loadOrThrow(c);
    P.useVitality(s);
    await save(s);
    return view(s, c);
  }

  async useStardust() {
    const c = ctx();
    const s = await loadOrThrow(c);
    P.useStardust(s);
    await save(s);
    return view(s, c);
  }

  /** 퀘스트 1스텝 (Enter 1회). 결과만 반환하고 클라이언트는 연출만 재생 */
  async questStep(chapter: number, part: number) {
    const c = ctx();
    const s = await loadOrThrow(c);
    const result = P.questStep(s, Number(chapter), Number(part), c);
    await save(s);
    return { ...view(s, c), result };
  }

  /** 은화 뽑기 (1회 / 10회) */
  async gacha(count: number, pack: 'normal' | 'pickup' = 'normal') {
    const c = ctx();
    const s = await loadOrThrow(c);
    const result = P.gacha(s, Number(count), c, pack === 'pickup' ? 'pickup' : 'normal');
    await save(s);
    return { ...view(s, c), result };
  }

  /** 카드 판매 (여러 장 한 번에) */
  async sellCards(uids: string[]) {
    const c = ctx();
    const s = await loadOrThrow(c);
    const result = P.sellCards(s, (uids || []).map(String));
    await save(s);
    await publishGhost(s, c);
    return { ...view(s, c), result };
  }

  /** 장 보스 배틀 (리더 카드 1장, 1회성) */
  async questBoss(chapter: number) {
    const c = ctx();
    const s = await loadOrThrow(c);
    const result = P.questBoss(s, Number(chapter), c);
    await save(s);
    return { ...view(s, c), result };
  }

  async setLeader(uid: string) {
    const c = ctx();
    const s = await loadOrThrow(c);
    P.setLeader(s, String(uid));
    await save(s);
    return view(s, c);
  }

  async protoSupply() {
    const c = ctx();
    const s = await loadOrThrow(c);
    const result = P.protoSupply(s, c);
    await save(s);
    return { ...view(s, c), result };
  }

  async enhance(targetUid: string, materialUids: string[]) {
    const c = ctx();
    const s = await loadOrThrow(c);
    const result = P.enhance(s, String(targetUid), (materialUids || []).map(String));
    await save(s);
    await publishGhost(s, c);
    return { ...view(s, c), result };
  }

  async evolve(targetUid: string, materialUid: string) {
    const c = ctx();
    const s = await loadOrThrow(c);
    const result = P.evolve(s, String(targetUid), String(materialUid));
    await save(s);
    await publishGhost(s, c);
    return { ...view(s, c), result };
  }

  async toggleLock(uid: string) {
    const c = ctx();
    const s = await loadOrThrow(c);
    P.toggleLock(s, String(uid));
    await save(s);
    return view(s, c);
  }

  async saveDeck(presetIdx: number, side: 'atk' | 'def', ids: (string | null)[]) {
    const c = ctx();
    const s = await loadOrThrow(c);
    P.saveDeck(s, Number(presetIdx), side, ids);
    await save(s);
    if (side === 'def' && presetIdx === s.activePreset) await publishGhost(s, c);
    return view(s, c);
  }

  async selectPreset(idx: number) {
    const c = ctx();
    const s = await loadOrThrow(c);
    P.selectPreset(s, Number(idx));
    await save(s);
    await publishGhost(s, c);
    return view(s, c);
  }

  async dismissNotices() {
    const c = ctx();
    const s = await loadOrThrow(c);
    s.notices = [];
    await save(s);
    return view(s, c);
  }

  /** 결투장 1회: 랜덤 매칭 → 서버 판정 → 결과(상대 덱 공개) 반환. API 1콜 */
  async duel() {
    const c = ctx();
    const s = await loadOrThrow(c);
    const pool = [...(await ghostOpponents()), ...P.botOpponents()];
    const opp = P.pickOpponent(s, pool, c);
    const out = P.duelAction(s, opp, c);
    await save(s);
    await publishGhost(s, c);
    return { ...view(s, c), result: { ...out, myTier: tierOf(s.duel.score) } };
  }

  /** 개인 보스 1교전. 교전 전체를 서버가 계산해 결과만 반환 (API 1콜) */
  async raidEngage() {
    const c = ctx();
    const s = await loadOrThrow(c);
    const result = P.raidAction(s, c);
    await save(s);
    return { ...view(s, c), result };
  }

  /** 주간 공유 보스 상태 */
  async weeklyBoss() {
    const c = ctx();
    const s = await loadOrThrow(c);
    const d = await weeklyDoc(c);
    await save(s);
    return { ...view(s, c), result: weeklyView(d, s, c) };
  }

  /** 주간 공유 보스 교전 1회 (입장권 1). 공유 HP를 깎는다 */
  async weeklyEngage() {
    const c = ctx();
    const s = await loadOrThrow(c);
    const d = await weeklyDoc(c);
    const result = P.weeklyAction(s, { hp: d.hp, power: d.power }, c);
    // 저장 직전에 다시 읽어 다른 플레이어의 피해와 합친다
    const latest = await weeklyDoc(c);
    latest.hp = Math.max(0, latest.hp - result.dealt);
    latest.engagements = (latest.engagements || 0) + 1;
    if (latest.hp <= 0 && !latest.defeatedAt) latest.defeatedAt = c.now;
    await $global.updateCollectionItem(WEEKLY_COLLECTION, { __id: `w${latest.weekKey}`, ...latest } as any);
    await save(s);
    return { ...view(s, c), result: { result, boss: weeklyView(latest, s, c) } };
  }

  /** 주간 보스 격파 보상 수령 (기여자 전원) */
  async weeklyClaim() {
    const c = ctx();
    const s = await loadOrThrow(c);
    const d = await weeklyDoc(c);
    const result = P.weeklyClaim(s, d.hp <= 0);
    await save(s);
    return { ...view(s, c), result };
  }

  /** 상점 구매 (결제 연동 전: 프로토타입 무료) */
  async buyShop(item: P.ShopItem) {
    const c = ctx();
    const s = await loadOrThrow(c);
    const result = P.buyShop(s, item);
    await save(s);
    await publishGhost(s, c);
    return { ...view(s, c), result };
  }

  /** 개발용: 내 데이터 초기화 */
  async resetMe() {
    if (!PROTOTYPE_MODE) throw new Error('비활성화된 기능입니다.');
    await $global.updateMyState({ p: null });
    return { state: null, serverTime: Date.now() };
  }
}
