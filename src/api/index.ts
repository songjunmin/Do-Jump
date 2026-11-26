// 서버 호출 계층. Verse8에서는 @agent8/gameserver 로 원격 호출하고,
// 오프라인 미리보기 빌드(VITE_OFFLINE=1)에서는 같은 서버 코드를 브라우저 안에서 실행한다.
import type { PlayerState } from '../../server/src/game/player';

export interface ServerResponse<R = any> { state: PlayerState | null; serverTime: number; result?: R }
type Caller = (fn: string, args: any[]) => Promise<any>;

export const OFFLINE = import.meta.env.VITE_OFFLINE === '1';

let callerPromise: Promise<Caller> | null = null;

async function makeCaller(): Promise<Caller> {
  if (OFFLINE) {
    const { createLocalCaller } = await import('./localServer');
    return createLocalCaller();
  }
  const { GameServer } = await import('@agent8/gameserver');
  const server = GameServer.getInstance();
  await server.connect();
  return (fn, args) => server.remoteFunction(fn, args, { needResponse: true });
}

export async function call<R = any>(fn: string, ...args: any[]): Promise<ServerResponse<R>> {
  callerPromise ??= makeCaller();
  const caller = await callerPromise;
  return caller(fn, args);
}
