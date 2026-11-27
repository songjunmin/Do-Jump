import type { ReactNode } from 'react';
import { MAX_FORM } from '../../server/src/game/config';
import { displayName, levelCap, master, rankOf, skillOf, statsOf, type BattleCard, type CardInstance } from '../../server/src/game/cards';
import { FACTIONS } from '../../server/src/game/data';

export const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

export function CardView({ c, onClick, selected, dim, badge, inDeck, stat }: {
  c: CardInstance; onClick?: () => void; selected?: boolean; dim?: boolean; badge?: ReactNode; inDeck?: boolean; stat?: 'atk' | 'def';
}) {
  const m = master(c.cardId);
  const rank = rankOf(c);
  const st = statsOf(c);
  const sk = skillOf(c.cardId);
  const fc = FACTIONS[m.faction].color;
  return (
    <button className={`card${selected ? ' sel' : ''}${dim ? ' dim' : ''}`} style={{ ['--rc' as any]: `var(--r-${rank})` }} onClick={onClick}>
      {badge != null && <span className="badge">{badge}</span>}
      <div className={`art f${c.form}`} style={{ background: `linear-gradient(160deg, ${fc}55, #15161f 75%)`, ['--fc' as any]: fc }}>
        <ArtLayers form={c.form} />
        <span className="rk">{rank}</span>
        <span className="cost">{m.cost}</span>
        <span>{m.glyph}</span>
        <span className="stars">{'★'.repeat(c.form)}{'☆'.repeat(MAX_FORM - c.form)}</span>
        {(c.locked || inDeck) && <span className="lock">{c.locked ? '🔒' : '📌'}</span>}
      </div>
      <div className="nm">{displayName(c)}</div>
      <div className="lv">Lv {c.level}/{levelCap(c)}</div>
      {stat ? (
        <div className="st" style={{ justifyContent: 'center' }}><span className={stat === 'atk' ? 'a' : 'd'}>{fmt(st[stat])}</span></div>
      ) : (
        <div className="st"><span className="a">{fmt(st.atk)}</span><span className="d">{fmt(st.def)}</span></div>
      )}
      <div className="skill">{sk ? sk.name : m.style === 'def' ? '— 깡방' : '— 깡공'}</div>
    </button>
  );
}

/** 진화 단계별 아트 장식: 2단계 오라, 3단계 문양 고리, 4단계 금빛 후광·광선·왕관 */
export function ArtLayers({ form }: { form: number }) {
  return (
    <>
      {form >= 4 && <span className="ly rays" />}
      {form >= 2 && <span className="ly aura" />}
      {form >= 3 && <span className="ly ring" />}
      {form >= 4 && <span className="ly crown">♛</span>}
    </>
  );
}

/** 카드 아트만 (프레임 없이). 상점 배너·진화 미리보기용 */
export function CardArt({ cardId, form, big, silhouette }: { cardId: string; form: number; big?: boolean; silhouette?: boolean }) {
  const m = master(cardId);
  const fc = FACTIONS[m.faction].color;
  return (
    <div className={`cart f${form}${big ? ' big' : ''}${silhouette ? ' sil' : ''}`} style={{ background: `linear-gradient(160deg, ${fc}66, #15161f 80%)`, ['--fc' as any]: fc }}>
      <ArtLayers form={form} />
      <span className="g">{m.glyph}</span>
    </div>
  );
}

export function MiniCard({ c, stat }: { c: BattleCard | null; stat?: 'atk' | 'def' }) {
  if (!c) return <div className="card empty" style={{ minHeight: 64 }}>빈칸</div>;
  const m = master(c.cardId);
  const fc = FACTIONS[c.faction].color;
  return (
    <div className="card" style={{ ['--rc' as any]: `var(--r-${c.rank})` }}>
      <div className="art" style={{ background: `linear-gradient(160deg, ${fc}55, #15161f 75%)`, fontSize: 22, aspectRatio: '1' }}>
        <span className="rk">{c.rank}</span>
        <span>{m.glyph}</span>
        <span className="stars">{'★'.repeat(c.form)}</span>
      </div>
      <div className="nm">{c.name}</div>
      <div className="st" style={{ justifyContent: 'center' }}>
        {stat !== 'def' && <span className="a">{fmt(c.atk)}</span>}
        {stat !== 'atk' && <span className="d">{stat ? '' : ' '}{fmt(c.def)}</span>}
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head"><h2 style={{ margin: 0 }}>{title}</h2><button className="x" onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  );
}

export function Bar({ value, max, kind }: { value: number; max: number; kind?: 'hp' | 'pool' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <div className={`bar${kind ? ' ' + kind : ''}`}><i style={{ width: `${pct}%` }} /></div>;
}
