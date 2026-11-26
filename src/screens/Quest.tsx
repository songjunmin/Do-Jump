// 퀘스트: [목록] → [진행: 모험 1회 = 3~5스텝 자동] → [보스 배틀]. 계산은 모두 서버, 여기서는 연출만.
import { useEffect, useRef, useState } from 'react';
import type { Run } from '../App';
import { canEnterPart, chapterAllCleared, leaderCard, type AdventureStep, type PlayerState, type Treasure } from '../../server/src/game/player';
import { ADVENTURE_MAX_STEPS, ADVENTURE_MIN_STEPS, CHAPTERS, DROP_BANDS, adventureMinStamina, partKey, stepsToClear, type Chapter } from '../../server/src/game/questData';
import { fxOf } from '../ui/fx';
import { LEADER_HP_MULT, POINTS_PER_LEVEL } from '../../server/src/game/config';
import { displayName, statsOf } from '../../server/src/game/cards';
import { CARD_MAP, CURRENCY } from '../../server/src/game/data';
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
          {leader && <div className="small" style={{ color: fxOf(leader.cardId).color }}>공격 이펙트: {fxOf(leader.cardId).glyph} {fxOf(leader.cardId).name}</div>}
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
                <div className="muted small">
                  1모험 체력 {p.stamina * ADVENTURE_MIN_STEPS}~{p.stamina * ADVENTURE_MAX_STEPS} · 파트 총 체력 약 {p.stamina * stepsToClear(p)} · 경험치 약 {p.stamina * stepsToClear(p)}
                </div>
                <div className="drops">
                  {[...p.drops.base, ...p.drops.upper].map((id, j) => (
                    <span key={j} className={`pill drop r-${CARD_MAP[id].rank}`}>{CARD_MAP[id].rank} {CARD_MAP[id].name}</span>
                  ))}
                  <span className="pill drop">{CURRENCY.silver.name}</span>
                  <span className="muted small">· 적 {p.monster.glyph} {p.monster.name}</span>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  <div className="grow"><Bar value={cleared && pct === 0 ? 100 : pct} max={100} /></div>
                  <span className="small" style={{ width: 36, textAlign: 'right' }}>{cleared && pct === 0 ? 100 : pct}%</span>
                </div>
              </div>
              <button className="btn sm primary" disabled={!open || !leader || s.stamina < adventureMinStamina(p)} title={s.stamina < adventureMinStamina(p) ? '체력 부족' : undefined} onClick={() => onEnter(ch.id, i + 1)}>모험</button>
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
      <p className="muted small">[모험] 한 번에 3~5스텝이 자동으로 흘러가요(이동·적 조우·보물상자). 체력이 모험 최소치보다 적으면 시작할 수 없어요. 클리어한 파트는 몇 번이든 다시 돌 수 있고, 속성 포인트는 처음 클리어할 때만 받습니다.</p>

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

/* ───────────── 진행 (모험: 3~5스텝 자동) ───────────── */

interface AdventureOut {
  steps: AdventureStep[]; planned: number; stamina: number; exp: number; silver: number; progress: number;
  treasures: Treasure[]; enemies: number; partClear: boolean; firstClear: boolean; points: number; levelUps: number;
  stopReason: string | null; outOfStamina: boolean; bossUnlocked: boolean;
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const readSkip = () => { try { return localStorage.getItem('tcg-quest-skip') === '1'; } catch { return false; } };
const STEP_MS: Record<AdventureStep['type'], number> = { move: 520, enemy: 950, treasure: 850 };

function treasureText(t: Treasure) {
  return t.kind === 'card' ? `${t.cardName} (${t.rank})` : `${CURRENCY.silver.name} ${fmt(t.amount ?? 0)}`;
}

function QuestRun({ s, run, say, chapter, part, onExit }: { s: PlayerState; run: Run; say: Say; chapter: number; part: number; onExit: () => void }) {
  const ch = CHAPTERS.find((c) => c.id === chapter)!;
  const qp = ch.parts[part - 1];
  const key = partKey(chapter, part);
  const leader = leaderCard(s);
  const fx = leader ? fxOf(leader.cardId) : fxOf('');
  const minStamina = adventureMinStamina(qp);
  const [skip, setSkipState] = useState(readSkip);
  const [auto, setAuto] = useState(false);
  const [working, setWorking] = useState(false);
  const [cur, setCur] = useState<{ n: number; i: number; total: number; step: AdventureStep } | null>(null);
  const [summary, setSummary] = useState<AdventureOut | null>(null);
  const [clear, setClear] = useState<AdventureOut | null>(null);
  const [recover, setRecover] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const autoRef = useRef(false);
  const skipRef = useRef(skip);
  const nRef = useRef(0);
  const pct = s.quest.progress[key] ?? 0;

  const setSkip = (v: boolean) => {
    setSkipState(v); skipRef.current = v;
    try { localStorage.setItem('tcg-quest-skip', v ? '1' : '0'); } catch { /* 무시 */ }
  };
  const stopAuto = () => { autoRef.current = false; setAuto(false); };
  useEffect(() => () => { autoRef.current = false; }, []);

  /** 모험 1회: 서버가 3~5스텝을 한 번에 계산 → 여기서는 스텝을 차례로 재생. 계속 진행 가능하면 true */
  const adventureOnce = async (): Promise<boolean> => {
    const r = await run<AdventureOut>('questAdventure', chapter, part);
    if (!r) return false;
    if (!skipRef.current) {
      for (let i = 0; i < r.steps.length; i++) {
        nRef.current++;
        setCur({ n: nRef.current, i, total: r.steps.length, step: r.steps[i] });
        await sleep(STEP_MS[r.steps[i].type]);
      }
      setCur(null);
    }
    const parts = [`${r.steps.length}스텝`, `체력 -${r.stamina}`, `경험치 +${r.exp}`, `${CURRENCY.silver.name} +${fmt(r.silver)}`];
    if (r.enemies) parts.push(`적 ${r.enemies}마리`);
    for (const t of r.treasures) parts.push(`보물: ${treasureText(t)}`);
    setLog((l) => [parts.join(' · '), ...l].slice(0, 5));
    if (r.levelUps > 0) say(`레벨 업! 속성 포인트 +${r.levelUps * POINTS_PER_LEVEL}`);
    if (r.partClear) { setClear(r); return false; }
    if (r.outOfStamina) { setRecover(true); return false; }
    if (!autoRef.current || r.levelUps > 0) setSummary(r);
    return r.levelUps === 0;
  };

  const startOne = async () => {
    if (working) return;
    setSummary(null);
    setWorking(true);
    await adventureOnce();
    setWorking(false);
  };

  const startAuto = async () => {
    if (working) return;
    setSummary(null);
    autoRef.current = true;
    setAuto(true);
    setWorking(true);
    while (autoRef.current) {
      const go = await adventureOnce();
      if (!go) break;
      await sleep(skipRef.current ? 200 : 450);
    }
    stopAuto();
    setWorking(false);
  };

  const enough = s.stamina >= minStamina;
  const step = cur?.step;

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn sm" disabled={working} onClick={onExit}>◀ 목록</button>
        <span className="small muted">제{ch.id}장 · 파트 {part} {qp.name}</span>
      </div>

      <div className={`stage adv${step?.type === 'move' ? ' moving' : ''}`} style={{ background: ch.bg }}>
        <div className="ground" />
        {cur && (
          <div className="stepdots">
            {Array.from({ length: cur.total }, (_, i) => <i key={i} className={i < cur.i ? 'done' : i === cur.i ? 'on' : ''} />)}
          </div>
        )}
        <div className="adv-center">
          {!step && <div className="adv-idle">{working ? '…' : '[모험]을 누르면 3~5스텝이 자동으로 진행돼요'}</div>}
          {step?.type === 'move' && <div key={cur!.n} className="adv-text">이동 중…</div>}
          {step?.type === 'enemy' && step.enemy && (
            <div key={cur!.n} className="adv-enemy">
              <div className="mglyph enemy-die">{step.enemy.glyph}</div>
              <div className="fx" style={{ ['--fx' as any]: fx.color }}><span className={`fx-${fx.kind}`}>{fx.glyph}</span></div>
              <div className="float-dmg">-{fmt(step.enemy.dmg)}{step.enemy.hits > 1 ? ` ×${step.enemy.hits}` : ''}</div>
              <div className="adv-text">{step.enemy.name} 조우 → {fx.name}! 격파</div>
            </div>
          )}
          {step?.type === 'treasure' && step.treasure && (
            <div key={cur!.n} className="adv-treasure">
              <div className="rbox-ic">{step.treasure.grade === 'gold' ? '🎁' : '📦'}</div>
              <div className="adv-text">{step.treasure.grade === 'gold' ? '금색' : '은색'} 보물상자: {treasureText(step.treasure)}</div>
            </div>
          )}
        </div>
        <div key={`w${cur?.n}`} className={`walker${step ? ' step' : ''}`}>🚶</div>
        <div className="stage-leader">{leader && <CardView c={leader} stat="atk" />}</div>
      </div>

      <div className="panel">
        <div className="row between small"><span>달성도</span><span>{cur ? cur.step.progress : pct}%</span></div>
        <Bar value={cur ? cur.step.progress : pct} max={100} />
        <div className="row between small muted" style={{ marginTop: 6 }}>
          <span>체력 {s.stamina} · 스텝당 {qp.stamina} · 모험 최소 {minStamina}</span>
          <span>Lv {s.level}</span>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          <button className="btn primary grow" disabled={working || !enough || !leader} onClick={startOne}>🧭 모험</button>
          {auto
            ? <button className="btn grow" onClick={stopAuto}>■ 정지</button>
            : <button className="btn grow" disabled={working || !enough || !leader} onClick={startAuto}>▶ Auto</button>}
          <label className="btn sm skip-toggle">
            <input type="checkbox" id="quest-skip" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> Skip
          </label>
        </div>
        {!enough && <button className="btn sm block" style={{ marginTop: 8 }} onClick={() => setRecover(true)}>체력이 부족해요 · 회복하기</button>}
        <p className="muted small" style={{ marginBottom: 0 }}>Auto는 체력 부족·파트 클리어·레벨 업에서 멈춰요. Skip을 켜면 스텝 연출 없이 결과만 반영해요.</p>
      </div>

      {log.length > 0 && <div className="panel small muted">{log.map((l, i) => <div key={i} style={{ opacity: 1 - i * 0.16 }}>• {l}</div>)}</div>}

      {summary && (
        <Modal title="모험 결과" onClose={() => setSummary(null)}>
          <AdventureSummary r={summary} />
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary grow" disabled={!enough} onClick={startOne}>계속</button>
            <button className="btn" onClick={onExit}>목록</button>
          </div>
        </Modal>
      )}
      {clear && (
        <Modal title="파트 클리어!" onClose={onExit}>
          <AdventureSummary r={clear} />
          {clear.firstClear ? <p>속성 포인트 <b>+{clear.points}</b> (홈에서 공격·방어 코스트에 분배)</p> : <p className="muted small">재진행 클리어는 속성 포인트를 주지 않아요.</p>}
          {clear.bossUnlocked && <p className="hint">이 장의 보스 배틀이 열렸습니다!</p>}
          <button className="btn primary block" onClick={onExit}>목록으로</button>
        </Modal>
      )}
      {recover && !clear && (
        <Modal title="체력 부족" onClose={() => setRecover(false)}>
          <p className="small">모험을 시작하려면 체력 {minStamina} 이상이 필요해요. 지금 체력 {s.stamina}.</p>
          <div className="row wrap" style={{ gap: 6 }}>
            <button className="btn" disabled={s.staminaReserve <= 0} onClick={async () => { const r = await run<any>('claimReserve'); if (r) say(`예비 체력 ${r.amount} 수령`); }}>예비 체력 수령 ({s.staminaReserve})</button>
            <button className="btn" disabled={s.vitality <= 0} onClick={() => run('useVitality')}>{CURRENCY.vitality.name} 사용 ({s.vitality}개)</button>
          </div>
          <p className="muted small">체력은 1분에 1씩 회복돼요.</p>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary grow" disabled={!enough} onClick={() => { setRecover(false); startOne(); }}>모험 계속</button>
            <button className="btn" onClick={onExit}>목록</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdventureSummary({ r }: { r: AdventureOut }) {
  return (
    <div className="panel">
      <div className="adv-steps">
        {r.steps.map((st, i) => (
          <span key={i} className={`pill st-${st.type}`}>{st.type === 'move' ? '🚶 이동' : st.type === 'enemy' ? `${st.enemy?.glyph} 격파` : `${st.treasure?.grade === 'gold' ? '🎁' : '📦'} 보물`}</span>
        ))}
      </div>
      <dl className="kv" style={{ marginTop: 8 }}>
        <dt>체력</dt><dd>-{r.stamina}</dd>
        <dt>경험치</dt><dd>+{r.exp}</dd>
        <dt>{CURRENCY.silver.name}</dt><dd>+{fmt(r.silver)}</dd>
        <dt>달성도</dt><dd>{r.progress}%</dd>
      </dl>
      {r.levelUps > 0 && <div className="hint" style={{ marginTop: 8 }}>레벨 업! 속성 포인트 +{r.levelUps * POINTS_PER_LEVEL}</div>}
      {r.treasures.length > 0 && <div className="small" style={{ marginTop: 6 }}>{r.treasures.map((t, i) => <div key={i}>{t.grade === 'gold' ? '🎁' : '📦'} {treasureText(t)}</div>)}</div>}
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
