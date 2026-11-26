// 퀘스트: [목록] → [진행: 몬스터 전투] → [보스 배틀]. 계산은 모두 서버, 여기서는 연출만.
import { useEffect, useRef, useState } from 'react';
import type { Run } from '../App';
import { canEnterPart, chapterAllCleared, leaderCard, type PlayerState, type QuestBox } from '../../server/src/game/player';
import { CHAPTERS, DROP_BANDS, partKey, type Chapter } from '../../server/src/game/questData';
import { LEADER_HP_MULT, POINTS_PER_LEVEL } from '../../server/src/game/config';
import { displayName, statsOf } from '../../server/src/game/cards';
import { CURRENCY } from '../../server/src/game/data';
import type { LeaderBattleResult } from '../../server/src/game/engine';
import { Bar, CardView, MiniCard, Modal, fmt } from '../ui/common';

type Say = (m: string, e?: boolean) => void;
type View = { kind: 'list' } | { kind: 'run'; chapter: number; part: number };

export default function Quest({ s, run, busy, say }: { s: PlayerState; run: Run; busy: boolean; say: Say }) {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [chapterId, setChapterId] = useState(() => Math.min(s.quest.unlocked, CHAPTERS.length));
  if (view.kind === 'run') {
    return <QuestRun s={s} run={run} say={say} chapter={view.chapter} part={view.part} onExit={() => setView({ kind: 'list' })} />;
  }
  return <QuestList s={s} run={run} busy={busy} chapterId={chapterId} setChapterId={setChapterId} onEnter={(c, p) => setView({ kind: 'run', chapter: c, part: p })} />;
}

/* ───────────── 목록 ───────────── */

function QuestList({ s, run, busy, chapterId, setChapterId, onEnter }: {
  s: PlayerState; run: Run; busy: boolean; chapterId: number; setChapterId: (n: number) => void; onEnter: (c: number, p: number) => void;
}) {
  const ch = CHAPTERS.find((c) => c.id === chapterId) ?? CHAPTERS[0];
  const [picking, setPicking] = useState(false);
  const [boss, setBoss] = useState<{ result: LeaderBattleResult; reward?: any; ch: Chapter } | null>(null);
  const leader = leaderCard(s);
  const allCleared = chapterAllCleared(s, ch);
  const bossDone = !!s.quest.bossCleared[String(ch.id)];
  const maxCh = Math.min(s.quest.unlocked, CHAPTERS.length);

  return (
    <div>
      <div className="panel row" style={{ gap: 12 }}>
        <div style={{ width: 84 }}>{leader ? <CardView c={leader} stat="atk" onClick={() => setPicking(true)} /> : <button className="card empty" style={{ width: '100%' }} onClick={() => setPicking(true)}>리더 선택</button>}</div>
        <div className="grow">
          <div className="muted small">리더 카드</div>
          <b>{leader ? displayName(leader) : '없음'}</b>
          {leader && <div className="small muted">공격 {fmt(statsOf(leader).atk)} · 보스전 체력 {fmt(statsOf(leader).def * LEADER_HP_MULT)}</div>}
          <button className="btn sm" style={{ marginTop: 6 }} onClick={() => setPicking(true)}>변경</button>
        </div>
      </div>

      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn sm" disabled={ch.id <= 1} onClick={() => setChapterId(ch.id - 1)}>◀</button>
        <div style={{ textAlign: 'center' }}>
          <b>제{ch.id}장 {ch.name}</b>
          <div className="muted small">{DROP_BANDS[ch.band].label} 구간 · {DROP_BANDS[ch.band].base} 위주, 간혹 {DROP_BANDS[ch.band].upper}</div>
        </div>
        <button className="btn sm" disabled={ch.id >= maxCh} onClick={() => setChapterId(ch.id + 1)}>▶</button>
      </div>

      <div className="qlist">
        {ch.parts.map((p, i) => {
          const key = partKey(ch.id, i + 1);
          const pct = s.quest.progress[key] ?? 0;
          const cleared = !!s.quest.cleared[key];
          const open = canEnterPart(s, ch.id, i + 1);
          return (
            <div key={key} className={`qpart${open ? '' : ' locked'}`}>
              <div className="qglyph">{open ? p.monster.glyph : '🔒'}</div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row between">
                  <b className="small">파트 {i + 1} · {p.name}</b>
                  {cleared && <span className="pill clear">클리어</span>}
                </div>
                <div className="muted small">{p.monster.name} · 체력 {p.stamina}</div>
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  <div className="grow"><Bar value={cleared && pct === 0 ? 100 : pct} max={100} /></div>
                  <span className="small" style={{ width: 36, textAlign: 'right' }}>{cleared && pct === 0 ? 100 : pct}%</span>
                </div>
              </div>
              <button className="btn sm primary" disabled={!open || !leader} onClick={() => onEnter(ch.id, i + 1)}>{cleared ? '다시' : '진행'}</button>
            </div>
          );
        })}
        <div className={`qpart boss${allCleared ? '' : ' locked'}`}>
          <div className="qglyph">{allCleared ? ch.boss.glyph : '🔒'}</div>
          <div className="grow">
            <b className="small">보스 · {ch.boss.name}</b>
            <div className="muted small">
              {bossDone ? '클리어 (재도전 불가)' : allCleared ? `HP ${fmt(ch.boss.hp)} · 공격 ${fmt(ch.boss.atk)} · 리더 1장으로 자동 전투` : '모든 파트를 100% 완료하면 열립니다'}
            </div>
          </div>
          <button className="btn sm primary" disabled={busy || !allCleared || bossDone || !leader} onClick={async () => {
            const r = await run<any>('questBoss', ch.id);
            if (r) setBoss({ result: r.result, reward: r.reward, ch });
          }}>{bossDone ? '완료' : '도전'}</button>
        </div>
      </div>
      <p className="muted small">클리어한 파트는 몇 번이든 다시 돌 수 있어요(강화 재료 수급용). 속성 포인트는 파트를 처음 클리어할 때만 받습니다.</p>

      {picking && (
        <Modal title="리더 카드 선택" onClose={() => setPicking(false)}>
          <p className="muted small" style={{ marginTop: 0 }}>퀘스트와 장 보스전에는 리더 카드 1장만 나갑니다. 리더는 강화·진화 재료로 쓸 수 없어요.</p>
          <div className="cardgrid">
            {[...s.cards].sort((a, b) => statsOf(b).atk - statsOf(a).atk).map((c) => (
              <CardView key={c.uid} c={c} selected={c.uid === s.quest.leader} onClick={async () => { await run('setLeader', c.uid); setPicking(false); }} />
            ))}
          </div>
        </Modal>
      )}
      {boss && <BossReplay data={boss} onClose={() => { if (boss.result.win && boss.reward?.nextChapter) setChapterId(boss.reward.nextChapter); setBoss(null); }} />}
    </div>
  );
}

/* ───────────── 진행 (몬스터 전투) ───────────── */

interface BattleOut {
  monster: { name: string; glyph: string; hp: number }; leaderAtk: number; hits: number; stamina: number; exp: number; silver: number; progress: number;
  partClear: boolean; firstClear: boolean; points: number; levelUps: number; box: QuestBox | null; stopReason: string | null; bossUnlocked: boolean;
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const readSkip = () => { try { return localStorage.getItem('tcg-quest-skip') === '1'; } catch { return false; } };

function QuestRun({ s, run, say, chapter, part, onExit }: { s: PlayerState; run: Run; say: Say; chapter: number; part: number; onExit: () => void }) {
  const ch = CHAPTERS.find((c) => c.id === chapter)!;
  const qp = ch.parts[part - 1];
  const key = partKey(chapter, part);
  const leader = leaderCard(s);
  const [skip, setSkipState] = useState(readSkip);
  const [auto, setAuto] = useState(false);
  const [working, setWorking] = useState(false);
  const [anim, setAnim] = useState<{ n: number; out: BattleOut } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [box, setBox] = useState<QuestBox | null>(s.quest.box);
  const [clear, setClear] = useState<BattleOut | null>(null);
  const autoRef = useRef(false);
  const skipRef = useRef(skip);
  const pct = s.quest.progress[key] ?? 0;

  const setSkip = (v: boolean) => {
    setSkipState(v); skipRef.current = v;
    try { localStorage.setItem('tcg-quest-skip', v ? '1' : '0'); } catch { /* 무시 */ }
  };
  const stopAuto = () => { autoRef.current = false; setAuto(false); };
  useEffect(() => () => { autoRef.current = false; }, []);

  /** 전투 1회. 정지 조건이면 false */
  const battleOnce = async (): Promise<boolean> => {
    const r = await run<BattleOut>('questBattle', chapter, part);
    if (!r) return false;
    setAnim((a) => ({ n: (a?.n ?? 0) + 1, out: r }));
    const line = [`${r.monster.name} 처치`, `체력 -${r.stamina}`, `경험치 +${r.exp}`, `${CURRENCY.silver.name} +${fmt(r.silver)}`];
    setLog((l) => [line.join(' · '), ...l].slice(0, 5));
    if (r.levelUps > 0) say(`레벨 업! 속성 포인트 +${r.levelUps * POINTS_PER_LEVEL}`);
    if (r.box) setBox(r.box);
    if (r.partClear) setClear(r);
    return !r.stopReason;
  };

  const attack = async () => {
    if (working) return;
    setWorking(true);
    await battleOnce();
    if (!skipRef.current) await sleep(350);
    setWorking(false);
  };

  const startAuto = async () => {
    if (working) return;
    autoRef.current = true;
    setAuto(true);
    setWorking(true);
    while (autoRef.current) {
      const go = await battleOnce();
      if (!go) break;
      await sleep(skipRef.current ? 150 : 600);
    }
    stopAuto();
    setWorking(false);
  };

  const continueBox = async () => {
    await run('questContinue');
    setBox(null);
  };

  const enough = s.stamina >= qp.stamina;
  const showClear = clear && !box;

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn sm" disabled={auto} onClick={onExit}>◀ 목록</button>
        <span className="small muted">제{ch.id}장 · 파트 {part} {qp.name}</span>
      </div>

      <div className="stage" style={{ background: ch.bg }}>
        <div className="stage-monster">
          <div key={anim?.n} className={`mglyph${anim && !skip ? ' hit' : ''}`}>{qp.monster.glyph}</div>
          {anim && !skip && <div key={`d${anim.n}`} className="float-dmg">-{fmt(anim.out.leaderAtk)}{anim.out.hits > 1 ? ` ×${anim.out.hits}` : ''}</div>}
          <div className="small">{qp.monster.name}</div>
        </div>
        <div className="stage-leader">{leader && <CardView c={leader} stat="atk" />}</div>
      </div>

      <div className="panel">
        <div className="row between small"><span>달성도</span><span>{pct}%</span></div>
        <Bar value={pct} max={100} />
        <div className="row between small muted" style={{ marginTop: 6 }}>
          <span>체력 {s.stamina} (전투당 {qp.stamina})</span>
          <span>Lv {s.level}</span>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          <button className="btn primary grow" disabled={working || !enough || !!box || !leader} onClick={attack}>⚔ 공격</button>
          {auto
            ? <button className="btn grow" onClick={stopAuto}>■ 정지</button>
            : <button className="btn grow" disabled={working || !enough || !!box || !leader} onClick={startAuto}>▶ Auto</button>}
          <label className="btn sm skip-toggle">
            <input type="checkbox" id="quest-skip" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> Skip
          </label>
        </div>
        {!enough && <p className="small" style={{ color: 'var(--bad)', marginBottom: 0 }}>체력이 부족합니다. 홈에서 예비 체력이나 {CURRENCY.vitality.name}를 쓰세요.</p>}
        <p className="muted small" style={{ marginBottom: 0 }}>Auto는 체력이 떨어지거나 파트 클리어·레벨 업·보상 상자에서 멈춥니다. Skip을 켜면 연출 없이 결과만 반영해요.</p>
      </div>

      {log.length > 0 && <div className="panel small muted">{log.map((l, i) => <div key={i} style={{ opacity: 1 - i * 0.16 }}>• {l}</div>)}</div>}

      {box && (
        <Modal title={box.grade === 'gold' ? '금색 보상 상자' : '은색 보상 상자'} onClose={continueBox}>
          <div className={`rbox ${box.grade}`}>
            <div className="rbox-ic">{box.grade === 'gold' ? '🎁' : '📦'}</div>
            {box.kind === 'card'
              ? <div><b>{box.cardName}</b> <span className="pill">{box.rank}</span></div>
              : <div><b>{CURRENCY.silver.name} {fmt(box.amount ?? 0)}</b></div>}
            <div className="muted small">{box.grade === 'gold' ? '금색 상자는 상위 등급 카드가 확정이에요.' : '은색 상자는 낮은 확률로 상위 등급 카드가 나와요.'}</div>
          </div>
          <button className="btn primary block" onClick={continueBox}>계속</button>
        </Modal>
      )}
      {showClear && clear && (
        <Modal title="파트 클리어!" onClose={onExit}>
          <p>{qp.name} 달성도 100%</p>
          {clear.firstClear ? <p>속성 포인트 <b>+{clear.points}</b> (홈에서 공격·방어 코스트에 분배)</p> : <p className="muted small">재진행 클리어는 속성 포인트를 주지 않아요.</p>}
          {clear.bossUnlocked && <p className="hint">이 장의 보스 배틀이 열렸습니다!</p>}
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary grow" onClick={onExit}>목록으로</button>
            <button className="btn" onClick={() => setClear(null)}>여기서 계속</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ───────────── 보스 배틀 (리더 1장 자동 턴제) ───────────── */

function BossReplay({ data, onClose }: { data: { result: LeaderBattleResult; reward?: any; ch: Chapter }; onClose: () => void }) {
  const { result: r, ch, reward } = data;
  const total = r.turns.length;
  const [step, setStep] = useState(0);
  const ms = Math.max(120, Math.min(380, 4500 / Math.max(1, total)));
  useEffect(() => {
    if (step >= total) return;
    const t = window.setTimeout(() => setStep((x) => x + 1), ms);
    return () => window.clearTimeout(t);
  }, [step, total, ms]);
  const done = step >= total;
  const cur = step > 0 ? r.turns[step - 1] : null;
  const lhp = cur ? cur.leaderHp : r.leaderHp;
  const bhp = cur ? cur.bossHp : r.bossHp;
  return (
    <div className="battle">
      <div className="inner">
        <div className="row between"><b>보스 배틀 · 제{ch.id}장</b>{!done && <button className="btn sm" onClick={() => setStep(total)}>스킵 ▶▶</button>}</div>
        <div className="stage" style={{ background: ch.bg, minHeight: 200 }}>
          <div className="stage-monster">
            <div key={`b${step}`} className={`mglyph${cur?.by === 'leader' ? ' hit' : ''}`} style={{ fontSize: 72 }}>{ch.boss.glyph}</div>
            {cur?.by === 'leader' && <div key={`bd${step}`} className="float-dmg">-{fmt(cur.dmg)}</div>}
            <div className="small">{ch.boss.name}</div>
          </div>
          <div key={`l${step}`} className={`stage-leader${cur?.by === 'boss' ? ' hurt' : ''}`}><MiniCard c={r.leader} stat="atk" /></div>
        </div>
        <div className="panel">
          <div className="row between small"><span>보스 HP</span><span>{fmt(bhp)} / {fmt(r.bossHp)}</span></div>
          <Bar value={bhp} max={r.bossHp} kind="hp" />
          <div className="row between small" style={{ marginTop: 8 }}>
            <span>{r.leader.name} 체력 {cur?.by === 'boss' && <span style={{ color: 'var(--bad)' }}>-{fmt(cur.dmg)}</span>}</span>
            <span>{fmt(lhp)} / {fmt(r.leaderHp)}</span>
          </div>
          <Bar value={lhp} max={r.leaderHp} kind="pool" />
          <div className="small muted" style={{ marginTop: 6 }}>턴 {Math.ceil(Math.min(step, total) / 2)} · 리더 공격 {fmt(r.leader.atk)} / 보스 공격 {fmt(ch.boss.atk)}</div>
        </div>
        {done && (
          <>
            <div className={`verdict ${r.win ? 'win' : 'lose'}`}>{r.win ? '승리' : '패배'}</div>
            <div className="panel small">
              {r.win
                ? <>
                    <div>{reward?.nextChapter ? `제${reward.nextChapter}장이 열렸습니다.` : '마지막 장을 클리어했습니다.'}</div>
                    <div>보상: {CURRENCY.vitality.name} +{reward?.vitality ?? 1}{reward?.cardName ? ` · ${reward.cardName}` : ''}</div>
                    <div className="muted">보스전은 1회성이라 다시 도전할 수 없어요.</div>
                  </>
                : <div>리더 카드를 강화하거나 바꿔서 다시 도전하세요. 패배해도 잃는 것은 없습니다.</div>}
            </div>
            <button className="btn primary block" onClick={onClose}>확인</button>
          </>
        )}
      </div>
    </div>
  );
}
