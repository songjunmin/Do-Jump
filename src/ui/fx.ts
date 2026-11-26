// 리더 카드별 공격 이펙트 (연출 전용). 카드마다 이펙트 종류·색·문양이 다르다.
export type FxKind = 'slash' | 'pierce' | 'arrow' | 'holy' | 'shadow' | 'burst' | 'poison' | 'sun' | 'crush' | 'eclipse';
export interface Fx { kind: FxKind; color: string; glyph: string; name: string }

const FX: Record<string, Fx> = {
  n_spear: { kind: 'pierce', color: '#d9d2c0', glyph: '➶', name: '찌르기' },
  n_scout: { kind: 'arrow', color: '#a7d36b', glyph: '➵', name: '속사' },
  n_wall: { kind: 'crush', color: '#b7a58a', glyph: '◼', name: '방패 밀치기' },
  n_minion: { kind: 'slash', color: '#9b7ad6', glyph: '⟋', name: '기습' },
  n_thrower: { kind: 'burst', color: '#ff9f43', glyph: '✹', name: '폭탄 투척' },
  n_gate: { kind: 'crush', color: '#8e7cc3', glyph: '◼', name: '철문 강타' },
  hn_squire: { kind: 'slash', color: '#f5d77a', glyph: '⟋', name: '종자의 일격' },
  hn_medic: { kind: 'holy', color: '#9ff0c8', glyph: '✚', name: '정화의 빛' },
  hn_cutthroat: { kind: 'slash', color: '#ff6b8a', glyph: '✕', name: '교차 베기' },
  hn_lookout: { kind: 'arrow', color: '#c5a3ff', glyph: '➵', name: '감시탑 저격' },
  r_lancer: { kind: 'pierce', color: '#ffd166', glyph: '➶', name: '돌격창' },
  r_nun: { kind: 'holy', color: '#bfe3ff', glyph: '✚', name: '성광' },
  r_archer: { kind: 'arrow', color: '#7bdc6b', glyph: '➵', name: '관통 화살' },
  r_paladin: { kind: 'crush', color: '#ffe08a', glyph: '✦', name: '심판의 망치' },
  r_venom: { kind: 'poison', color: '#7cff6b', glyph: '☠', name: '맹독 칼날' },
  r_raven: { kind: 'shadow', color: '#6b6bff', glyph: '🪶', name: '까마귀 떼' },
  r_ironmask: { kind: 'crush', color: '#a0a8b8', glyph: '◼', name: '철가면 박치기' },
  hr_sunblade: { kind: 'sun', color: '#ffb703', glyph: '☀', name: '정오의 검' },
  hr_bastion: { kind: 'holy', color: '#ffe8a3', glyph: '🛡', name: '성채 붕괴' },
  hr_eclipse: { kind: 'eclipse', color: '#b36bff', glyph: '🌑', name: '월식' },
  hr_blackknight: { kind: 'shadow', color: '#4a3aff', glyph: '♞', name: '심연 돌격' },
  hr_obsidian: { kind: 'slash', color: '#d0d0ff', glyph: '✦', name: '흑요 섬광' },
};

export const fxOf = (cardId: string): Fx => FX[cardId] ?? { kind: 'slash', color: '#ffffff', glyph: '⟋', name: '공격' };
