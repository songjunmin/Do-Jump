import { useState } from 'react';
import type { Run } from '../App';
import { FACTIONS, type FactionId } from '../../server/src/game/data';

export default function Onboard({ run, busy }: { run: Run; busy: boolean }) {
  const [name, setName] = useState('');
  const [f, setF] = useState<FactionId>('dawn');
  return (
    <div className="main">
      <h2 style={{ fontSize: 22, textAlign: 'center', marginTop: 24 }}>여명과 황혼</h2>
      <p className="muted" style={{ textAlign: 'center' }}>덱을 짜고, 자동 전투 결과를 지켜보는 카드 게임</p>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>이름</h3>
        <input type="text" maxLength={12} placeholder="모험가" value={name} onChange={(e) => setName(e.target.value)} />
        <h3>진형</h3>
        <div className="factions">
          {(Object.keys(FACTIONS) as FactionId[]).map((id) => (
            <button key={id} className={`faction${f === id ? ' on' : ''}`} style={{ ['--fc' as any]: FACTIONS[id].color }} onClick={() => setF(id)}>
              <div className="em">{id === 'dawn' ? '☀' : '🌙'}</div>
              <b>{FACTIONS[id].name}</b>
              <div className="muted small" style={{ marginTop: 4 }}>{FACTIONS[id].desc}</div>
            </button>
          ))}
        </div>
        <p className="muted small">같은 진형 카드는 장당 공격·방어 +3%. 다른 진형 카드도 페널티 없이 쓸 수 있고, 레벨 10 전까지는 무료로 바꿀 수 있어요.</p>
        <button className="btn primary block" disabled={busy} onClick={() => run('createPlayer', name.trim(), f)}>시작하기</button>
      </div>
    </div>
  );
}
