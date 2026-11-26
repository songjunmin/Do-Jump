import { useState } from 'react';
import type { Run } from '../App';
import type { PlayerState } from '../../server/src/game/player';
import { staminaMax } from '../../server/src/game/player';
import * as C from '../../server/src/game/config';
import { CURRENCY, FACTIONS, type FactionId } from '../../server/src/game/data';
import { Bar } from '../ui/common';

export default function Home({ s, run, busy, say }: { s: PlayerState; run: Run; busy: boolean; say: (m: string, e?: boolean) => void }) {
  const [pa, setPa] = useState(0);
  const [pd, setPd] = useState(0);
  const [armReset, setArmReset] = useState(false);

  return (
    <div>
      <div className="panel">
        <div className="row between"><b>Lv {s.level}</b><span className="muted small">EXP {s.exp}/{C.playerExpToNext(s.level)}</span></div>
        <Bar value={s.exp} max={C.playerExpToNext(s.level)} />
        <div className="row between" style={{ marginTop: 10 }}>
          <span>체력 <b>{s.stamina}</b>/{staminaMax(s)} <span className="muted small">· 예비 {s.staminaReserve}/{C.STAMINA_RESERVE_MAX}</span></span>
          <button className="btn sm" disabled={busy || s.staminaReserve <= 0} onClick={async () => { const r = await run<any>('claimReserve'); if (r) say(`예비 체력 ${r.amount} 수령`); }}>예비 수령</button>
        </div>
        <Bar value={s.stamina} max={staminaMax(s)} />
        <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
          <button className="btn sm" disabled={busy || s.vitality <= 0} onClick={() => run('useVitality')}>{CURRENCY.vitality.name} 사용 (체력 전량)</button>
          <button className="btn sm" disabled={busy || s.stardust <= 0} onClick={() => run('useStardust')}>{CURRENCY.stardust.name} 사용 (입장권 +{C.STARDUST_TICKETS})</button>
        </div>
      </div>

      <div className="panel">
        <h2>코스트 스탯</h2>
        <div className="row between"><span>공격 코스트 <b style={{ color: 'var(--atk)' }}>{s.atkCost}</b></span><span>방어 코스트 <b style={{ color: 'var(--def)' }}>{s.defCost}</b></span></div>
        <p className="muted small">덱 코스트 총합의 상한입니다. 공격 ↑ = 레이드 1회 피해, 방어 ↑ = 교전당 공격 횟수.</p>
        {s.statPoints > 0 ? (
          <>
            <div className="row between small"><span>남은 포인트 <b>{s.statPoints - pa - pd}</b></span></div>
            <div className="row" style={{ marginTop: 6 }}>
              <span className="grow">공격 +{pa}</span>
              <button className="btn sm" onClick={() => setPa(Math.max(0, pa - 1))}>−</button>
              <button className="btn sm" disabled={pa + pd >= s.statPoints} onClick={() => setPa(pa + 1)}>+</button>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <span className="grow">방어 +{pd}</span>
              <button className="btn sm" onClick={() => setPd(Math.max(0, pd - 1))}>−</button>
              <button className="btn sm" disabled={pa + pd >= s.statPoints} onClick={() => setPd(pd + 1)}>+</button>
            </div>
            <button className="btn block" style={{ marginTop: 8 }} disabled={busy || pa + pd === 0} onClick={async () => { await run('allocate', pa, pd); setPa(0); setPd(0); }}>분배 확정</button>
          </>
        ) : <p className="muted small">분배할 포인트(속성 포인트)가 없습니다. 레벨 업 +{C.POINTS_PER_LEVEL}, 파트 클리어 +{C.POINTS_PER_PART}.</p>}
      </div>

      <div className="panel">
        <h2>진형</h2>
        <div className="row between">
          <span style={{ color: FACTIONS[s.faction].color }}><b>{FACTIONS[s.faction].name}</b></span>
          {s.level < 10 && (
            <button className="btn sm" disabled={busy} onClick={() => run('setFaction', (s.faction === 'dawn' ? 'dusk' : 'dawn') as FactionId)}>
              {FACTIONS[s.faction === 'dawn' ? 'dusk' : 'dawn'].short}(으)로 변경 (Lv10 전 무료)
            </button>
          )}
        </div>
      </div>

      {C.PROTOTYPE_MODE && (
        <div className="panel">
          <h2>테스트 보급 <span className="pill">프로토타입 전용</span></h2>
          <p className="muted small">강화·진화를 빨리 확인하기 위한 보급입니다. N 6장 + R 1장(+HR 확률) + {CURRENCY.silver.name} 50,000 + {CURRENCY.stardust.name}·{CURRENCY.vitality.name} 1개. 출시 전 제거합니다.</p>
          <div className="row wrap" style={{ gap: 6 }}>
            <button className="btn" disabled={busy} onClick={async () => {
              const r = await run<any>('protoSupply');
              if (r) say(`보급: ${r.names.join(', ')}`);
            }}>보급 받기</button>
            <button className="btn danger sm" disabled={busy} onClick={async () => {
              if (!armReset) { setArmReset(true); window.setTimeout(() => setArmReset(false), 4000); return; }
              setArmReset(false);
              await run('resetMe');
            }}>{armReset ? '한 번 더 누르면 모두 삭제' : '데이터 초기화'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
