// 서버가 돌려준 전투 결과를 재생만 하는 연출. 계산은 하지 않는다. 언제든 스킵 가능.
import { useEffect, useState } from 'react';
import { SLOT_CHANCE, SLOT_PRIORITY } from '../../server/src/game/config';
import type { DuelResult, RaidResult, SideResult } from '../../server/src/game/engine';
import { MiniCard, Bar, fmt } from '../ui/common';

function useSteps(total: number, ms: number | ((step: number) => number)) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= total) return;
    const delay = typeof ms === 'function' ? ms(step) : ms;
    const t = window.setTimeout(() => setStep((x) => x + 1), delay);
    return () => window.clearTimeout(t);
  }, [step, total, ms]);
  return [step, () => setStep(total)] as const;
}

/** 우선순위 순서로 몇 번째에 공개되는지 */
const revealOrder = (slot: number) => SLOT_PRIORITY.indexOf(slot);

function Rolls({ side, revealed }: { side: SideResult; revealed: number }) {
  return (
    <div className="rolls">
      {[0, 1, 2, 3, 4].map((slot) => {
        const r = side.rolls.find((x) => x.slot === slot);
        const shown = revealOrder(slot) < revealed;
        if (!r) return <div key={slot} className="roll off">{Math.round(SLOT_CHANCE[slot] * 100)}%<br />—</div>;
        if (!shown) return <div key={slot} className="roll">{Math.round(SLOT_CHANCE[slot] * 100)}%<br />?</div>;
        const cls = r.applied ? 'on' : r.triggered ? 'blk' : 'off';
        const label = r.applied ? '발동!' : r.blocked === 'duplicate' ? '중복' : r.blocked === 'cap' ? '3개 초과' : '불발';
        return <div key={slot} className={`roll ${cls}`}>{r.skillName}<br />{label}</div>;
      })}
    </div>
  );
}

function SideBlock({ title, side, stat, revealed, final }: { title: string; side: SideResult; stat: 'atk' | 'def'; revealed: number; final: boolean }) {
  const pct = Math.round((side.mult - 1) * 100);
  return (
    <div className={`side ${stat}`}>
      <div className="title">
        <span>{title}</span>
        <span className="total">{fmt(final ? side.total : side.base)}</span>
      </div>
      <div className="slots">{side.deck.map((c, i) => <MiniCard key={i} c={c} stat={stat} />)}</div>
      <Rolls side={side} revealed={revealed} />
      <div className="small muted" style={{ marginTop: 4, textAlign: 'right' }}>
        기본 {fmt(side.base)}{final && pct !== 0 ? ` × 스킬 ${pct > 0 ? '+' : ''}${pct}%` : ''}
      </div>
    </div>
  );
}

export function DuelReplay({ r, me, opp, delta, onClose }: {
  r: DuelResult; me: string; opp: { name: string; isBot: boolean; score: number }; delta: number; onClose: () => void;
}) {
  const TOTAL = 12;
  const [step, skip] = useSteps(TOTAL, (st) => (st < 10 ? 380 : 700));
  const done = step >= TOTAL;
  return (
    <div className="battle">
      <div className="inner">
        <div className="row between"><b>결투장</b>{!done && <button className="btn sm" onClick={skip}>스킵 ▶▶</button>}</div>
        <SideBlock title={`⚔ ${me}의 공격`} side={r.attacker} stat="atk" revealed={Math.min(5, step)} final={step >= 11} />
        <div className="vs">VS</div>
        <SideBlock title={`🛡 ${opp.name}의 방어`} side={r.defender} stat="def" revealed={Math.max(0, step - 5)} final={step >= 11} />
        {done && (
          <>
            <div className={`verdict ${r.win ? 'win' : 'lose'}`}>{r.win ? '승리' : '패배'}</div>
            <div className="panel small">
              <div>점수 {delta > 0 ? '+' : ''}{delta} · 상대 점수 {opp.score} {opp.isBot ? '(설계 봇)' : '(유저 방어 덱)'}</div>
              {!r.win && r.attacker.total === r.defender.total && <div className="muted">동점은 방어 측 승리입니다.</div>}
              <div className="muted">패배해도 잃는 것은 없습니다.</div>
            </div>
            <button className="btn primary block" onClick={onClose}>확인</button>
          </>
        )}
      </div>
    </div>
  );
}

export function RaidReplay({ r, boss, onClose, reward }: {
  r: RaidResult; boss: { name: string; glyph: string; maxHp: number; kind: string }; reward?: { silver: number; cardName?: string }; onClose: () => void;
}) {
  const skillSteps = 10;
  const hitSteps = r.timeline.length;
  const TOTAL = skillSteps + 1 + hitSteps;
  const hitMs = Math.max(70, Math.min(260, 3200 / Math.max(1, hitSteps)));
  const [step, skip] = useSteps(TOTAL, (st) => (st < skillSteps ? 220 : st === skillSteps ? 600 : hitMs));
  const done = step >= TOTAL;
  const hitIdx = step - skillSteps - 1; // 마지막으로 보여준 교환 인덱스
  const cur = hitIdx >= 0 ? r.timeline[Math.min(hitIdx, hitSteps - 1)] : null;
  const hp = cur ? cur.bossHp : r.bossHpBefore;
  const pool = cur ? cur.pool : r.defense.total;
  return (
    <div className="battle">
      <div className="inner">
        <div className="row between"><b>레이드 · {boss.name} ({boss.kind})</b>{!done && <button className="btn sm" onClick={skip}>스킵 ▶▶</button>}</div>
        <div className="boss panel">
          <div key={hitIdx} className={`glyph${cur ? ' hit' : ''}`}>{boss.glyph}</div>
          <div className="dmg">{cur ? `-${fmt(cur.dealt)}` : ''}</div>
          <div className="row between small"><span>보스 HP</span><span>{fmt(hp)} / {fmt(boss.maxHp)}</span></div>
          <Bar value={hp} max={boss.maxHp} kind="hp" />
          <div className="row between small" style={{ marginTop: 8 }}><span>내 방어도 (보스 공격력 {fmt(r.bossPower)})</span><span>{fmt(pool)} / {fmt(r.defense.total)}</span></div>
          <Bar value={pool} max={r.defense.total} kind="pool" />
          <div className="small muted" style={{ marginTop: 6 }}>교환 {Math.max(0, Math.min(hitIdx + 1, hitSteps))} / {hitSteps}</div>
        </div>
        <SideBlock title="⚔ 공격 덱 (1회 피해)" side={r.attack} stat="atk" revealed={Math.min(5, step)} final={step >= skillSteps} />
        <SideBlock title="🛡 방어 덱 (방어도)" side={r.defense} stat="def" revealed={Math.max(0, step - 5)} final={step >= skillSteps} />
        {done && (
          <>
            <div className={`verdict ${r.killed ? 'win' : 'lose'}`} style={{ fontSize: 26 }}>{r.killed ? '토벌!' : '퇴각'}</div>
            <div className="panel small">
              <div>총 피해 <b>{fmt(r.dealt)}</b> · 공격 {r.hits}회</div>
              {reward && <div>보상: 은화 {fmt(reward.silver)}{reward.cardName ? ` · ${reward.cardName}` : ''}</div>}
            </div>
            <button className="btn primary block" onClick={onClose}>확인</button>
          </>
        )}
      </div>
    </div>
  );
}
