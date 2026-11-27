// 보스 교전 화면: 개인 보스(퀘스트 탭 배너에서 진입) / 주간 공유 보스(홈에서 진입)
import { useEffect, useState } from 'react';
import type { Run } from '../App';
import { activeDeck, type PlayerState } from '../../server/src/game/player';
import * as C from '../../server/src/game/config';
import type { RaidResult } from '../../server/src/game/engine';
import { CURRENCY } from '../../server/src/game/data';
import { RaidReplay } from './Replay';
import { Bar, fmt } from '../ui/common';

export type BossKind = 'personal' | 'weekly';
export interface WeeklyInfo {
  name: string; glyph: string; kind: string; hp: number; maxHp: number; power: number; defeatedAt: number | null;
  endsAt: number; myDealt: number; myEngagements: number; claimed: boolean; contribution: number; engagements: number;
}
interface RaidOut { result: RaidResult; reward?: { silver: number; cardName?: string } }

export const hoursLeft = (ms: number) => {
  const h = Math.max(0, ms) / 3_600_000;
  if (h >= 48) return `${Math.floor(h / 24)}일 ${Math.floor(h % 24)}시간`;
  return h >= 1 ? `${Math.floor(h)}시간 ${Math.floor((h % 1) * 60)}분` : `${Math.ceil(h * 60)}분`;
};
export const pct = (x: number) => (x > 0 && x < 0.001 ? '0.1% 미만' : `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`);

export default function Raid({ s, run, busy, kind, weekly, setWeekly, onBack }: {
  s: PlayerState; run: Run; busy: boolean; kind: BossKind; weekly: WeeklyInfo | null; setWeekly: (w: WeeklyInfo) => void; onBack: () => void;
}) {
  const [res, setRes] = useState<{ out: RaidOut; boss: { name: string; glyph: string; maxHp: number; kind: string } } | null>(null);
  useEffect(() => { if (kind === 'weekly') run<WeeklyInfo>('weeklyBoss').then((w) => w && setWeekly(w)); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const personal = s.raid.boss;
  const boss = kind === 'personal'
    ? personal && { name: personal.name, glyph: personal.glyph, kind: personal.kind, hp: personal.hp, maxHp: personal.maxHp, power: personal.power, endsAt: personal.expiresAt }
    : weekly && { name: weekly.name, glyph: weekly.glyph, kind: weekly.kind, hp: weekly.hp, maxHp: weekly.maxHp, power: weekly.power, endsAt: weekly.endsAt };
  // 표시용 예상치 (스킬 미발동 기준). 실제 판정은 서버가 한다
  const atk = activeDeck(s, 'atk').reduce((a, c) => a + (c ? c.atk * (c.faction === s.faction ? 1 + C.FACTION_BONUS : 1) : 0), 0);
  const def = activeDeck(s, 'def').reduce((a, c) => a + (c ? c.def * (c.faction === s.faction ? 1 + C.FACTION_BONUS : 1) : 0), 0);
  const estHits = boss ? Math.ceil(def / boss.power) : 0;
  const defeated = kind === 'weekly' && !!weekly && weekly.hp <= 0;

  const go = async () => {
    if (!boss) return;
    const snap = { name: boss.name, glyph: boss.glyph, maxHp: boss.maxHp, kind: boss.kind };
    if (kind === 'personal') {
      const r = await run<RaidOut>('raidEngage');
      if (r) setRes({ out: r, boss: snap });
    } else {
      const r = await run<{ result: RaidResult; boss: WeeklyInfo }>('weeklyEngage');
      if (r) { setWeekly(r.boss); setRes({ out: { result: r.result }, boss: snap }); }
    }
  };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn sm" onClick={onBack}>◀ 뒤로</button>
        <span className="small muted">{kind === 'personal' ? '개인 보스' : '주간 공유 보스'}</span>
      </div>
      {!boss && <div className="panel muted">불러오는 중…</div>}
      {boss && (
        <div className="panel boss">
          <div className="glyph">{boss.glyph}</div>
          <h2 style={{ margin: '6px 0 2px' }}>{boss.name}</h2>
          <div className="muted small">{boss.kind} · 공격력 {fmt(boss.power)} · {defeated ? '격파됨' : `남은 시간 ${hoursLeft(boss.endsAt - Date.now())}`}</div>
          <div className="row between small" style={{ marginTop: 10 }}><span>HP</span><span>{fmt(boss.hp)} / {fmt(boss.maxHp)}</span></div>
          <Bar value={boss.hp} max={boss.maxHp} kind="hp" />
          {kind === 'personal' && personal && <div className="small muted" style={{ marginTop: 6 }}>내 누적 피해 {fmt(personal.dealtByMe)}</div>}
          {kind === 'weekly' && weekly && <div className="small muted" style={{ marginTop: 6 }}>내 피해 {fmt(weekly.myDealt)} · 기여 {pct(weekly.contribution)} · 전체 교전 {fmt(weekly.engagements)}회</div>}
        </div>
      )}
      <div className="panel">
        <dl className="kv">
          <dt>보스 입장권</dt><dd>{s.tickets} / {C.TICKET_CAP} <span className="muted small">(3시간당 1, {CURRENCY.stardust.name}로 최대 {C.TICKET_HARD_CAP})</span></dd>
          <dt>1회 피해 (스킬 전)</dt><dd style={{ color: 'var(--atk)' }}>{fmt(atk)}</dd>
          <dt>방어도 (스킬 전)</dt><dd style={{ color: 'var(--def)' }}>{fmt(def)}</dd>
          <dt>예상 공격 횟수</dt><dd>{estHits}회</dd>
          {kind === 'personal' && <><dt>토벌 수</dt><dd>{s.raid.kills}</dd></>}
        </dl>
        {!defeated && <button className="btn primary block" style={{ marginTop: 10 }} disabled={busy || s.tickets <= 0 || !boss} onClick={go}>교전 (입장권 -1)</button>}
        {defeated && weekly && (
          <button className="btn primary block" style={{ marginTop: 10 }} disabled={busy || weekly.claimed || weekly.myDealt <= 0} onClick={async () => {
            const r = await run<any>('weeklyClaim');
            if (r) { const w = await run<WeeklyInfo>('weeklyBoss'); if (w) setWeekly(w); }
          }}>{weekly.claimed ? '보상 수령 완료' : weekly.myDealt <= 0 ? '이번 주 기여 없음' : `격파 보상 받기 (${CURRENCY.silver.name} ${fmt(C.WEEKLY_REWARD.silver)} · ${CURRENCY.stardust.name} ${C.WEEKLY_REWARD.stardust})`}</button>
        )}
        {s.stardust > 0 && s.tickets + C.STARDUST_TICKETS <= C.TICKET_HARD_CAP && (
          <button className="btn sm block" style={{ marginTop: 6 }} disabled={busy} onClick={() => run('useStardust')}>{CURRENCY.stardust.name} 사용 · 입장권 +{C.STARDUST_TICKETS} ({s.stardust}개 보유)</button>
        )}
      </div>
      <div className="panel small muted">
        교전 시작 시 양쪽 덱 스킬을 한 번 굴리고, 이후에는 <b>공격 먼저 → 보스 반격</b>을 방어도가 0이 될 때까지 반복합니다.
        {kind === 'personal' ? ' 개인 보스는 72시간 동안 머무르고, 쓰러뜨리면 다음 보스가 나타납니다.' : ' 주간 보스는 모든 플레이어가 함께 HP를 깎아요. 쓰러지면 기여한 모두가 보상을 받고, 매주 월요일에 새 보스가 나타납니다.'}
      </div>
      {res && <RaidReplay r={res.out.result} boss={res.boss} reward={res.out.reward} onClose={() => setRes(null)} />}
    </div>
  );
}
