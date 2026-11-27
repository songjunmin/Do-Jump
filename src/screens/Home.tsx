// 홈: 내 전력(리더 + 공격 덱) · 오늘 할 일 · 바로가기 · 할 일이 있을 때만 뜨는 카드
import { useMemo, useState } from 'react';
import type { Run, Tab } from '../App';
import type { CardsIntent } from './Cards';
import { CardDetail } from './Cards';
import { cardsInDecks, chapterAllCleared, deckCost, leaderCard, type PlayerState } from '../../server/src/game/player';
import * as C from '../../server/src/game/config';
import { displayName, levelCap, master, rankOf, statsOf, type CardInstance } from '../../server/src/game/cards';
import { CURRENCY, FACTIONS, type FactionId } from '../../server/src/game/data';
import { CHAPTERS, partKey } from '../../server/src/game/questData';
import { fxOf } from '../ui/fx';
import { CardView, Modal, fmt } from '../ui/common';

type Say = (m: string, e?: boolean) => void;
type Go = (t: Tab, intent?: CardsIntent) => void;

const hoursLeft = (ms: number) => {
  const h = Math.max(0, ms) / 3_600_000;
  return h >= 1 ? `${Math.floor(h)}시간 ${Math.floor((h % 1) * 60)}분` : `${Math.ceil(h * 60)}분`;
};

/** 퀘스트 현재 위치 한 줄 */
function questNow(s: PlayerState): string {
  const ch = CHAPTERS.find((c) => c.id === Math.min(s.quest.unlocked, CHAPTERS.length))!;
  const i = ch.parts.findIndex((_, k) => !s.quest.cleared[partKey(ch.id, k + 1)]);
  if (i >= 0) {
    const pct = s.quest.progress[partKey(ch.id, i + 1)] ?? 0;
    return `제${ch.id}장 ${ch.id}-${i + 1} ${pct > 0 ? `진행 중 ${pct}%` : '도전 전'}`;
  }
  if (chapterAllCleared(s, ch) && !s.quest.bossCleared[String(ch.id)]) return `제${ch.id}장 보스 도전 가능`;
  return '모든 장 클리어';
}

export default function Home({ s, run, busy, say, go }: { s: PlayerState; run: Run; busy: boolean; say: Say; go: Go }) {
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [gacha, setGacha] = useState(false);
  const inDeck = useMemo(() => cardsInDecks(s), [s]);
  const leader = leaderCard(s);
  const preset = s.presets[s.activePreset];
  const deck = preset.atk.map((id) => (id ? s.cards.find((c) => c.uid === id) ?? null : null));
  const open = s.cards.find((c) => c.uid === openUid) || null;
  const boss = s.raid.boss;
  const contrib = boss ? Math.round((boss.dealtByMe / boss.maxHp) * 100) : 0;
  const bossLeft = boss ? boss.expiresAt - Date.now() : Infinity;

  const todos: { label: string; value: string; tab: Tab; done?: boolean }[] = [
    { label: '결투장', value: `${s.duel.used} / ${C.DUEL_DAILY_ATTEMPTS} 시도`, tab: 'duel', done: s.duel.used >= C.DUEL_DAILY_ATTEMPTS },
    { label: '보스 입장권', value: `${s.tickets} / ${C.TICKET_CAP}`, tab: 'raid', done: s.tickets <= 0 },
    { label: '레이드 보스', value: boss ? `${boss.glyph} 내 기여 ${contrib}%` : '대기 중', tab: 'raid' },
    { label: '퀘스트', value: questNow(s), tab: 'quest' },
  ];

  return (
    <div>
      {/* 1. 리더 카드 + 공격 덱 */}
      <div className="panel home-hero">
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 112, flex: 'none' }}>
            {leader ? <CardView c={leader} inDeck={inDeck.has(leader.uid)} onClick={() => setOpenUid(leader.uid)} /> : <button className="card empty" style={{ width: '100%' }} onClick={() => go('cards')}>리더 지정</button>}
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="muted small">리더 카드</div>
            <div className="hero-name">{leader ? displayName(leader) : '리더 없음'}</div>
            {leader && (
              <>
                <div className="small muted">{rankOf(leader)} · {FACTIONS[master(leader.cardId).faction].name} · Lv {leader.level}/{levelCap(leader)}</div>
                <div className="hero-stats"><span>공 <b className="a">{fmt(statsOf(leader).atk)}</b></span><span>방 <b className="d">{fmt(statsOf(leader).def)}</b></span></div>
                <div className="small" style={{ color: fxOf(leader.cardId).color }}>{fxOf(leader.cardId).glyph} {fxOf(leader.cardId).name}</div>
              </>
            )}
            <div className="small muted" style={{ marginTop: 6 }}>코스트 공격 <b style={{ color: 'var(--atk)' }}>{s.atkCost}</b> · 방어 <b style={{ color: 'var(--def)' }}>{s.defCost}</b></div>
          </div>
        </div>
        <div className="row between" style={{ marginTop: 12 }}>
          <span className="small"><b>공격 덱</b> <span className="muted">{preset.name} · 코스트 {deckCost(s, preset.atk)}/{s.atkCost}</span></span>
          <button className="btn sm" onClick={() => go('deck')}>덱 편집</button>
        </div>
        <div className="dthumbs">
          {deck.map((c, i) => c ? <DeckThumb key={i} c={c} slot={i + 1} onClick={() => setOpenUid(c.uid)} /> : <button key={i} className="dthumb empty" onClick={() => go('deck')}><span className="slot">{i + 1}</span>+</button>)}
        </div>
      </div>

      {/* 4. 조건부: 할 일이 있을 때만 */}
      {s.statPoints > 0 && <AllocateCard s={s} run={run} busy={busy} />}
      {s.staminaReserve > 0 && (
        <button className="panel alert-card" disabled={busy} onClick={async () => { const r = await run<any>('claimReserve'); if (r) say(`예비 체력 ${r.amount} 수령`); }}>
          <span>🔋 예비 체력 <b>{s.staminaReserve}</b> 수령</span><span className="muted small">체력이 가득 찬 동안 쌓인 체력</span>
        </button>
      )}
      {boss && bossLeft < 24 * 3_600_000 && (
        <button className="panel alert-card warn" onClick={() => go('raid')}>
          <span>⏳ {boss.name} 마감 {hoursLeft(bossLeft)} 전</span><span className="muted small">떠나기 전에 처치하세요 · 내 기여 {contrib}%</span>
        </button>
      )}

      {/* 2. 오늘 할 일 */}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>오늘 할 일</h2>
        <div className="todos">
          {todos.map((t) => (
            <button key={t.label} className={`todo${t.done ? ' done' : ''}`} onClick={() => go(t.tab)}>
              <span>{t.label}</span><b>{t.value}</b><span className="chev">›</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. 바로가기 */}
      <div className="shortcuts">
        <button onClick={() => go('quest')}><span className="ic">🗺</span>퀘스트<small>{questNow(s)}</small></button>
        <button onClick={() => go('cards', { pick: 'enhance' })}><span className="ic">⚒</span>강화<small>카드 레벨 올리기</small></button>
        <button onClick={() => go('cards', { pick: 'evolve' })}><span className="ic">✦</span>진화<small>같은 카드 2장 합치기</small></button>
        <button onClick={() => setGacha(true)}><span className="ic">🎴</span>뽑기<small>{CURRENCY.silver.name} {fmt(C.GACHA_COST)} / 회</small></button>
      </div>

      {C.PROTOTYPE_MODE && <ProtoTools s={s} run={run} busy={busy} say={say} />}

      {open && <CardDetail key={open.uid} c={open} s={s} run={run} busy={busy} say={say} inDeck={inDeck} onClose={() => setOpenUid(null)} />}
      {gacha && <Gacha s={s} run={run} busy={busy} onClose={() => setGacha(false)} />}
    </div>
  );
}

function DeckThumb({ c, slot, onClick }: { c: CardInstance; slot: number; onClick: () => void }) {
  const m = master(c.cardId);
  const rank = rankOf(c);
  return (
    <button className="dthumb" style={{ ['--rc' as any]: `var(--r-${rank})`, background: `linear-gradient(160deg, ${FACTIONS[m.faction].color}55, #15161f 80%)` }} onClick={onClick}>
      <span className="slot">{slot}</span>
      <span className="rk">{rank}</span>
      <span className="g">{m.glyph}</span>
      <span className="lv">Lv{c.level}</span>
      <span className="at">{fmt(statsOf(c).atk)}</span>
    </button>
  );
}

function AllocateCard({ s, run, busy }: { s: PlayerState; run: Run; busy: boolean }) {
  const [pa, setPa] = useState(0);
  const [pd, setPd] = useState(0);
  const left = s.statPoints - pa - pd;
  return (
    <div className="panel alert-card col" style={{ alignItems: 'stretch' }}>
      <span>✨ 속성 포인트 <b>{s.statPoints}</b> 분배하기</span>
      <p className="muted small" style={{ margin: '4px 0 8px' }}>덱 코스트 상한이 올라가요. 공격 ↑ = 레이드 1회 피해, 방어 ↑ = 교전당 공격 횟수. 남은 포인트 {left}</p>
      <div className="row"><span className="grow">공격 코스트 {s.atkCost} <b style={{ color: 'var(--atk)' }}>+{pa}</b></span>
        <button className="btn sm" onClick={() => setPa(Math.max(0, pa - 1))}>−</button>
        <button className="btn sm" disabled={left <= 0} onClick={() => setPa(pa + 1)}>+</button></div>
      <div className="row" style={{ marginTop: 6 }}><span className="grow">방어 코스트 {s.defCost} <b style={{ color: 'var(--def)' }}>+{pd}</b></span>
        <button className="btn sm" onClick={() => setPd(Math.max(0, pd - 1))}>−</button>
        <button className="btn sm" disabled={left <= 0} onClick={() => setPd(pd + 1)}>+</button></div>
      <button className="btn primary block" style={{ marginTop: 8 }} disabled={busy || pa + pd === 0} onClick={async () => { await run('allocate', pa, pd); setPa(0); setPd(0); }}>분배 확정</button>
    </div>
  );
}

function Gacha({ s, run, busy, onClose }: { s: PlayerState; run: Run; busy: boolean; onClose: () => void }) {
  const [got, setGot] = useState<string[]>([]);
  const cards = got.map((u) => s.cards.find((c) => c.uid === u)).filter(Boolean) as CardInstance[];
  const draw = async (n: number) => { const r = await run<any>('gacha', n); if (r) setGot(r.cards); };
  return (
    <Modal title="뽑기" onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>{CURRENCY.silver.name}로 카드를 뽑아요. 확률 {C.GACHA_RATES.map((x) => `${x.rank} ${Math.round(x.p * 100)}%`).join(' · ')}. 보유 {s.cards.length}/{C.INVENTORY_CAP}</p>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn grow" disabled={busy || s.silver < C.gachaCost(1)} onClick={() => draw(1)}>1회 · {fmt(C.gachaCost(1))}</button>
        <button className="btn primary grow" disabled={busy || s.silver < C.gachaCost(10)} onClick={() => draw(10)}>10회 · {fmt(C.gachaCost(10))}</button>
      </div>
      {cards.length > 0 && <div className="cardgrid" style={{ marginTop: 12 }}>{cards.map((c) => <CardView key={c.uid} c={c} />)}</div>}
    </Modal>
  );
}

function ProtoTools({ s, run, busy, say }: { s: PlayerState; run: Run; busy: boolean; say: Say }) {
  const [armReset, setArmReset] = useState(false);
  return (
    <details className="panel proto">
      <summary>프로토타입 도구 <span className="pill">출시 전 제거</span></summary>
      <p className="muted small">테스트 보급: N 6장 + R 1장(+HR 확률) + {CURRENCY.silver.name} 50,000 + {CURRENCY.stardust.name}·{CURRENCY.vitality.name} 1개.</p>
      <div className="row wrap" style={{ gap: 6 }}>
        <button className="btn" disabled={busy} onClick={async () => { const r = await run<any>('protoSupply'); if (r) say(`보급: ${r.names.join(', ')}`); }}>보급 받기</button>
        {s.level < 10 && (
          <button className="btn sm" disabled={busy} onClick={() => run('setFaction', (s.faction === 'dawn' ? 'dusk' : 'dawn') as FactionId)}>
            진형: {FACTIONS[s.faction].short} → {FACTIONS[s.faction === 'dawn' ? 'dusk' : 'dawn'].short}
          </button>
        )}
        <button className="btn danger sm" disabled={busy} onClick={async () => {
          if (!armReset) { setArmReset(true); window.setTimeout(() => setArmReset(false), 4000); return; }
          setArmReset(false);
          await run('resetMe');
        }}>{armReset ? '한 번 더 누르면 모두 삭제' : '데이터 초기화'}</button>
      </div>
    </details>
  );
}
