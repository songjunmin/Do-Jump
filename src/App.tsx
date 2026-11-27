import { useCallback, useEffect, useRef, useState } from 'react';
import { call, OFFLINE } from './api';
import type { PlayerState } from '../server/src/game/player';
import { staminaMax } from '../server/src/game/player';
import { CURRENCY } from '../server/src/game/data';
import { fmt } from './ui/common';
import Onboard from './screens/Onboard';
import Home from './screens/Home';
import Cards, { type CardsIntent } from './screens/Cards';
import Deck from './screens/Deck';
import Duel from './screens/Duel';
import Raid, { type BossKind, type WeeklyInfo } from './screens/Raid';
import Shop from './screens/Shop';
import Quest from './screens/Quest';

export type Run = <R = any>(fn: string, ...args: any[]) => Promise<R | undefined>;
export type Tab = 'home' | 'quest' | 'cards' | 'deck' | 'duel' | 'shop' | 'boss';
export type Go = (t: Tab, intent?: CardsIntent, boss?: BossKind) => void;
const TABS: { id: Exclude<Tab, 'boss'>; label: string; ic: string }[] = [
  { id: 'home', label: '홈', ic: '🏠' },
  { id: 'quest', label: '퀘스트', ic: '🗺' },
  { id: 'cards', label: '카드', ic: '🃏' },
  { id: 'deck', label: '덱', ic: '🗂' },
  { id: 'duel', label: '결투장', ic: '⚔' },
  { id: 'shop', label: '상점', ic: '🛒' },
];

export default function App() {
  const [s, setS] = useState<PlayerState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [cardsIntent, setCardsIntent] = useState<CardsIntent>(null);
  const tabRef = useRef<Tab>('home');
  const [bossKind, setBossKind] = useState<BossKind>('personal');
  const [backTab, setBackTab] = useState<Tab>('home');
  const [weekly, setWeekly] = useState<WeeklyInfo | null>(null);
  const go: Go = useCallback((t, intent = null, boss) => {
    setCardsIntent(intent);
    if (t === 'boss') { setBossKind(boss ?? 'personal'); setBackTab(tabRef.current === 'boss' ? 'home' : tabRef.current); }
    tabRef.current = t;
    setTab(t);
    window.scrollTo(0, 0);
  }, []);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const say = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    window.setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), 2600);
  }, []);

  const run: Run = useCallback(async (fn: string, ...args: any[]) => {
    setBusy(true);
    try {
      const res = await call(fn, ...args);
      setS(res.state);
      return res.result;
    } catch (e: any) {
      say(String(e?.message || e).replace(/^Error:\s*/, ''), true);
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [say]);

  const refresh = useCallback(async () => {
    try {
      const res = await call('getState');
      setS(res.state);
      setLoadErr(null);
    } catch (e: any) {
      setLoadErr(String(e?.message || e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  if (!loaded) return <div className="app"><div className="main muted">서버에 연결하는 중…</div></div>;
  if (loadErr && !s) {
    return (
      <div className="app"><div className="main">
        <div className="panel"><b>서버에 연결하지 못했습니다.</b><p className="muted small">{loadErr}</p>
          <button className="btn" onClick={refresh}>다시 시도</button></div>
      </div></div>
    );
  }
  if (!s) return <div className="app"><Onboard run={run} busy={busy} />{toast && <div className={`toast${toast.err ? ' err' : ''}`}>{toast.msg}</div>}</div>;

  return (
    <div className="app">
      <header className="topbar">
        <div className="row1">
          <span className="name">{s.name} <span className="muted small">Lv {s.level}</span></span>
          {OFFLINE && <span className="pill">오프라인 미리보기</span>}
        </div>
        <div className="res">
          <span>체력 <b>{s.stamina}/{staminaMax(s)}</b></span>
          <span>입장권 <b>{s.tickets}</b></span>
          <span>{CURRENCY.silver.name} <b>{fmt(s.silver)}</b></span>
          <span>{CURRENCY.stardust.name} <b>{s.stardust}</b></span>
          <span>{CURRENCY.vitality.name} <b>{s.vitality}</b></span>
        </div>
      </header>
      <main className="main">
        {s.notices.length > 0 && (
          <div className="notice">
            {s.notices.map((n, i) => <div key={i}>{n}</div>)}
            <button className="btn sm" style={{ marginTop: 6 }} onClick={() => run('dismissNotices')}>확인</button>
          </div>
        )}
        {tab === 'home' && <Home s={s} run={run} busy={busy} say={say} go={go} weekly={weekly} setWeekly={setWeekly} />}
        {tab === 'quest' && <Quest s={s} run={run} busy={busy} say={say} go={go} />}
        {tab === 'cards' && <Cards key={cardsIntent?.pick ?? 'list'} s={s} run={run} busy={busy} say={say} intent={cardsIntent} clearIntent={() => setCardsIntent(null)} />}
        {tab === 'deck' && <Deck s={s} run={run} busy={busy} />}
        {tab === 'duel' && <Duel s={s} run={run} busy={busy} />}
        {tab === 'shop' && <Shop s={s} run={run} busy={busy} say={say} />}
        {tab === 'boss' && <Raid key={bossKind} s={s} run={run} busy={busy} kind={bossKind} weekly={weekly} setWeekly={setWeekly} onBack={() => go(backTab)} />}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
            <span className="ic">{t.ic}</span>{t.label}
          </button>
        ))}
      </nav>
      {toast && <div className={`toast${toast.err ? ' err' : ''}`}>{toast.msg}</div>}
    </div>
  );
}
