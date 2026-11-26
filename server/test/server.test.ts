// gameserver-node 테스트 러너 (isolated-vm 안에서 빌드된 server.js를 실행).
// 테스트마다 상태가 초기화되므로 각 테스트는 스스로 캐릭터를 만든다.

async function fails(p: Promise<any>): Promise<string> {
  try {
    await p;
  } catch (e: any) {
    return String(e?.message || e);
  }
  throw new Error('실패해야 하는 호출이 성공했습니다.');
}

async function setup(server: any, account = 'alice', faction = 'dawn') {
  server.connect({ account });
  return (await server.createPlayer(account, faction)).state;
}

const spare = (s: any, cardId: string) => {
  const inDeck = new Set([...s.presets[0].atk, ...s.presets[0].def, ...s.presets[1].atk, ...s.presets[1].def]);
  return s.cards.filter((c: any) => c.cardId === cardId && !inDeck.has(c.uid));
};

describe('플레이어', () => {
  test('진형 선택 후 샘플 덱과 카드가 지급된다', async (server) => {
    const s = await setup(server);
    expect(s.faction).toBe('dawn');
    expect(s.cards.length).toBeGreaterThan(10);
    expect(s.presets.length).toBe(3);
    expect(s.presets[0].atk.filter(Boolean).length).toBe(4);
    const c = s.cards[0];
    expect(c.base_cards_used).toBe(1);
    expect(c.max_enhance_count).toBe(0);
    expect(c.tradable).toBe(true);
  });

  test('같은 계정으로 다시 만들 수 없다', async (server) => {
    await setup(server);
    const msg = await fails(server.createPlayer('x', 'dusk'));
    expect(msg).toContain('이미');
  });

});

describe('퀘스트', () => {
  test('탐색 1회: 체력 소모, 은화 300배, 달성도 상승', async (server) => {
    const s = await setup(server);
    expect(s.quest.leader).toBeTruthy();
    const r = await server.questExplore(1, 1);
    expect(r.state.stamina).toBe(s.stamina - r.result.stamina);
    expect(r.result.silver).toBe(r.result.stamina * 300);
    expect(r.result.progress).toBe(25);
  });

  test('앞 파트를 깨기 전에는 다음 파트·다음 장에 들어갈 수 없다', async (server) => {
    await setup(server);
    expect(await fails(server.questExplore(1, 2))).toContain('열리지');
    expect(await fails(server.questExplore(2, 1))).toContain('열리지');
  });

  test('파트 100% → 속성 포인트 +1, 재진행 가능, 3~5회마다 상자', async (server) => {
    await setup(server);
    let r: any;
    let boxes = 0;
    for (let i = 0; i < 4; i++) {
      r = await server.questExplore(1, 1);
      if (r.result.box) { boxes++; await server.questContinue(); }
    }
    expect(r.result.partClear).toBe(true);
    expect(r.result.firstClear).toBe(true);
    expect(r.state.statPoints).toBe(1);
    expect(boxes).toBeGreaterThan(0);
    // 재진행: 달성도가 다시 0부터 오르고, 포인트는 다시 주지 않는다
    const again = await server.questExplore(1, 1);
    expect(again.result.progress).toBe(25);
    expect(again.result.firstClear).toBe(false);
  });

  test('보상 상자를 확인하기 전에는 진행이 멈춘다', async (server) => {
    await setup(server);
    let r: any;
    for (let i = 0; i < 5; i++) { r = await server.questExplore(1, 1); if (r.result.box) break; }
    expect(r.result.box).toBeTruthy();
    expect(await fails(server.questExplore(1, 1))).toContain('상자');
    await server.questContinue();
    await server.questExplore(1, 1);
  });

  test('모든 파트 완료 → 보스 해금, 승리 시 다음 장, 재도전 불가', async (server) => {
    await setup(server);
    expect(await fails(server.questBoss(1))).toContain('100%');
    for (let part = 1; part <= 5; part++) {
      let done = false;
      while (!done) {
        const st = (await server.getState()).state;
        if (st.stamina < 15) await server.useVitality().catch(() => server.protoSupply().then(() => server.useVitality()));
        const r = await server.questExplore(1, part);
        if (r.result.box) await server.questContinue();
        done = r.result.partClear;
      }
    }
    const b = await server.questBoss(1);
    expect(b.result.result.win).toBe(true);
    expect(b.state.quest.unlocked).toBe(2);
    expect(await fails(server.questBoss(1))).toContain('이미');
    const ch2 = await server.questExplore(2, 1);
    expect(ch2.result.progress).toBeGreaterThan(0);
  });

  test('리더 카드는 강화 재료로 쓸 수 없다', async (server) => {
    const s = await setup(server);
    const n = s.cards.find((c: any) => c.cardId === 'n_spear');
    await server.setLeader(n.uid);
    const [target] = spare(s, 'r_lancer');
    expect(await fails(server.enhance(target.uid, [n.uid]))).toContain('리더');
  });
});

describe('강화·진화 1사이클', () => {
  test('강화 → 진화 → 진화식 기록', async (server) => {
    const s = await setup(server);
    const [target, mat] = spare(s, 'r_lancer');
    const mats = s.cards.filter((c: any) => c.cardId.startsWith('n_')).slice(0, 3).map((c: any) => c.uid);
    const e = await server.enhance(target.uid, mats);
    expect(e.result.clearBonus).toBe(true);
    expect(e.state.cards.find((c: any) => c.uid === target.uid).level).toBeGreaterThan(1);
    expect(e.state.cards.length).toBe(s.cards.length - 3);

    const v = await server.evolve(target.uid, mat.uid);
    const after = v.state.cards.find((c: any) => c.uid === target.uid);
    expect(after.form).toBe(2);
    expect(after.level).toBe(1);
    expect(after.base_cards_used).toBe(2);
    expect(after.inhAtk).toBeGreaterThan(0);
    expect(v.result.showHint).toBe(true);
  });

  test('덱에 편성된 카드는 재료로 쓸 수 없다', async (server) => {
    const s = await setup(server);
    const [target] = spare(s, 'r_lancer');
    const msg = await fails(server.enhance(target.uid, [s.presets[0].atk[0]]));
    expect(msg).toContain('덱');
  });

  test('다른 이름 카드로는 진화할 수 없다', async (server) => {
    const s = await setup(server);
    const [target] = spare(s, 'r_lancer');
    const other = s.cards.find((c: any) => c.cardId === 'n_spear');
    const msg = await fails(server.evolve(target.uid, other.uid));
    expect(msg).toContain('같은 이름');
  });

  test('보호한 카드는 재료로 쓸 수 없다', async (server) => {
    const s = await setup(server);
    const [target] = spare(s, 'r_lancer');
    const n = s.cards.find((c: any) => c.cardId === 'n_spear');
    await server.toggleLock(n.uid);
    const msg = await fails(server.enhance(target.uid, [n.uid]));
    expect(msg).toContain('보호');
  });
});

describe('덱 프리셋', () => {
  test('3번 프리셋 저장, 같은 카드 중복 거부', async (server) => {
    const s = await setup(server);
    const r = await server.saveDeck(2, 'def', [s.cards[0].uid, null, null, null, null]);
    expect(r.state.presets[2].def[0]).toBe(s.cards[0].uid);
    for (let i = 0; i < 4; i++) await server.protoSupply();
    const st = (await server.getState()).state;
    const heavy = st.cards.filter((c: any) => !c.cardId.startsWith('n_')).slice(0, 5).map((c: any) => c.uid);
    const total = st.cards.filter((c: any) => heavy.includes(c.uid)).length;
    expect(total).toBe(5);
    // R 이상 5장 + 상한 60 → 일부 조합은 통과할 수 있으므로 같은 카드 중복만 확실히 거부되는지 확인
    const dup = await fails(server.saveDeck(0, 'atk', [heavy[0], heavy[0], null, null, null]));
    expect(dup).toContain('두 번');
  });
});

describe('결투장', () => {
  test('랜덤 매칭 → 서버 판정 → 상대 덱 공개, 일 10회 제한', async (server) => {
    await setup(server, 'bob', 'dusk');
    const r = await server.duel();
    expect(r.result.result.attacker.total).toBeGreaterThan(0);
    expect(r.result.result.defender.deck.length).toBe(5);
    expect(r.result.opponent.name).toBeTruthy();
    expect(r.state.duel.used).toBe(1);
    for (let i = 0; i < 9; i++) await server.duel();
    const msg = await fails(server.duel());
    expect(msg).toContain('시도');
  });

  test('다른 유저의 방어 덱이 유령 덱으로 매칭 풀에 들어간다', async (server) => {
    await setup(server, 'carol', 'dawn');
    server.connect({ account: 'dave' });
    await server.createPlayer('dave', 'dusk');
    let sawGhost = false;
    for (let i = 0; i < 10; i++) {
      const r = await server.duel();
      if (!r.result.opponent.isBot) { sawGhost = true; expect(r.result.opponent.name).toBe('carol'); }
    }
    expect(sawGhost).toBe(true);
  });
});

describe('레이드', () => {
  test('입장권 1장으로 1교전, 공격 먼저 교환', async (server) => {
    const s = await setup(server, 'erin', 'dawn');
    const r = await server.raidEngage();
    const res = r.result.result;
    expect(r.state.tickets).toBe(s.tickets - 1);
    expect(res.hits).toBeGreaterThan(0);
    expect(res.dealt).toBe(res.attack.total * res.hits);
    expect(res.hits).toBe(Math.ceil(res.defense.total / res.bossPower));
  });
});
