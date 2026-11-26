// 오프라인 미리보기 전용: Verse8 런타임의 $global / $sender 를 브라우저 localStorage로 흉내 내고
// server/src/server.ts 를 그대로 실행한다. Verse8 배포 빌드에는 포함되지 않는다.
import { Server } from '../../server/src/server';

const KEY = 'tcg-offline-v1';
interface Store { users: Record<string, Record<string, any>>; collections: Record<string, Record<string, any>> }

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* 저장소를 못 쓰는 환경 */ }
  return { users: {}, collections: {} };
}
let mem: Store = read();
function write() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* 무시 */ }
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export function installLocalRuntime(account: string) {
  const g = globalThis as any;
  g.$sender = { account };
  g.$global = {
    async getMyState() { return clone(mem.users[account] ?? {}); },
    async updateMyState(patch: Record<string, any>) {
      mem.users[account] = { ...(mem.users[account] ?? {}), ...clone(patch) };
      write();
      return clone(mem.users[account]);
    },
    async getCollectionItems(id: string) { return clone(Object.values(mem.collections[id] ?? {})); },
    async getCollectionItem(id: string, itemId: string) {
      const it = mem.collections[id]?.[itemId];
      if (!it) throw new Error('not found');
      return clone(it);
    },
    async addCollectionItem(id: string, item: any, opts?: { id?: string }) {
      const __id = opts?.id ?? Math.random().toString(36).slice(2);
      (mem.collections[id] ??= {})[__id] = { ...clone(item), __id };
      write();
      return clone(mem.collections[id][__id]);
    },
    async updateCollectionItem(id: string, item: any) {
      const cur = mem.collections[id]?.[item.__id];
      if (!cur) throw new Error('not found');
      mem.collections[id][item.__id] = { ...cur, ...clone(item) };
      write();
      return clone(mem.collections[id][item.__id]);
    },
  };
}

export function createLocalCaller() {
  const account = 'offline-player';
  installLocalRuntime(account);
  const server = new Server() as any;
  return async (fn: string, args: any[]) => {
    if (typeof server[fn] !== 'function') throw new Error(`없는 서버 함수: ${fn}`);
    // 서버 응답이 네트워크를 거친 것처럼 깊은 복사본을 넘긴다
    return clone(await server[fn](...args));
  };
}
