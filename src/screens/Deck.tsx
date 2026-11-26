import { useMemo, useState } from 'react';
import type { Run } from '../App';
import type { PlayerState } from '../../server/src/game/player';
import * as C from '../../server/src/game/config';
import { master, statsOf, skillOf, type CardInstance } from '../../server/src/game/cards';
import { CardView, Modal, fmt } from '../ui/common';

type Side = 'atk' | 'def';

export default function Deck({ s, run, busy }: { s: PlayerState; run: Run; busy: boolean }) {
  const [pi, setPi] = useState(s.activePreset);
  const [side, setSide] = useState<Side>('atk');
  const [picking, setPicking] = useState<number | null>(null);
  const preset = s.presets[pi];
  const ids = preset[side];
  const byUid = useMemo(() => new Map(s.cards.map((c) => [c.uid, c])), [s.cards]);
  const cards = ids.map((id) => (id ? byUid.get(id) ?? null : null));
  const cost = cards.reduce((a, c) => a + (c ? master(c.cardId).cost : 0), 0);
  const limit = side === 'atk' ? s.atkCost : s.defCost;
  const base = cards.reduce((a, c) => {
    if (!c) return a;
    const v = statsOf(c)[side];
    return a + v * (master(c.cardId).faction === s.faction ? 1 + C.FACTION_BONUS : 1);
  }, 0);

  const setSlot = (slot: number, uid: string | null) => {
    const next = [...ids];
    if (uid) { const dup = next.indexOf(uid); if (dup >= 0) next[dup] = null; }
    next[slot] = uid;
    run('saveDeck', pi, side, next);
    setPicking(null);
  };

  return (
    <div>
      <div className="seg" style={{ marginBottom: 8 }}>
        {s.presets.map((p, i) => (
          <button key={i} className={pi === i ? 'on' : ''} onClick={() => setPi(i)}>{s.activePreset === i ? '● ' : ''}{p.name}</button>
        ))}
      </div>
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="muted small">{s.activePreset === pi ? '전투에 사용 중인 프리셋' : '저장만 된 프리셋'}</span>
        {s.activePreset !== pi && <button className="btn sm primary" disabled={busy} onClick={() => run('selectPreset', pi)}>이 프리셋 사용</button>}
      </div>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={side === 'atk' ? 'on' : ''} onClick={() => setSide('atk')}>⚔ 공격 덱</button>
        <button className={side === 'def' ? 'on' : ''} onClick={() => setSide('def')}>🛡 방어 덱</button>
      </div>

      <div className="panel">
        <div className="row between" style={{ marginBottom: 8 }}>
          <span>코스트 <b style={{ color: cost > limit ? 'var(--bad)' : undefined }}>{cost}</b> / {limit}</span>
          <span>{side === 'atk' ? '공격' : '방어'} 합계 <b style={{ color: side === 'atk' ? 'var(--atk)' : 'var(--def)' }}>{fmt(base)}</b> <span className="muted small">(스킬 전)</span></span>
        </div>
        <div className="slots">
          {cards.map((c, i) => (
            <div key={i} className={`slot${i === 2 ? ' center' : ''}`}>
              <div className="chance">{i + 1}번 · {Math.round(C.SLOT_CHANCE[i] * 100)}%</div>
              {c ? <CardView c={c} stat={side} onClick={() => setPicking(i)} /> : <button className="card empty" style={{ width: '100%', minHeight: 150 }} onClick={() => setPicking(i)}>+<br />추가</button>}
            </div>
          ))}
        </div>
      </div>
      <div className="panel small muted">
        스킬은 슬롯별 확률로 발동하고 최대 3개까지 적용됩니다(우선순위 3→2→4→1→5). 같은 이름 스킬은 한 번만 적용돼요.
        3번 슬롯은 100% 발동하니 가장 중요한 스킬을, 1·5번에는 스킬 없는 깡스탯 카드를 두는 게 정석입니다.
        {side === 'def' && ' 방어 덱은 결투장에서 다른 유저의 공격을 받는 덱이자, 레이드에서 버틸 수 있는 횟수를 정합니다.'}
      </div>
      {picking != null && (
        <Picker s={s} side={side} current={ids} slot={picking} limit={limit} cost={cost} cards={cards}
          onPick={(u) => setSlot(picking, u)} onClose={() => setPicking(null)} />
      )}
    </div>
  );
}

function Picker({ s, side, current, slot, limit, cost, cards, onPick, onClose }: {
  s: PlayerState; side: Side; current: (string | null)[]; slot: number; limit: number; cost: number; cards: (CardInstance | null)[];
  onPick: (uid: string | null) => void; onClose: () => void;
}) {
  const [sort, setSort] = useState<'stat' | 'cost'>('stat');
  const slotCost = cards[slot] ? master(cards[slot]!.cardId).cost : 0;
  const list = [...s.cards].sort((a, b) => sort === 'stat'
    ? statsOf(b)[side] - statsOf(a)[side]
    : master(a.cardId).cost - master(b.cardId).cost || statsOf(b)[side] - statsOf(a)[side]);
  return (
    <Modal title={`${slot + 1}번 슬롯 (${Math.round(C.SLOT_CHANCE[slot] * 100)}%)`} onClose={onClose}>
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        <div className="seg grow">
          <button className={sort === 'stat' ? 'on' : ''} onClick={() => setSort('stat')}>{side === 'atk' ? '공격' : '방어'}순</button>
          <button className={sort === 'cost' ? 'on' : ''} onClick={() => setSort('cost')}>코스트순</button>
        </div>
        <button className="btn sm" onClick={() => onPick(null)}>비우기</button>
      </div>
      <div className="cardgrid">
        {list.map((c) => {
          const already = current.includes(c.uid);
          const over = !already && cost - slotCost + master(c.cardId).cost > limit;
          const sk = skillOf(c.cardId);
          return (
            <CardView key={c.uid} c={c} dim={over} selected={current[slot] === c.uid}
              badge={already && current[slot] !== c.uid ? `${current.indexOf(c.uid) + 1}` : sk && slot === 2 ? '★' : undefined}
              onClick={() => !over && onPick(c.uid)} />
          );
        })}
      </div>
      <p className="muted small">흐리게 보이는 카드는 코스트 상한을 넘습니다. 숫자 배지는 이미 다른 슬롯에 있는 카드(선택하면 자리 이동). ★ = 3번 슬롯에 어울리는 스킬 카드.</p>
    </Modal>
  );
}
