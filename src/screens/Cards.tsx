import { useMemo, useState } from 'react';
import type { Run } from '../App';
import { cardsInDecks, type PlayerState } from '../../server/src/game/player';
import * as C from '../../server/src/game/config';
import { canEvolve, displayName, evoFormula, isMaxed, levelCap, master, rankOf, skillOf, statsOf, type CardInstance } from '../../server/src/game/cards';
import { FACTIONS, CURRENCY } from '../../server/src/game/data';
import { previewEnhance, previewEvolve } from '../../server/src/game/growth';
import { CardView, Modal, fmt } from '../ui/common';

const rankIdx = (c: CardInstance) => C.RANKS.indexOf(rankOf(c));
const sortCards = (a: CardInstance, b: CardInstance) =>
  rankIdx(b) - rankIdx(a) || b.form - a.form || b.level - a.level || a.cardId.localeCompare(b.cardId);

type Filter = 'all' | 'N' | 'R' | 'HR+';

export default function Cards({ s, run, busy, say }: { s: PlayerState; run: Run; busy: boolean; say: (m: string, e?: boolean) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [openUid, setOpenUid] = useState<string | null>(null);
  const inDeck = useMemo(() => cardsInDecks(s), [s]);
  const list = useMemo(() => s.cards.filter((c) => {
    const r = rankOf(c);
    if (filter === 'N') return r === 'N' || r === 'HN';
    if (filter === 'R') return r === 'R';
    if (filter === 'HR+') return C.RANKS.indexOf(r) >= C.RANKS.indexOf('HR');
    return true;
  }).sort(sortCards), [s.cards, filter]);
  const open = s.cards.find((c) => c.uid === openUid) || null;

  return (
    <div>
      <div className="row between"><h2>보유 카드 <span className="muted small">{s.cards.length}/{C.INVENTORY_CAP}</span></h2></div>
      <div className="seg" style={{ marginBottom: 10 }}>
        {(['all', 'N', 'R', 'HR+'] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'all' ? '전체' : f === 'N' ? 'N·HN' : f}</button>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>📌 덱 편성 중 · 🔒 보호 중 (둘 다 재료로 쓸 수 없음)</p>
      <div className="cardgrid">
        {list.map((c) => <CardView key={c.uid} c={c} inDeck={inDeck.has(c.uid)} onClick={() => setOpenUid(c.uid)} />)}
      </div>
      {open && <CardDetail key={open.uid} c={open} s={s} run={run} busy={busy} say={say} inDeck={inDeck} onClose={() => setOpenUid(null)} />}
    </div>
  );
}

function CardDetail({ c, s, run, busy, say, inDeck, onClose }: {
  c: CardInstance; s: PlayerState; run: Run; busy: boolean; say: (m: string, e?: boolean) => void; inDeck: Set<string>; onClose: () => void;
}) {
  const [mode, setMode] = useState<'info' | 'enhance' | 'evolve'>('info');
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
