import type { ApiClient } from './apiClient';

export interface ChainStage {
  id: string;
  order: number;
  role: string | null;
  status: string;
}
export interface Chain {
  id: string;
  status: string;
  processKey: string | null;
  stages: ChainStage[];
}

/** GET /approval-chains?entityType=&entityId= — o entity icin (varsa) PENDING/son zinciri doner. Auth gerekir. */
export async function getChain(api: ApiClient, token: string, entityType: string, entityId: string): Promise<Chain> {
  const { status, body } = await api.withToken(token).get<Chain[]>(`/approval-chains?entityType=${entityType}&entityId=${entityId}`);
  if (status !== 200) throw new Error(`getChain basarisiz (${status}): ${JSON.stringify(body)}`);
  if (!body.length) throw new Error(`Zincir bulunamadi: ${entityType}/${entityId}`);
  return body[0];
}

/** Belirli bir order'daki asamayi, o rolun GERCEK jetonuyla onaylar (generic PendingChainApprovals ucu). */
export async function approveStageAtOrder(
  api: ApiClient,
  token: string,
  entityType: string,
  entityId: string,
  order: number,
  note?: string,
): Promise<Chain> {
  const chain = await getChain(api, token, entityType, entityId);
  const stage = chain.stages.find((s) => s.order === order);
  if (!stage) throw new Error(`Stage bulunamadi (entityType=${entityType} order=${order}) — mevcut: ${JSON.stringify(chain.stages)}`);
  const authed = api.withToken(token);
  const { status, body } = await authed.post<Chain>(`/approval-chains/${chain.id}/stages/${stage.id}/approve`, note ? { note } : {});
  if (status !== 200) throw new Error(`approveStageAtOrder basarisiz (order ${order}, ${status}): ${JSON.stringify(body)}`);
  return body;
}
