// 홈: 내 전력(리더 + 공격 덱) · 오늘 할 일 · 바로가기 · 할 일이 있을 때만 뜨는 카드
import { useEffect, useMemo, useState } from 'react';
import type { Go, Run } from '../App';
import { CardDetail } from './Cards';
import { cardsInDecks, chapterAllCleared, deckCost, leaderCard, staminaMax, type PlayerState } from '../../server/src/game/player';
import * as C from '../../server/src/game/config';
import { displayName, isMaxed, levelCap, master, rankOf, statsOf, type CardInstance } from '../../server/src/game/cards';
import { CURRENCY, FACTIONS, type FactionId } from '../../server/src/game/data';
import { CHAPTERS, partKey } from '../../server/src/game/questData';
import { ArtLayers, Bar, CardArt, fmt } from '../ui/common';
import { hoursLeft, pct, type WeeklyInfo } from './Raid';
import { skillOf } from '../../server/src/game/cards';
import { MAX_FORM } from '../../server/src/game/config';

type Say = (m: string, e?: boolean) => void;


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

export default function Home({ s, run, busy, say, go, weekly, setWeekly }: {
  s: PlayerState; run: Run; busy: boolean; say: Say; go: Go; weekly: WeeklyInfo | null; setWeekly: (w: WeeklyInfo) => void;
}) {
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'info' | 'enhance'>('info');
  const inDeck = useMemo(() => cardsInDecks(s), [s]);
  const leader = leaderCard(s);
  const preset = s.presets[s.activePreset];
  const deck = preset.atk.map((id) => (id ? s.cards.find((c) => c.uid === id) ?? null : null));
  const open = s.cards.find((c) => c.uid === openUid) || null;
  const boss = s.raid.boss;
  const bossLeft = boss ? boss.expiresAt - Date.now() : Infinity;
  useEffect(() => { run<WeeklyInfo>('weeklyBoss').then((w) => w && setWeekly(w)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const evolved = useEvolveReveal(leader);

  const todos: { label: string; value: string; on: () => void; done?: boolean }[] = [
    { label: '결투장', value: `${s.duel.used} / ${C.DUEL_DAILY_ATTEMPTS} 시도`, on: () => go('duel'), done: s.duel.used >= C.DUEL_DAILY_ATTEMPTS },
    { label: '주간 보스', value: weekly ? (weekly.hp <= 0 ? (weekly.claimed || weekly.myDealt <= 0 ? '격파 완료' : '격파! 보상 받기') : `내 기여 ${pct(weekly.contribution)}`) : '…', on: () => go('boss', null, 'weekly'), done: !!weekly && weekly.hp <= 0 && (weekly.claimed || weekly.myDealt <= 0) },
    { label: '퀘스트', value: questNow(s), on: () => go('quest') },
  ];

  return (
    <div>
      {/* 1. 리더 카드 (히어로) + 공격 덱 */}
      <div className="panel home-hero">
        {leader ? <HeroCard c={leader} evolved={evolved} onClick={() => { setDetailMode('info'); setOpenUid(leader.uid); }} />
          : <button className="card empty hero-empty" onClick={() => go('cards')}>리더 카드를 지정하세요</button>}
        {leader && (
          <div className="hero-evo">
            <span className="small muted">진화</span>
            <span className="dots">{Array.from({ length: MAX_FORM }, (_, i) => <i key={i} className={i < leader.form ? 'on' : ''} />)}</span>
            {leader.form < MAX_FORM
              ? <span className="next"><span className="small muted">다음 모습</span><span className="next-art"><CardArt cardId={leader.cardId} form={leader.form + 1} silhouette /></span></span>
              : <span className="small" style={{ color: 'var(--gold)' }}>최종 진화</span>}
          </div>
        )}
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          <button className="btn grow" onClick={() => go('cards')}>리더 변경</button>
          <button className="btn primary grow" disabled={!leader || isMaxed(leader)} onClick={() => { if (leader) { setDetailMode('enhance'); setOpenUid(leader.uid); } }}>강화하기</button>
        </div>
        <div className="row between" style={{ marginTop: 14 }}>
          <span className="small"><b>공격 덱</b> <span className="muted">{preset.name} · 코스트 {deckCost(s, preset.atk)}/{s.atkCost}</span></span>
          <button className="btn sm" onClick={() => go('deck')}>덱 편집</button>
        </div>
        <div className="dthumbs">
          {deck.map((c, i) => c ? <DeckThumb key={i} c={c} slot={i + 1} onClick={() => { setDetailMode('info'); setOpenUid(c.uid); }} /> : <button key={i} className="dthumb empty" onClick={() => go('deck')}><span className="slot">{i + 1}</span>+</button>)}
        </div>
      </div>

      {/* 보스 현황 (상시): 입장권 · 개인 보스 · 주간 보스 */}
      <div className="panel bosspanel">
        <div className="row between">
          <span>🎟 보스 입장권 <b className="tk">{s.tickets}</b> / {C.TICKET_CAP}</span>
          {s.stardust > 0 && s.tickets + C.STARDUST_TICKETS <= C.TICKET_HARD_CAP
            ? <button className="btn sm" disabled={busy} onClick={() => run('useStardust')}>{CURRENCY.stardust.name} 사용 +{C.STARDUST_TICKETS}</button>
            : <button className="btn sm" onClick={() => go('shop')}>충전</button>}
        </div>
        {weekly && (
          <button className="bossrow" onClick={() => go('boss', null, 'weekly')}>
            <span className="bg">{weekly.glyph}</span>
            <span className="grow">
              <span className="row between small"><b>주간 · {weekly.name}</b><span className="muted">{weekly.hp <= 0 ? '격파됨' : hoursLeft(weekly.endsAt - Date.now())}</span></span>
              <Bar value={weekly.hp} max={weekly.maxHp} kind="hp" />
              <span className="small muted">HP {fmt(weekly.hp)} / {fmt(weekly.maxHp)} · 내 기여 {pct(weekly.contribution)}</span>
            </span>
          </button>
        )}
        {boss && (
          <button className="bossrow" onClick={() => go('boss', null, 'personal')}>
            <span className="bg">{boss.glyph}</span>
            <span className="grow">
              <span className="row between small"><b>개인 · {boss.name}</b><span className="muted">{hoursLeft(bossLeft)}</span></span>
              <Bar value={boss.hp} max={boss.maxHp} kind="hp" />
              <span className="small muted">HP {fmt(boss.hp)} / {fmt(boss.maxHp)}</span>
            </span>
          </button>
        )}
      </div>

      {/* 4. 조건부: 할 일이 있을 때만 */}
      {boss && bossLeft < 24 * 3_600_000 && (
        <button className="panel alert-card warn" onClick={() => go('boss', null, 'personal')}>
          <span>⏳ {boss.name} 마감 {hoursLeft(bossLeft)} 전</span><span className="muted small">떠나기 전에 처치하세요</span>
        </button>
      )}

      {/* 플레이어 스탯 분배 (코스트 표시 겸) */}
      <StatCard s={s} run={run} busy={busy} />

      {/* 2. 오늘 할 일 */}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>오늘 할 일</h2>
        <div className="todos">
          {todos.map((t) => (
            <button key={t.label} className={`todo${t.done ? ' done' : ''}`} onClick={t.on}>
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
        <button onClick={() => go('shop')}><span className="ic">🎴</span>뽑기<small>천장 {s.gacha?.pity ?? 0} / {C.GACHA_PITY}</small></button>
      </div>

      {C.PROTOTYPE_MODE && <ProtoTools s={s} run={run} busy={busy} say={say} />}

      {open && <CardDetail key={open.uid + detailMode} c={open} s={s} run={run} busy={busy} say={say} inDeck={inDeck} initialMode={detailMode} onClose={() => setOpenUid(null)} />}
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

function StatCard({ s, run, busy }: { s: PlayerState; run: Run; busy: boolean }) {
  const [add, setAdd] = useState({ hp: 0, atk: 0, def: 0 });
  const used = add.hp + add.atk + add.def;
  const left = s.statPoints - used;
  const rows: { k: keyof typeof add; label: string; base: number; per: number; color?: string }[] = [
    { k: 'hp', label: '체력', base: staminaMax(s), per: C.STAMINA_PER_POINT },
    { k: 'atk', label: '공격 코스트', base: s.atkCost, per: 1, color: 'var(--atk)' },
    { k: 'def', label: '방어 코스트', base: s.defCost, per: 1, color: 'var(--def)' },
  ];
  return (
    <div className={`panel statcard${s.statPoints > 0 ? ' has' : ''}`}>
      <div className="row between"><b>속성 포인트</b><span>남은 포인트 <b className="pts">{left}</b></span></div>
      {rows.map((r) => (
        <div key={r.k} className="statrow">
          <span className="grow">{r.label}</span>
          <b style={{ color: r.color }}>{r.base + add[r.k] * r.per}</b>
          <span className="plus">{add[r.k] > 0 ? `+${add[r.k] * r.per}` : ''}</span>
          <button className="btn sm" disabled={add[r.k] <= 0} onClick={() => setAdd({ ...add, [r.k]: add[r.k] - 1 })} aria-label={`${r.label} 빼기`}>−</button>
          <button className="btn sm" disabled={left <= 0} onClick={() => setAdd({ ...add, [r.k]: add[r.k] + 1 })} aria-label={`${r.label} 더하기`}>+</button>
        </div>
      ))}
      {s.statPoints > 0 && (
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={busy || used === 0} onClick={async () => { await run('allocate', add.atk, add.def, add.hp); setAdd({ hp: 0, atk: 0, def: 0 }); }}>분배 확정</button>
      )}
    </div>
  );
}

/** 리더 카드 히어로: 큰 아트 + 하단 오버레이 두 줄. 공·방·스킬은 프레임에 */
function HeroCard({ c, evolved, onClick }: { c: CardInstance; evolved: boolean; onClick: () => void }) {
  const m = master(c.cardId);
  const rank = rankOf(c);
  const st = statsOf(c);
  const sk = skillOf(c.cardId);
  const fc = FACTIONS[m.faction].color;
  return (
    <button className={`hero${evolved ? ' evolved' : ''}`} style={{ ['--rc' as any]: `var(--r-${rank})`, ['--fc' as any]: fc }} onClick={onClick}>
      <div className={`hero-art art f${c.form}`} style={{ background: `linear-gradient(165deg, ${fc}77, #15161f 78%)` }}>
        <ArtLayers form={c.form} />
        <span className="hero-glyph">{m.glyph}</span>
        <span className="hb cost">{m.cost}</span>
        <span className="hero-overlay">
          <b>{displayName(c)}</b>
          <span>{rank} · {FACTIONS[m.faction].name} · Lv {c.level}/{levelCap(c)}</span>
        </span>
        {evolved && <span className="evo-banner">진화! 새로운 모습</span>}
      </div>
      <div className="hero-stats-line"><span className="a">공 {fmt(st.atk)}</span><span className="d">방 {fmt(st.def)}</span><span className="sk">{sk ? sk.name : m.style === 'def' ? '깡방' : '깡공'}</span></div>
    </button>
  );
}

/** 리더의 진화 단계가 지난번 홈에서 본 것보다 올라갔으면 한 번만 연출 */
function useEvolveReveal(leader: CardInstance | null): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!leader) return;
    let seen: { uid: string; form: number } | null = null;
    try { seen = JSON.parse(localStorage.getItem('tcg-leader-seen') || 'null'); } catch { /* 무시 */ }
    if (seen && seen.uid === leader.uid && leader.form > seen.form) {
      setOn(true);
      const t = window.setTimeout(() => setOn(false), 2600);
      try { localStorage.setItem('tcg-leader-seen', JSON.stringify({ uid: leader.uid, form: leader.form })); } catch { /* 무시 */ }
      return () => window.clearTimeout(t);
    }
    try { localStorage.setItem('tcg-leader-seen', JSON.stringify({ uid: leader.uid, form: leader.form })); } catch { /* 무시 */ }
  }, [leader?.uid, leader?.form]); // eslint-disable-line react-hooks/exhaustive-deps
  return on;
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
