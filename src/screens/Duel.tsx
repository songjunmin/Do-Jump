import { useState } from 'react';
import type { Run } from '../App';
import { tierOf, type PlayerState } from '../../server/src/game/player';
import * as C from '../../server/src/game/config';
import type { DuelResult } from '../../server/src/game/engine';
import { DuelReplay } from './Replay';
import { Bar } from '../ui/common';

interface DuelOut { result: DuelResult; delta: number; opponent: { name: string; isBot: boolean; score: number; tier: number } }

export default function Duel({ s, run, busy }: { s: PlayerState; run: Run; busy: boolean }) {
  const [res, setRes] = useState<DuelOut | null>(null);
  const [history, setHistory] = useState<{ name: string; win: boolean; delta: number }[]>([]);
  const t = tierOf(s.duel.score);
  const next = C.TIERS[t + 1];
  const left = C.DUEL_DAILY_ATTEMPTS - s.duel.used;

  const go = async () => {
    const r = await run<DuelOut>('duel');
    if (r) {
      setRes(r);
      setHistory((h) => [{ name: r.opponent.name, win: r.result.win, delta: r.delta }, ...h].slice(0, 8));
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="row between">
          <h2 style={{ margin: 0 }}>{C.TIERS[t].name}</h2>
          <span className="pill">점수 {s.duel.score}</span>
        </div>
        {next ? (
          <>
            <div className="row between small muted" style={{ marginTop: 8 }}><span>{C.TIERS[t].min}</span><span>{next.name} {next.min}</span></div>
            <Bar value={s.duel.score - C.TIERS[t].min} max={next.min - C.TIERS[t].min} />
          </>
        ) : <p className="muted small">최상위 티어입니다.</p>}
        <dl className="kv" style={{ marginTop: 10 }}>
          <dt>이번 주 최고</dt><dd>{C.TIERS[s.duel.bestTier].name} (이 아래로는 내려가지 않음)</dd>
          <dt>전적</dt><dd>{s.duel.wins}승 {s.duel.losses}패</dd>
          <dt>오늘 남은 시도</dt><dd>{left} / {C.DUEL_DAILY_ATTEMPTS}</dd>
        </dl>
        <button className="btn primary block" style={{ marginTop: 10 }} disabled={busy || left <= 0} onClick={go}>
          {left > 0 ? '도전하기 (랜덤 매칭)' : '오늘 시도 소진'}
        </button>
      </div>
      <div className="panel small muted">
        상대는 같은 티어 ±1 안에서 무작위로 정해지고, 도전 전에는 상대 정보를 볼 수 없어요. 결과 화면에서 상대 덱을 공개합니다.
        내 <b>공격 덱</b> 공격 총합이 상대 <b>방어 덱</b> 방어 총합보다 커야 이깁니다(동점은 방어 승). 패배 손실은 없습니다.
        매주 월요일 최고 도달 티어 기준으로 보상이 지급돼요.
      </div>
      {history.length > 0 && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>최근 결과</h3>
          {history.map((h, i) => (
            <div key={i} className="row between small" style={{ padding: '3px 0' }}>
              <span>{h.name}</span>
              <span style={{ color: h.win ? 'var(--good)' : 'var(--bad)' }}>{h.win ? '승' : '패'} {h.delta > 0 ? '+' : ''}{h.delta}</span>
            </div>
          ))}
        </div>
      )}
      {res && <DuelReplay r={res.result} me={s.name} opp={res.opponent} delta={res.delta} onClose={() => setRes(null)} />}
    </div>
  );
}
