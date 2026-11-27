// 순수 로직 단위 테스트 (bun test server/unit)
import { describe, expect, test } from 'bun:test';
import { duel, raidEngage, rollSkills, leaderBattle } from '../src/game/engine';
import { newInstance, toBattleCard, statsOf, levelCap } from '../src/game/cards';
import { applyEvolve } from '../src/game/growth';
import * as P from '../src/game/player';

const bc = (cardId: string, uid: string, level = 1) => toBattleCard(newInstance(cardId, uid, 0, 1, level));
const always = () => 0; // 모든 슬롯 발동
const never = () => 0.999;

describe('스킬 발동', () => {
  test('최대 3개, 슬롯 우선순위 3→2→4→1→5, 같은 이름 중복 불가', () => {
    const deck = [bc('r_lancer', 'a'), bc('r_nun', 'b'), bc('r_venom', 'c'), bc('hr_sunblade', 'd'), bc('hr_bastion', 'e')];
    const r = rollSkills(deck, always);
    // 3번(sunder) → 2번(bulwark) → 4번(rally) 적용, 1번 rally는 중복, 5번 bulwark는 중복
    expect(r.applied).toEqual(['sunder', 'bulwark', 'rally']);
    expect(r.rolls.find((x) => x.slot === 0)!.blocked).toBe('duplicate');
  });

  test('4개 이상 발동 시 캡', () => {
    const deck = [bc('hr_eclipse', 'a'), bc('r_lancer', 'b'), bc('r_nun', 'c'), bc('r_venom', 'd'), null];
    const r = rollSkills(deck, always);
    expect(r.applied.length).toBe(3);
  });

  test('3번 슬롯은 항상 발동', () => {
    const r = rollSkills([null, null, bc('r_lancer', 'x'), null, null], never);
    expect(r.applied).toEqual(['rally']);
  });
});

describe('결투장 판정', () => {
  test('동점은 방어 승', () => {
    const a = [bc('n_scout', 'a')];
    const d = [bc('n_scout', 'b')];
    // 공격 750*0.5 vs 방어 750*0.5 동일
    const r = duel(a, null, d, null, never);
    expect(r.attacker.total).toBe(r.defender.total);
    expect(r.win).toBe(false);
  });

  test('진형 일치 +3%', () => {
    const a = [bc('r_archer', 'a')];
    const r1 = duel(a, null, [null], null, never);
    const r2 = duel(a, 'dawn', [null], null, never);
    expect(r2.attacker.total).toBe(Math.round(r1.attacker.total * 1.03));
  });
});

describe('레이드', () => {
  test('공격 횟수 = ceil(방어 총합 / 보스 공격력)', () => {
    const atk = [bc('r_archer', 'a', 40)];
    const def = [bc('r_paladin', 'b', 40)];
    const r = raidEngage(atk, def, null, { hp: 10_000_000, power: 2000 }, never);
    expect(r.hits).toBe(Math.ceil(r.defense.total / 2000));
    expect(r.dealt).toBe(r.attack.total * r.hits);
  });

  test('보스를 쓰러뜨리면 그 자리에서 종료', () => {
    const r = raidEngage([bc('r_archer', 'a', 40)], [bc('r_paladin', 'b', 40)], null, { hp: 5000, power: 2000 }, never);
    expect(r.killed).toBe(true);
    expect(r.dealt).toBe(5000);
  });
});

describe('진화식 곡선', () => {
  test('4-0 < 4-2 < 4-6, 맥강이 장수보다 효율적', () => {
    let n = 0;
    const mk = () => newInstance('r_lancer', 'u' + n++, 0);
    const max = (c: any) => { c.level = levelCap(c); return c; };
    const chain = (maxT: boolean[], maxM: boolean) => {
      const t = mk();
      for (let f = 0; f < 3; f++) { if (maxT[f]) max(t); const m = mk(); if (maxM) max(m); applyEvolve(t, m); }
      max(t);
      return t;
    };
    const s40 = chain([false, false, false], false);
    const s42 = chain([false, true, true], false);
    const s46 = chain([true, true, true], true);
    expect(s40.base_cards_used + '-' + s40.max_enhance_count).toBe('4-0');
    expect(s42.base_cards_used + '-' + s42.max_enhance_count).toBe('4-2');
    expect(s46.base_cards_used + '-' + s46.max_enhance_count).toBe('4-6');
    expect(statsOf(s42).atk).toBeGreaterThan(statsOf(s40).atk);
    expect(statsOf(s46).atk).toBeGreaterThan(statsOf(s42).atk);
  });
});

describe('덱 코스트', () => {
  test('상한 초과 저장 거부', () => {
    const s = P.createPlayer('t', 'dawn', { now: 0, rng: Math.random });
    s.atkCost = 20;
    const ids = s.presets[0].atk;
    expect(() => P.saveDeck(s, 0, 'atk', ids)).toThrow('코스트 초과');
  });
});

describe('장 보스 (리더 1장)', () => {
  const leader = { uid: 'x', cardId: 'r_lancer', name: 't', rank: 'R', faction: 'dawn', form: 1, level: 1, atk: 100, def: 250, cost: 1, skill: null } as any;
  test('리더 HP = 방어력, 리더 공격 먼저', () => {
    const r = leaderBattle(leader, { hp: 300, atk: 100 });
    expect(r.leaderHp).toBe(250);
    expect(r.turns[0].by).toBe('leader');
    expect(r.win).toBe(true); // 3타 필요, 보스는 2번만 반격(200 < 250)
  });
  test('먼저 HP가 0이 되면 패배', () => {
    const r = leaderBattle(leader, { hp: 400, atk: 130 });
    expect(r.win).toBe(false); // 4타 필요, 보스 2타째에 260 ≥ 250
  });
});
