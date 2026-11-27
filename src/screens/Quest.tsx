// 퀘스트: [목록] → [진행: Enter 1회 = 1스텝, 고정 레이아웃에서 장면 그림만 바뀜] → [보스 배틀].
// 계산은 모두 서버, 여기서는 연출만.
import { useEffect, useRef, useState } from 'react';
import type { Go, Run } from '../App';
import { hoursLeft } from './Raid';
import { canEnterPart, chapterAllCleared, inventoryCap, leaderCard, sellPrice, staminaMax, type AdventureStep, type PlayerState } from '../../server/src/game/player';
import { CHAPTERS, partKey, stepExp, stepSilver, stepsToClear, type Chapter } from '../../server/src/game/questData';
import { fxOf } from '../ui/fx';
import { LEADER_HP_MULT, TICKET_CAP, POINTS_PER_LEVEL, playerExpToNext } from '../../server/src/game/config';
import { displayName, master, rankOf, statsOf, toBattleCard } from '../../server/src/game/cards';
import { CARD_MAP, CURRENCY, FACTIONS } from '../../server/src/game/data';
import type { LeaderBattleResult } from '../../server/src/game/engine';
import { Bar, CardView, MiniCard, Modal, fmt } from '../ui/common';

type Say = (m: string, e?: boolean) => void;
type View = { kind: 'list' } | { kind: 'bosses' } | { kind: 'run'; chapter: number; part: number };

export default function Quest({ s, run, busy, say, go }: { s: PlayerState; run: Run; busy: boolean; say: Say; go: Go }) {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [chapterId, setChapterId] = useState(() => Math.min(s.quest.unlocked, CHAPTERS.length));
  if (view.kind === 'bosses') return <BossList s={s} go={go} onBack={() => setView({ kind: 'list' })} />;
  if (view.kind === 'run') {
    return <QuestRun s={s} run={run} say={say} chapter={view.chapter} part={view.part} onExit={() => setView({ kind: 'list' })} />;
  }
  const bosses = s.raid.boss ? 1 : 0;
  return (
    <>
      <button className="bossbanner" onClick={() => setView({ kind: 'bosses' })}>
        <span>⚔ 교전 중인 보스 <b>{bosses}</b>마리</span>
        <span className="small">입장권 {s.tickets}/{TICKET_CAP} ›</span>
      </button>
      <QuestList s={s} run={run} busy={busy} chapterId={chapterId} setChapterId={setChapterId} onEnter={(c, p) => setView({ kind: 'run', chapter: c, part: p })} />
    </>
  );
}

/** 교전 중인 개인 보스 목록 */
function BossList({ s, go, onBack }: { s: PlayerState; go: Go; onBack: () => void }) {
  const b = s.raid.boss;
  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn sm" onClick={onBack}>◀ 퀘스트</button>
        <span className="small muted">보스 입장권 {s.tickets}/{TICKET_CAP}</span>
      </div>
      <h2 style={{ marginTop: 0 }}>교전 중인 보스</h2>
      {b ? (
        <button className="panel bossrow" style={{ width: '100%' }} onClick={() => go('boss', null, 'personal')}>
          <span className="bg">{b.glyph}</span>
          <span className="grow">
            <span className="row between small"><b>{b.name}</b><span className="muted">{hoursLeft(b.expiresAt - Date.now())}</span></span>
            <Bar value={b.hp} max={b.maxHp} kind="hp" />
            <span className="small muted">{b.kind} · HP {fmt(b.hp)} / {fmt(b.maxHp)} · 내 피해 {fmt(b.dealtByMe)}</span>
          </span>
        </button>
      ) : <p className="muted">지금 교전 중인 보스가 없어요.</p>}
      <p className="muted small">개인 보스는 72시간 동안 머물러요. 쓰러뜨리면 다음 보스가 나타나요. 주간 공유 보스는 홈에서 볼 수 있어요.</p>
    </div>
  );
}

/** 퀘스트에서 얻었거나 지금 보유 중인 카드 → 드랍 칸 공개 */
const knownCards = (s: PlayerState) => {
  const set = new Set(Object.keys(s.quest.found || {}));
  for (const c of s.cards) set.add(c.cardId);
  return set;
};

/* ───────────── 목록 ───────────── */

function QuestList({ s, run, busy, chapterId, setChapterId, onEnter }: {
  s: PlayerState; run: Run; busy: boolean; chapterId: number; setChapterId: (n: number) => void; onEnter: (c: number, p: number) => void;
}) {
  const ch = CHAPTERS.find((c) => c.id === chapterId) ?? CHAPTERS[0];
  const [boss, setBoss] = useState<{ result: LeaderBattleResult; reward?: any; ch: Chapter } | null>(null);
  const leader = leaderCard(s);
  const allCleared = chapterAllCleared(s, ch);
  const bossDone = !!s.quest.bossCleared[String(ch.id)];
  const maxCh = Math.min(s.quest.unlocked, CHAPTERS.length);
  const known = knownCards(s);
  const expNext = playerExpToNext(s.level);

  return (
    <div>
      <div className="qhead" style={{ background: ch.bg }}>
        <button className="btn sm" disabled={ch.id <= 1} onClick={() => setChapterId(ch.id - 1)}>◀</button>
        <div className="qhead-title">
          <div className="qhead-ch">제{ch.id}장: {ch.name}</div>
          <div className="qbanner">{ch.parts.map((p, i) => <span key={i} style={{ animationDelay: `${i * 0.15}s` }}>{p.monster.glyph}</span>)}<b>{ch.boss.glyph}</b></div>
        </div>
        <button className="btn sm" disabled={ch.id >= maxCh} onClick={() => setChapterId(ch.id + 1)}>▶</button>
      </div>

      <div className="panel qstat">
        <div>
          <div className="row between small"><span>체력</span><span>{s.stamina}/{staminaMax(s)}</span></div>
          <Bar value={s.stamina} max={staminaMax(s)} kind="pool" />
        </div>
        <div>
          <div className="row between small"><span>경험치</span><span>{s.exp}/{expNext}</span></div>
          <Bar value={s.exp} max={expNext} />
        </div>
        <div className="qstat-leader small">
          {leader
            ? <>리더 <b>{displayName(leader)}</b> <span style={{ color: fxOf(leader.cardId).color }}>{fxOf(leader.cardId).glyph} {fxOf(leader.cardId).name}</span> <span className="muted">· 변경은 카드 탭</span></>
            : <span style={{ color: 'var(--bad)' }}>리더 카드가 없어요. 카드 탭에서 리더로 지정하세요.</span>}
        </div>
      </div>

      <div className="qlist">
        {ch.parts.map((p, i) => {
          const key = partKey(ch.id, i + 1);
          const raw = s.quest.progress[key] ?? 0;
          const cleared = !!s.quest.cleared[key];
          const pct = cleared && raw === 0 ? 100 : raw;
          const open = canEnterPart(s, ch.id, i + 1);
          const silver = stepSilver(p);
          const drops = [...p.drops.base, ...p.drops.upper];
          return (
            <div key={key} className={`qpart2${open ? '' : ' locked'}`}>
              <div className="row between">
                <b>{ch.id}-{i + 1} {p.name}</b>
                {cleared ? <span className="pill clear">클리어</span> : !open && <span className="pill">🔒 잠김</span>}
              </div>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <span className="small muted" style={{ width: 40 }}>달성도</span>
                <div className="grow"><Bar value={pct} max={100} /></div>
                <span className="small" style={{ width: 36, textAlign: 'right' }}>{pct}%</span>
              </div>
              <div className="qnums">
                <div><span>소비 체력</span><b>-{p.stamina}</b></div>
                <div><span>획득 경험치</span><b>+{stepExp(p)}</b></div>
                <div><span>{CURRENCY.silver.name} 획득</span><b>+{fmt(silver.min)} ~ {fmt(silver.max)}</b></div>
              </div>
              <div className="row between" style={{ marginTop: 8, alignItems: 'flex-end' }}>
                <div className="dropslots">
                  {drops.map((id, j) => {
                    const m = CARD_MAP[id];
                    const k = known.has(id);
                    return (
                      <div key={j} className={`dslot${k ? '' : ' unknown'}`} style={{ ['--rc' as any]: `var(--r-${m.rank})` }} title={k ? `${m.rank} ${m.name}` : '미획득'}>
                        {k ? <><span className="g">{m.glyph}</span><span className="r">{m.rank}</span></> : <span className="g">?</span>}
                      </div>
                    );
                  })}
                  <span className="muted small" style={{ alignSelf: 'center' }}>약 {stepsToClear(p)}스텝</span>
                </div>
                <button className="btn primary" disabled={!open || !leader || s.stamina < p.stamina} onClick={() => onEnter(ch.id, i + 1)}>Enter</button>
              </div>
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
            {leader && allCleared && !bossDone && <div className="muted small">리더 공격 {fmt(statsOf(leader).atk)} · 체력 {fmt(statsOf(leader).def * LEADER_HP_MULT)}</div>}
          </div>
          <button className="btn sm primary" disabled={busy || !allCleared || bossDone || !leader} onClick={async () => {
            const r = await run<any>('questBoss', ch.id);
            if (r) setBoss({ result: r.result, reward: r.reward, ch });
          }}>{bossDone ? '완료' : '도전'}</button>
        </div>
      </div>
      <p className="muted small">Enter 한 번에 한 걸음씩 나아가요(이동·적·보물상자). 소비 체력과 보상은 장마다 달라요. 클리어한 파트는 다시 돌 수 있고, 속성 포인트는 처음 클리어할 때만 받습니다. 드랍 칸의 ?는 아직 얻지 못한 카드예요.</p>

      {boss && <BossReplay data={boss} onClose={() => { if (boss.result.win && boss.reward?.nextChapter) setChapterId(boss.reward.nextChapter); setBoss(null); }} />}
    </div>
  );
}

/* ───────────── 진행 (고정 레이아웃, Enter = 1스텝) ───────────── */

interface StepOut {
  step: AdventureStep; partClear: boolean; firstClear: boolean; points: number; levelUps: number; outOfStamina: boolean; bossUnlocked: boolean;
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const readFlag = (k: string) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const writeFlag = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* 무시 */ } };
const STEP_MS: Record<AdventureStep['type'], number> = { move: 420, enemy: 700, treasure: 650 };

function QuestRun({ s, run, say, chapter, part, onExit }: { s: PlayerState; run: Run; say: Say; chapter: number; part: number; onExit: () => void }) {
  const ch = CHAPTERS.find((c) => c.id === chapter)!;
  const qp = ch.parts[part - 1];
  const key = partKey(chapter, part);
  const leader = leaderCard(s);
  const fx = leader ? fxOf(leader.cardId) : fxOf('');
  const [skip, setSkipState] = useState(() => readFlag('tcg-quest-skip'));
  const [auto, setAutoState] = useState(false);
  const [working, setWorking] = useState(false);
  const [cur, setCur] = useState<{ n: number; step: AdventureStep } | null>(null);
  const [clear, setClear] = useState<StepOut | null>(null);
  const [drop, setDrop] = useState<{ uid: string } | null>(null);
  const [recover, setRecover] = useState(false);
  const autoRef = useRef(false);
  const skipRef = useRef(skip);
  const busyRef = useRef(false);
  const nRef = useRef(0);
  const raw = s.quest.progress[key] ?? 0;
  const pct = cur ? cur.step.progress : (s.quest.cleared[key] && raw === 0 ? 100 : raw);
  const expNext = playerExpToNext(s.level);
  const enough = s.stamina >= qp.stamina;

  const setSkip = (v: boolean) => { setSkipState(v); skipRef.current = v; writeFlag('tcg-quest-skip', v); };
  useEffect(() => () => { autoRef.current = false; }, []);

  /** 1스텝. 'go' = 계속 가능, 'pause' = 카드 획득 팝업 대기, 'stop' = 멈춤 */
  const stepOnce = async (): Promise<'go' | 'pause' | 'stop'> => {
    const r = await run<StepOut>('questStep', chapter, part);
    if (!r) { setRecover(true); return 'stop'; }
    nRef.current++;
    setCur({ n: nRef.current, step: r.step });
    await sleep(skipRef.current ? 140 : STEP_MS[r.step.type]);
    if (r.levelUps > 0) say(`레벨 업! Lv ${s.level + r.levelUps} · 속성 포인트 +${r.levelUps * POINTS_PER_LEVEL}`);
    if (r.partClear) { setClear(r); return 'stop'; }
    const t = r.step.treasure;
    if (t?.kind === 'card' && t.cardUid) { setDrop({ uid: t.cardUid }); return 'pause'; }
    if (r.outOfStamina) { setRecover(true); return 'stop'; }
    if (r.levelUps > 0) return 'stop';
    return 'go';
  };

  const loop = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setWorking(true);
    let res: 'go' | 'pause' | 'stop' = 'go';
    do {
      res = await stepOnce();
      if (res === 'go' && autoRef.current) await sleep(skipRef.current ? 60 : 160);
    } while (res === 'go' && autoRef.current);
    if (res === 'stop') { autoRef.current = false; setAutoState(false); }
    busyRef.current = false;
    setWorking(false);
  };

  const setAuto = (v: boolean) => {
    autoRef.current = v; setAutoState(v);
    if (v && !drop && !clear && !recover) loop();
  };

  /** 카드 팝업을 닫고 이어서 진행 (Auto 중이면 자동 재개) */
  const resume = () => { setDrop(null); if (autoRef.current) loop(); };

  const step = cur?.step;
  const dropCard = drop ? s.cards.find((c) => c.uid === drop.uid) : null;
  const sameCount = dropCard ? s.cards.filter((c) => c.cardId === dropCard.cardId).length : 0;
  const gainText = step ? (step.treasure?.kind === 'silver' ? step.silver + (step.treasure.amount ?? 0) : step.silver) : 0;
  const caption = !step ? (working ? '…' : 'Enter를 눌러 앞으로 나아가세요')
    : step.type === 'move' ? '앞으로 나아갔다'
    : step.type === 'enemy' ? `${step.enemy?.name} 출현! ${fx.name}`
    : step.treasure?.kind === 'card' ? `${step.treasure.grade === 'gold' ? '금색' : '은색'} 보물상자! ${step.treasure.cardName}`
    : `${step.treasure?.grade === 'gold' ? '금색' : '은색'} 보물상자!`;

  return (
    <div className="qrun">
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn sm" disabled={working} onClick={onExit}>◀ 목록</button>
        <span className="small muted">제{ch.id}장 · {ch.id}-{part} {qp.name}</span>
      </div>

      <div className={`scene${step?.type === 'move' ? ' moving' : ''}`} style={{ background: ch.bg }}>
        <div className="ground" />
        <div key={`w${cur?.n}`} className={`walker${step ? ' step' : ''}`}>🚶</div>
        {step?.type === 'enemy' && step.enemy && (
          <div key={`e${cur!.n}`} className="sprite enemy-in">
            <span>{step.enemy.glyph}</span>
            <div className="fx" style={{ ['--fx' as any]: fx.color }}><span className={`fx-${fx.kind}`}>{fx.glyph}</span></div>
          </div>
        )}
        {step?.type === 'treasure' && step.treasure && (
          <div key={`t${cur!.n}`} className="sprite chest-in"><span>{step.treasure.grade === 'gold' ? '🎁' : '📦'}</span></div>
        )}
        {step && (
          <div key={`g${cur!.n}`} className="gain">
            <div className="gain-text">{fmt(gainText)} {CURRENCY.silver.name}</div>
            {Array.from({ length: Math.min(7, 3 + Math.floor(gainText / 40)) }, (_, i) => (
              <i key={i} className="coin" style={{ left: `${38 + ((i * 37) % 30)}%`, animationDelay: `${i * 60}ms` }}>🪙</i>
            ))}
          </div>
        )}
        <div key={`c${cur?.n}`} className="scene-caption">{caption}</div>
      </div>

      <div className="qrun-leader">
        <div className="thumb">{leader ? <MiniCard c={toBattleCard(leader)} stat="atk" /> : <div className="card empty">리더 없음</div>}</div>
        <div className="grow" style={{ minWidth: 0 }}>
          <b>{leader ? displayName(leader) : '리더 없음'}</b>
          <div className="small muted">Lv {s.level} · {FACTIONS[s.faction].name}</div>
          {leader && <div className="small" style={{ color: fx.color }}>{fx.glyph} {fx.name}</div>}
        </div>
      </div>

      <div className="panel qbars">
        <div className="qbar"><span>체력</span><div className="grow"><Bar value={s.stamina} max={staminaMax(s)} kind="pool" /></div><span className="v">{s.stamina}/{staminaMax(s)}</span></div>
        <div className="qbar"><span>경험치</span><div className="grow"><Bar value={s.exp} max={expNext} /></div><span className="v">{s.exp}/{expNext}</span>
          {step && <em key={`x${cur!.n}`} className="float-exp">+{step.exp}경험치</em>}
        </div>
        <div className="qbar"><span>달성도</span><div className="grow"><Bar value={pct} max={100} /></div><span className="v">{pct}%</span></div>
      </div>

      <button className="btn primary block enter" disabled={working || !enough || !leader || !!drop} onClick={() => loop()}>Enter</button>
      {!enough && !working && <button className="btn sm block" style={{ marginTop: 8 }} onClick={() => setRecover(true)}>체력이 부족해요 · 회복하기</button>}
      <div className="row qopts">
        <label><input type="checkbox" id="quest-auto" checked={auto} disabled={!leader} onChange={(e) => setAuto(e.target.checked)} /> Auto</label>
        <label><input type="checkbox" id="quest-skip" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> Skip</label>
        <span className="muted small">소비 체력 {qp.stamina} · 경험치 +{stepExp(qp)} · {CURRENCY.silver.name} +{stepSilver(qp).min}~{stepSilver(qp).max}</span>
      </div>

      {drop && dropCard && (
        <Modal title="카드 획득!" onClose={resume}>
          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 96 }}><CardView c={dropCard} /></div>
            <div className="grow small">
              <b>{displayName(dropCard)}</b>
              <div className="muted">{rankOf(dropCard)} · {FACTIONS[master(dropCard.cardId).faction].name}</div>
              <div style={{ marginTop: 6 }}>판매가 <b>{fmt(sellPrice(dropCard))}</b> {CURRENCY.silver.name}</div>
              <div>보유 카드 {s.cards.length}/{inventoryCap(s)}</div>
              <div>이 카드 보유 {sameCount}장</div>
            </div>
          </div>
          <div className="col" style={{ gap: 6, marginTop: 12 }}>
            <button className="btn primary block" onClick={resume}>퀘스트 계속하기</button>
            <button className="btn block" onClick={async () => {
              const r = await run<any>('sellCards', [dropCard.uid]);
              if (r) say(`${displayName(dropCard)} 판매 · ${CURRENCY.silver.name} +${fmt(r.silver)}`);
              resume();
            }}>카드를 판매하고 계속하기 <span className="muted small">(+{fmt(sellPrice(dropCard))})</span></button>
            <button className="btn block" onClick={() => { autoRef.current = false; setAutoState(false); setDrop(null); onExit(); }}>퀘스트로 돌아가기</button>
          </div>
        </Modal>
      )}
      {clear && (
        <Modal title="파트 클리어!" onClose={onExit}>
          {clear.firstClear ? <p>속성 포인트 <b>+{clear.points}</b> (홈에서 공격·방어 코스트에 분배)</p> : <p className="muted small">재진행 클리어는 속성 포인트를 주지 않아요.</p>}
          {clear.bossUnlocked && <p className="hint">이 장의 보스 배틀이 열렸습니다!</p>}
          <button className="btn primary block" onClick={onExit}>목록으로</button>
        </Modal>
      )}
      {recover && !clear && (
        <Modal title="체력 부족" onClose={() => setRecover(false)}>
          <p className="small">이 파트는 한 걸음에 체력 {qp.stamina}이(가) 필요해요. 지금 체력 {s.stamina}.</p>
          <div className="row wrap" style={{ gap: 6 }}>
            <button className="btn" disabled={s.staminaReserve <= 0} onClick={async () => { const r = await run<any>('claimReserve'); if (r) say(`예비 체력 ${r.amount} 수령`); }}>예비 체력 수령 ({s.staminaReserve})</button>
            <button className="btn" disabled={s.vitality <= 0} onClick={() => run('useVitality')}>{CURRENCY.vitality.name} 사용 ({s.vitality}개)</button>
          </div>
          <p className="muted small">체력은 1분에 1씩 회복돼요.</p>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary grow" disabled={!enough} onClick={() => setRecover(false)}>퀘스트 계속하기</button>
            <button className="btn" onClick={onExit}>목록</button>
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
