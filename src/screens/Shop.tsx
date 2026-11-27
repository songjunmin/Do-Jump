// 상점: 카드팩(일반·픽업·천장) / 재화 / 편의 / 확률 공개
import { useState } from 'react';
import type { Run } from '../App';
import { inventoryCap, type PlayerState } from '../../server/src/game/player';
import * as C from '../../server/src/game/config';
import { CARDS, CARD_MAP, CURRENCY, FACTIONS } from '../../server/src/game/data';
import type { CardInstance } from '../../server/src/game/cards';
import { CardArt, CardView, Modal, fmt } from '../ui/common';

type Say = (m: string, e?: boolean) => void;

export default function Shop({ s, run, busy, say }: { s: PlayerState; run: Run; busy: boolean; say: Say }) {
  const [got, setGot] = useState<{ uids: string[]; pityHit: boolean } | null>(null);
  const [rates, setRates] = useState(false);
  const pity = s.gacha?.pity ?? 0;
  const cap = inventoryCap(s);
  const draw = async (n: number, pack: 'normal' | 'pickup') => {
    const r = await run<any>('gacha', n, pack);
    if (r) setGot({ uids: r.cards, pityHit: r.pityHit });
  };
  const buy = async (item: string) => { const r = await run<any>('buyShop', item); if (r) say(r.msg); };
  const pu = C.PICKUP ? CARD_MAP[C.PICKUP.cardId] : null;
  const free = <span className="price">결제 연동 전 · 테스트 무료</span>;

  return (
    <div className="shop">
      <h2 style={{ marginTop: 0 }}>카드팩</h2>
      {C.PICKUP && pu && (
        <div className="panel pack pickup">
          <div className="pack-art"><CardArt cardId={pu.id} form={1} big /></div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="pill" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>픽업</div>
            <b className="pack-title">{C.PICKUP.title}</b>
            <div className="small muted">HR 당첨 시 {Math.round(C.PICKUP.rateUp * 100)}% 확률로 {pu.name}</div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <button className="btn grow" disabled={busy || s.silver < C.gachaCost(1)} onClick={() => draw(1, 'pickup')}>1회 · {fmt(C.gachaCost(1))}</button>
              <button className="btn primary grow" disabled={busy || s.silver < C.gachaCost(10)} onClick={() => draw(10, 'pickup')}>10회 · {fmt(C.gachaCost(10))}</button>
            </div>
          </div>
        </div>
      )}
      <div className="panel pack">
        <div className="pack-art plain">🎴</div>
        <div className="grow">
          <b className="pack-title">일반 팩</b>
          <div className="small muted">{C.GACHA_RATES.map((x) => `${x.rank} ${Math.round(x.p * 100)}%`).join(' · ')}</div>
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            <button className="btn grow" disabled={busy || s.silver < C.gachaCost(1)} onClick={() => draw(1, 'normal')}>1회 · {fmt(C.gachaCost(1))}</button>
            <button className="btn primary grow" disabled={busy || s.silver < C.gachaCost(10)} onClick={() => draw(10, 'normal')}>10회 · {fmt(C.gachaCost(10))}</button>
          </div>
        </div>
      </div>
      <div className="panel">
        <div className="row between small"><span>천장 진행도 <span className="muted">(HR 확정)</span></span><b>{pity} / {C.GACHA_PITY}뽑</b></div>
        <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${(pity / C.GACHA_PITY) * 100}%` }} /></div>
        <div className="muted small" style={{ marginTop: 6 }}>{CURRENCY.silver.name} {fmt(s.silver)} 보유 · 카드 {s.cards.length}/{cap}</div>
      </div>

      <h2>재화</h2>
      <div className="panel shoplist">
        <ShopRow ic="✨" name={`${CURRENCY.stardust.name}`} desc={`보스 입장권 ${C.STARDUST_TICKETS}장 충전 · 보유 ${s.stardust}`} right={free} btn="구매" disabled={busy} onClick={() => buy('stardust')} />
        <ShopRow ic="💧" name={`${CURRENCY.vitality.name}`} desc={`체력 전량 회복 · 보유 ${s.vitality}`} right={free} btn="구매" disabled={busy} onClick={() => buy('vitality')} />
      </div>

      <h2>편의</h2>
      <div className="panel shoplist">
        <ShopRow ic="↺" name="스탯 리셋" desc="분배한 속성 포인트를 모두 되돌려요" right={free} btn="사용" disabled={busy} onClick={() => buy('statReset')} />
        <ShopRow ic="⚑" name="진형 변경" desc={`${FACTIONS[s.faction].name} → ${FACTIONS[s.faction === 'dawn' ? 'dusk' : 'dawn'].name}`} right={free} btn="변경" disabled={busy} onClick={() => buy('faction')} />
        <ShopRow ic="▦" name="인벤토리 확장" desc={`보유 한도 ${cap} → ${Math.min(C.INVENTORY_MAX, cap + C.INVENTORY_EXPAND)} (최대 ${C.INVENTORY_MAX})`} right={free} btn="확장" disabled={busy || cap >= C.INVENTORY_MAX} onClick={() => buy('inventory')} />
      </div>

      <button className="rates-link" onClick={() => setRates(true)}>확률 공개 ›</button>

      {got && (
        <Modal title={got.pityHit ? '천장 달성! HR 확정' : '카드팩 결과'} onClose={() => setGot(null)}>
          <div className="cardgrid">{got.uids.map((u) => s.cards.find((c) => c.uid === u)).filter(Boolean).map((c) => <CardView key={(c as CardInstance).uid} c={c as CardInstance} />)}</div>
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => setGot(null)}>확인</button>
        </Modal>
      )}
      {rates && <RatesModal onClose={() => setRates(false)} />}
    </div>
  );
}

function ShopRow({ ic, name, desc, right, btn, disabled, onClick }: { ic: string; name: string; desc: string; right: React.ReactNode; btn: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="shoprow">
      <span className="sic">{ic}</span>
      <div className="grow" style={{ minWidth: 0 }}><b>{name}</b><div className="small muted">{desc}</div>{right}</div>
      <button className="btn sm primary" disabled={disabled} onClick={onClick}>{btn}</button>
    </div>
  );
}

function RatesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="확률 공개" onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>모든 카드팩은 1회마다 아래 확률로 등급을 정한 뒤, 그 등급 카드 중 하나를 같은 확률로 고릅니다. {C.GACHA_PITY}회 안에 HR이 나오지 않으면 {C.GACHA_PITY}번째는 HR 확정이며, HR이 나오면 천장 카운트가 0으로 돌아갑니다. 10회 팩도 1회 팩과 확률이 같습니다.</p>
      {C.GACHA_RATES.map((x) => {
        const list = CARDS.filter((c) => c.rank === x.rank);
        return (
          <div key={x.rank} className="panel" style={{ marginBottom: 8 }}>
            <div className="row between"><b>{x.rank} · {C.RANK_LABEL[x.rank]}</b><b>{(x.p * 100).toFixed(2)}%</b></div>
            <table className="rates"><tbody>
              {list.map((c) => <tr key={c.id}><td>{c.name}</td><td>{((x.p / list.length) * 100).toFixed(3)}%</td></tr>)}
            </tbody></table>
          </div>
        );
      })}
      {C.PICKUP && (() => {
        const hr = C.GACHA_RATES.find((x) => x.rank === 'HR')!.p;
        const n = CARDS.filter((c) => c.rank === 'HR').length;
        const puRate = hr * C.PICKUP.rateUp + hr * (1 - C.PICKUP.rateUp) / n;
        return (
          <div className="panel small">
            <b>{C.PICKUP.title}</b>
            <div className="muted">HR 당첨 시 {Math.round(C.PICKUP.rateUp * 100)}%는 {CARD_MAP[C.PICKUP.cardId].name}, 나머지 {Math.round((1 - C.PICKUP.rateUp) * 100)}%는 HR 전체에서 같은 확률. {CARD_MAP[C.PICKUP.cardId].name} 최종 확률 {(puRate * 100).toFixed(3)}%, 다른 HR 각 {((hr * (1 - C.PICKUP.rateUp) / n) * 100).toFixed(3)}%. 다른 등급은 일반 팩과 같습니다.</div>
          </div>
        );
      })()}
    </Modal>
  );
}
