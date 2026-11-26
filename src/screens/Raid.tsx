import { useState } from 'react';
import type { Run } from '../App';
import { activeDeck, type PlayerState } from '../../server/src/game/player';
import * as C from '../../server/src/game/config';
import type { RaidResult } from '../../server/src/game/engine';
import { CURRENCY } from '../../server/src/game/data';
import { RaidReplay } from './Replay';
import { Bar, fmt } from '../ui/common';

interface RaidOut { result: RaidResult; reward?: { silver: number; cardName?: string } }

const hoursLeft = (ms: number) => {
  const h = Math.max(0, ms) / 3_600_000;
  return h >= 1 ? `${Math.floor(h)}시간 ${Math.floor((h % 1) * 60)}분` : `${Math.ceil(h * 60)}분`;
};

export default function Raid({ s, run, busy }: { s: PlayerState; run: Run; busy: boolean }) {
  const [res, setRes] = useState<{ out: RaidOut; boss: { name: string; glyph: string; maxHp: number; kind: string } } | null>(null);
  const boss = s.raid.boss;
  // 표시용 예상치 (스킬 미발동 기준). 실제 판정은 서버가 한다
  const atk = activeDeck(s, 'atk').reduce((a, c) => a + (c ? c.atk * (c.faction === s.faction ? 1 + C.FACTION_BONUS : 1) : 0), 0);
  const def = activeDeck(s, 'def').reduce((a, c) => a + (c ? c.def * (c.faction === s.faction ? 1 + C.FACTION_BONUS : 1) : 0), 0);
  const estHits = boss ? Math.ceil(def / boss.power) : 0;

  const go = async () => {
    if (!boss) return;
    const snap = { name: boss.name, glyph: boss.glyph, maxHp: boss.maxHp, kind: boss.kind };
    const r = await run<RaidOut>('raidEngage');
    if (r) setRes({ out: r, boss: snap });
  };

  return (
    <div>
      {boss && (
        <div className="panel boss">
          <div className="glyph">{boss.glyph}</div>
          <h2 style={{ margin: '6px 0 2px' }}>{boss.name}</h2>
          <div className="muted small">{boss.kind} · 공격력 {fmt(boss.power)} · 남은 시간 {hoursLeft(boss.expiresAt - Date.now())}</div>
          <div className="row between small" style={{ marginTop: 10 }}><span>HP</span><span>{fmt(boss.hp)} / {fmt(boss.maxHp)}</span></div>
          <Bar value={boss.hp} max={boss.maxHp} kind="hp" />
          <div className="small muted" style={{ marginTop: 6 }}>내 누적 피해 {fmt(boss.dealtByMe)}</div>
        </div>
      )}
      <div className="panel">
        <dl className="kv">
          <dt>보스 입장권</dt><dd>{s.tickets} / {C.TICKET_CAP} <span className="muted small">(3시간당 1, {CURRENCY.stardust.name}로 최대 {C.TICKET_HARD_CAP})</span></dd>
          <dt>1회 피해 (스킬 전)</dt><dd style={{ color: 'var(--atk)' }}>{fmt(atk)}</dd>
          <dt>방어도 (스킬 전)</dt><dd style={{ color: 'var(--def)' }}>{fmt(def)}</dd>
          <dt>예상 공격 횟수</dt><dd>{estHits}회</dd>
          <dt>토벌 수</dt><dd>{s.raid.kills}</dd>
        </dl>
        <button className="btn primary block" style={{ marginTop: 10 }} disabled={busy || s.tickets <= 0 || !boss} onClick={go}>교전 (입장권 -1)</button>
      </div>
      <div className="panel small muted">
        교전 시작 시 양쪽 덱 스킬을 한 번 굴리고, 이후에는 <b>공격 먼저 → 보스 반격</b>을 방어도가 0이 될 때까지 반복합니다.
        공격 코스트·공격 덱은 1회 피해를, 방어 코스트·방어 덱은 버티는 횟수를 늘립니다. 보스는 72시간 동안 머무르고, 쓰러뜨리면 다음 보스가 나타납니다.
      </div>
      {res && <RaidReplay r={res.out.result} boss={res.boss} reward={res.out.reward} onClose={() => setRes(null)} />}
    </div>
  );
}
