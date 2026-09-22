import type { Db } from '../helpers/prisma';

/**
 * PluginEntitlement'i DOGRUDAN kurar — Ed25519 imzali lisans akisini (POST
 * /api/plugins/activate) atlar, cunku bu bir "arrange" (on-kosul) adimidir,
 * test edilen "act" degildir (bkz. docs/UCTAN_UCA_TEST_ORTAMI_PLANI.md §0).
 */
export async function activateAgent(
  prisma: Db,
  tenantId: string,
  pluginKey: string,
  opts: { mode: 'ADVISORY' | 'AUTONOMOUS'; status?: string },
) {
  return prisma.pluginEntitlement.create({
    data: { tenantId, pluginKey, status: opts.status ?? 'ACTIVE', mode: opts.mode, activatedAt: new Date() },
  });
}
