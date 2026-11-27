import { useMemo, useState } from 'react';
import type { Run } from '../App';
import { cardsInDecks, inventoryCap, sellPrice, type PlayerState } from '../../server/src/game/player';
import * as C from '../../server/src/game/config';
import { canEvolve, displayName, evoFormula, isMaxed, levelCap, master, rankOf, skillOf, statsOf, type CardInstance } from '../../server/src/game/cards';
import { FACTIONS, CURRENCY, type FactionId } from '../../server/src/game/data';
import { previewEnhance, previewEvolve } from '../../server/src/game/growth';
import { CardView, Modal, fmt } from '../ui/common';

const rankIdx = (c: CardInstance) => C.RANKS.indexOf(rankOf(c));
const sortCards = (a: CardInstance, b: CardInstance) =>
  rankIdx(b) - rankIdx(a) || b.form - a.form || b.level - a.level || a.cardId.localeCompare(b.cardId);
/** 성장도: 현재 레벨이 레벨 상한까지 얼마나 왔는지 (Lv1 = 0%, 맥강 = 100%) */
export const growthPct = (c: CardInstance) => { const cap = levelCap(c); return cap <= 1 ? 100 : Math.round(((c.level - 1) / (cap - 1)) * 100); };

type Faction = 'all' | FactionId;
type SortKey = 'rank' | 'chara' | 'level' | 'atk' | 'def' | 'cost' | 'growth' | 'new';
const SORTS: Record<SortKey, { label: string; fn: (a: CardInstance, b: CardInstance) => number }> = {
  rank: { label: '등급순', fn: sortCards },
  chara: { label: '캐릭터 순서', fn: (a, b) => a.cardId.localeCompare(b.cardId) || b.form - a.form || b.level - a.level },
  level: { label: '레벨순', fn: (a, b) => b.level - a.level || sortCards(a, b) },
  atk: { label: '공격력순', fn: (a, b) => statsOf(b).atk - statsOf(a).atk },
  def: { label: '방어력순', fn: (a, b) => statsOf(b).def - statsOf(a).def },
  cost: { label: '코스트순', fn: (a, b) => master(b.cardId).cost - master(a.cardId).cost || sortCards(a, b) },
  growth: { label: '성장도순', fn: (a, b) => growthPct(b) - growthPct(a) || sortCards(a, b) },
  new: { label: '최근 획득순', fn: (a, b) => b.createdAt - a.createdAt || Number(b.uid.slice(1)) - Number(a.uid.slice(1)) },
};

export type CardsIntent = { pick: 'enhance' | 'evolve' } | null;

export default function Cards({ s, run, busy, say, intent, clearIntent }: { s: PlayerState; run: Run; busy: boolean; say: (m: string, e?: boolean) => void; intent?: CardsIntent; clearIntent?: () => void }) {
  const pick = intent?.pick ?? null;
  const [tab, setTab] = useState<'list' | 'sell'>('list');
  const [faction, setFaction] = useState<Faction>('all');
  const [sort, setSort] = useState<SortKey>('rank');
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const inDeck = useMemo(() => cardsInDecks(s), [s]);
  const leader = s.cards.find((c) => c.uid === s.quest.leader) || null;
  const evoReady = (c: CardInstance) => canEvolve(c) && s.cards.some((x) => x.uid !== c.uid && x.cardId === c.cardId && !x.locked && !inDeck.has(x.uid) && x.uid !== s.quest.leader);
  const pickable = (c: CardInstance) => pick === 'enhance' ? !isMaxed(c) : pick === 'evolve' ? evoReady(c) : true;
  const list = useMemo(() => s.cards
    .filter((c) => c.uid !== s.quest.leader)
    .filter((c) => faction === 'all' || master(c.cardId).faction === faction)
    .sort(SORTS[sort].fn), [s.cards, s.quest.leader, faction, sort]);
  const open = s.cards.find((c) => c.uid === openUid) || null;
  const sellable = (c: CardInstance) => !c.locked && !inDeck.has(c.uid) && c.uid !== s.quest.leader;
  const pickedCards = picked.map((u) => s.cards.find((c) => c.uid === u)).filter(Boolean) as CardInstance[];
  const total = pickedCards.reduce((a, c) => a + sellPrice(c), 0);
  const toggle = (u: string) => setPicked((xs) => xs.includes(u) ? xs.filter((x) => x !== u) : [...xs, u]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>보유카드 리스트 <span className="muted small">({s.cards.length}/{inventoryCap(s)})</span></h2>
      {!pick && <div className="seg" style={{ marginBottom: 8 }}>
        <button className={tab === 'list' ? 'on' : ''} onClick={() => { setTab('list'); setPicked([]); }}>리스트</button>
        <button className={tab === 'sell' ? 'on' : ''} onClick={() => setTab('sell')}>판매</button>
      </div>}
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        <div className="seg grow">
          {(['all', 'dawn', 'dusk'] as Faction[]).map((f) => (
            <button key={f} className={faction === f ? 'on' : ''} onClick={() => setFaction(f)}>{f === 'all' ? '전체' : FACTIONS[f].name}</button>
          ))}
        </div>
        <select className="sortsel" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬">
          {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>{SORTS[k].label}</option>)}
        </select>
      </div>

      {pick && (
        <div className="hint row between" style={{ marginBottom: 10 }}>
          <span>{pick === 'enhance' ? '강화할 카드를 고르세요. (맥강 카드 제외)' : '진화할 카드를 고르세요. 같은 이름의 재료 카드가 있는 카드만 보여요.'}</span>
          <button className="btn sm" onClick={clearIntent}>취소</button>
        </div>
      )}
      {pick && (
        <div className="crows">
          {[...(leader ? [leader] : []), ...list].filter(pickable).map((c) => <CardRow key={c.uid} c={c} inDeck={inDeck.has(c.uid)} leader={c.uid === s.quest.leader} onClick={() => setOpenUid(c.uid)} />)}
          {![...(leader ? [leader] : []), ...list].some(pickable) && <p className="muted small">{pick === 'evolve' ? '진화할 수 있는 카드가 없어요. 같은 카드를 2장 모으면 진화할 수 있어요.' : '강화할 수 있는 카드가 없어요.'}</p>}
        </div>
      )}
      {!pick && tab === 'list' && (
        <>
          <div className="crow-head">리더 카드</div>
          {leader ? <CardRow c={leader} inDeck={inDeck.has(leader.uid)} leader onClick={() => setOpenUid(leader.uid)} /> : <p className="muted small">리더 카드가 없어요. 카드를 눌러 리더로 지정하세요.</p>}
          <div className="crow-head">보유 카드</div>
          <p className="muted small" style={{ marginTop: 0 }}>📌 덱 편성 중 · 🔒 보호 중 · 👑 리더</p>
          <div className="crows">{list.map((c) => <CardRow key={c.uid} c={c} inDeck={inDeck.has(c.uid)} onClick={() => setOpenUid(c.uid)} />)}</div>
        </>
      )}

      {!pick && tab === 'sell' && (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>보호 중·덱 편성 중·리더 카드는 팔 수 없어요.</p>
          <div className="crows">
            {list.filter(sellable).map((c) => (
              <CardRow key={c.uid} c={c} inDeck={false} selected={picked.includes(c.uid)} price={sellPrice(c)} onClick={() => toggle(c.uid)} />
            ))}
          </div>
          <div className="sellbar">
            <span>선택 {picked.length}장 · <b>{fmt(total)}</b> {CURRENCY.silver.name}</span>
            <button className="btn primary" disabled={busy || !picked.length} onClick={async () => {
              const r = await run<any>('sellCards', picked);
              if (r) { say(`${r.count}장 판매 · ${CURRENCY.silver.name} +${fmt(r.silver)}`); setPicked([]); }
            }}>판매</button>
          </div>
        </>
      )}
      {open && <CardDetail key={open.uid} c={open} s={s} run={run} busy={busy} say={say} inDeck={inDeck} initialMode={pick ?? 'info'} onClose={() => setOpenUid(null)} />}
    </div>
  );
}

function CardRow({ c, inDeck, leader, selected, price, onClick }: { c: CardInstance; inDeck: boolean; leader?: boolean; selected?: boolean; price?: number; onClick: () => void }) {
  const m = master(c.cardId);
  const rank = rankOf(c);
  const st = statsOf(c);
  const g = growthPct(c);
  return (
    <button className={`crow${selected ? ' sel' : ''}${leader ? ' leader' : ''}`} style={{ ['--rc' as any]: `var(--r-${rank})` }} onClick={onClick}>
      <div className="cthumb" style={{ background: `linear-gradient(160deg, ${FACTIONS[m.faction].color}55, #15161f 75%)` }}>
        <span className="rk">{rank}</span><span>{m.glyph}</span>
        <span className="stars">{'★'.repeat(c.form)}</span>
      </div>
      <div className="cinfo">
        <div className="cname">{leader && '👑 '}{c.locked && '🔒 '}{inDeck && '📌 '}{displayName(c)}</div>
        <div className="cstats">
          <span>Lv <b>{c.level}</b>/{levelCap(c)}</span>
          <span>코스트 <b>{m.cost}</b></span>
          <span>공 <b className="a">{fmt(st.atk)}</b></span>
          <span>방 <b className="d">{fmt(st.def)}</b></span>
        </div>
        <div className="cgrow"><span>성장도 {g}%</span><div className="bar"><i style={{ width: `${g}%` }} /></div></div>
      </div>
      {price != null && <div className="cprice">{selected ? '✔' : ''}<br />{fmt(price)}</div>}
    </button>
  );
}

export function CardDetail({ c, s, run, busy, say, inDeck, onClose, initialMode = 'info' }: {
  c: CardInstance; s: PlayerState; run: Run; busy: boolean; say: (m: string, e?: boolean) => void; inDeck: Set<string>; onClose: () => void; initialMode?: 'info' | 'enhance' | 'evolve';
}) {
  const [mode, setMode] = useState<'info' | 'enhance' | 'evolve'>(initialMode);
  const [mats, setMats] = useState<string[]>([]);
  const [evoMat, setEvoMat] = useState<string | null>(null);
  const m = master(c.cardId);
  const st = statsOf(c);
  const sk = skillOf(c.cardId);
  const usable = (x: CardInstance) => x.uid !== c.uid && !x.locked && !inDeck.has(x.uid);
  const enhanceCandidates = s.cards.filter(usable).sort((a, b) => rankIdx(a) - rankIdx(b) || a.level - b.level);
  const evoCandidates = s.cards.filter((x) => usable(x) && x.cardId === c.cardId).sort(sortCards);
  const matObjs = mats.map((u) => s.cards.find((x) => x.uid === u)!).filter(Boolean);
  const ep = matObjs.length ? previewEnhance(c, matObjs) : null;
  const evoObj = evoMat ? s.cards.find((x) => x.uid === evoMat) : null;
  const vp = evoObj ? previewEvolve(c, evoObj) : null;
  const nextStats = vp ? statsOf({ cardId: c.cardId, form: vp.formTo, level: 1, inhAtk: vp.inhAtk, inhDef: vp.inhDef }) : null;
  const nextMax = vp ? statsOf({ cardId: c.cardId, form: vp.formTo, level: 999, inhAtk: vp.inhAtk, inhDef: vp.inhDef }) : null;
  const showEvoHint = !s.flags.evolveHintShown && !isMaxed(c);

  const toggleMat = (u: string) => setMats((xs) => xs.includes(u) ? xs.filter((x) => x !== u) : xs.length >= C.ENHANCE_MAX_MATERIALS ? xs : [...xs, u]);

  return (
    <Modal title={displayName(c)} onClose={onClose}>
      {mode === 'info' && (
        <>
          <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 110 }}><CardView c={c} inDeck={inDeck.has(c.uid)} /></div>
            <dl className="kv grow">
              <dt>등급</dt><dd>{rankOf(c)} · {C.RANK_LABEL[rankOf(c)]}</dd>
              <dt>진형</dt><dd style={{ color: FACTIONS[m.faction].color }}>{FACTIONS[m.faction].name}</dd>
              <dt>레벨</dt><dd>{c.level} / {levelCap(c)}{isMaxed(c) ? ' (맥강)' : ''}</dd>
              <dt>공격</dt><dd style={{ color: 'var(--atk)' }}>{fmt(st.atk)}</dd>
              <dt>방어</dt><dd style={{ color: 'var(--def)' }}>{fmt(st.def)}</dd>
              <dt>코스트</dt><dd>{m.cost}</dd>
              <dt>진화</dt><dd>{c.form}/{C.MAX_FORM}단계</dd>
              <dt>진화식</dt><dd>{evoFormula(c)}</dd>
            </dl>
          </div>
          <div className="panel" style={{ marginTop: 10 }}>
            <b>{sk ? sk.name : '스킬 없음'}</b>
            <div className="muted small">{sk ? sk.desc : m.style === 'def' ? '높은 방어력의 깡방 카드. 1·5번 슬롯에 어울려요.' : '높은 공격력의 깡공 카드. 1·5번 슬롯에 어울려요.'}</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary grow" disabled={busy || isMaxed(c)} onClick={() => setMode('enhance')}>강화</button>
            <button className="btn grow" disabled={busy || !canEvolve(c)} onClick={() => setMode('evolve')}>진화</button>
            <button className="btn" disabled={busy} onClick={() => run('toggleLock', c.uid)}>{c.locked ? '보호 해제' : '보호'}</button>
          </div>
          <button className="btn block" style={{ marginTop: 6 }} disabled={busy || s.quest.leader === c.uid} onClick={async () => { await run('setLeader', c.uid); say(`${displayName(c)}을(를) 리더로 지정했어요`); }}>
            {s.quest.leader === c.uid ? '👑 현재 리더 카드' : '리더로 지정하기 (퀘스트·장 보스)'}
          </button>
        </>
      )}

      {mode === 'enhance' && (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>재료 최대 {C.ENHANCE_MAX_MATERIALS}장. 등급·진화 단계·코스트가 높을수록 경험치가 많습니다. Lv1·경험치 0인 카드를 처음 강화하면 +50%.</p>
          <div className="panel">
            {ep ? (
              <dl className="kv">
                <dt>레벨</dt><dd>{ep.levelFrom} → <b>{ep.levelTo}</b>{ep.maxed ? ' (맥강!)' : ''}</dd>
                <dt>경험치</dt><dd>+{fmt(ep.gainedExp)}{ep.clearBonus ? ' (클리어 카드 +50%)' : ''}</dd>
                <dt>{CURRENCY.silver.name}</dt><dd style={{ color: ep.cost > s.silver ? 'var(--bad)' : undefined }}>{fmt(ep.cost)}</dd>
              </dl>
            ) : <span className="muted small">재료를 선택하세요. ({mats.length}/{C.ENHANCE_MAX_MATERIALS})</span>}
          </div>
          <div className="row" style={{ gap: 6, marginBottom: 10 }}>
            <button className="btn" onClick={() => { setMode('info'); setMats([]); }}>뒤로</button>
            <button className="btn sm" onClick={() => setMats(enhanceCandidates.filter((x) => rankOf(x) === 'N' || rankOf(x) === 'HN').slice(0, C.ENHANCE_MAX_MATERIALS).map((x) => x.uid))}>N 자동 선택</button>
            <button className="btn primary grow" disabled={busy || !ep} onClick={async () => {
              const r = await run<any>('enhance', c.uid, mats);
              if (r) { say(`Lv ${r.levelFrom} → ${r.levelTo}${r.maxed ? ' 맥강 달성!' : ''}`); setMats([]); setMode('info'); }
            }}>강화 ({mats.length})</button>
          </div>
          <div className="cardgrid">
            {enhanceCandidates.map((x) => <CardView key={x.uid} c={x} selected={mats.includes(x.uid)} onClick={() => toggleMat(x.uid)} />)}
          </div>
          {enhanceCandidates.length === 0 && <p className="muted small">쓸 수 있는 재료가 없습니다. 퀘스트나 테스트 보급으로 카드를 모으세요.</p>}
        </>
      )}

      {mode === 'evolve' && (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>같은 이름의 카드 1장을 재료로 씁니다. 진화하면 레벨은 1로 돌아가고, 두 카드 스탯의 일부(맥강 10% / 아니면 5%)를 계승합니다. 코스트는 그대로. 4단계에서 등급이 한 칸 오릅니다.</p>
          {showEvoHint && <div className="hint" style={{ marginBottom: 10 }}>강화하지 않은 유닛을 진화시키면 강화한 유닛을 진화한 것보다 약해집니다.</div>}
          <div className="panel">
            {vp && nextStats && nextMax ? (
              <dl className="kv">
                <dt>결과</dt><dd>{displayName({ cardId: c.cardId, form: vp.formTo })} ({vp.rankTo})</dd>
                <dt>계승</dt><dd>공 +{fmt(vp.inhAtk)} / 방 +{fmt(vp.inhDef)}</dd>
                <dt>Lv1 스탯</dt><dd>{fmt(nextStats.atk)} / {fmt(nextStats.def)}</dd>
                <dt>최대 스탯</dt><dd>{fmt(nextMax.atk)} / {fmt(nextMax.def)}</dd>
                <dt>진화식</dt><dd>{vp.baseCardsUsed}-{vp.maxEnhanceCount}</dd>
                <dt>{CURRENCY.silver.name}</dt><dd style={{ color: vp.cost > s.silver ? 'var(--bad)' : undefined }}>{fmt(vp.cost)}</dd>
              </dl>
            ) : <span className="muted small">{evoCandidates.length ? '재료 카드를 선택하세요.' : `재료로 쓸 ${m.name}이(가) 없습니다.`}</span>}
          </div>
          <div className="row" style={{ gap: 6, marginBottom: 10 }}>
            <button className="btn" onClick={() => { setMode('info'); setEvoMat(null); }}>뒤로</button>
            <button className="btn primary grow" disabled={busy || !vp} onClick={async () => {
              const r = await run<any>('evolve', c.uid, evoMat);
              if (r) { say(`진화 성공! 진화식 ${r.baseCardsUsed}-${r.maxEnhanceCount}`); setEvoMat(null); setMode('info'); }
            }}>진화</button>
          </div>
          <div className="cardgrid">
            {evoCandidates.map((x) => <CardView key={x.uid} c={x} selected={evoMat === x.uid} onClick={() => setEvoMat(evoMat === x.uid ? null : x.uid)} />)}
          </div>
        </>
      )}
    </Modal>
  );
}
