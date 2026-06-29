import { NAV_ITEMS, ROLE_LABELS } from '../constants';

/**
 * Sidebar (NAV_ITEMS) tek kaynağından türetilen yetki ağacı ŞABLONU.
 * Yetkiler editörü ve görünürlük mantığı bu türevi kullanır — yeni bir
 * modül/alt-modül NAV_ITEMS'a eklendiğinde editör otomatik genişler.
 *
 * - Üst modül (parent) → `permission`
 * - Alt modüller (subItems) → `children` (izin koduna göre tekilleştirilir;
 *   aynı izni paylaşan alt-öğelerin etiketleri "·" ile birleştirilir)
 * - Üst ile aynı izne sahip alt-öğeler atlanır (parent toggle zaten kapsar)
 * - Rol-benzeri kodlar (ROLE_LABELS'ta olanlar, ör. GENERAL_MANAGER) hariç —
 *   onlar izin değil rol; hasPermission rolü ayrı değerlendirir.
 */
export interface PermChild {
  permission: string;
  label: string;
}
export interface PermGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  permission: string;
  children: PermChild[];
}

interface NavItemShape {
  id: string;
  label: string;
  icon: PermGroup['icon'];
  requiredPermission: string;
  subItems?: { id: string; label: string; requiredPermission: string }[];
}

const ROLE_KEYS = new Set(Object.keys(ROLE_LABELS));
const isPerm = (code?: string): code is string => !!code && !ROLE_KEYS.has(code);

export function buildPermissionGroups(): PermGroup[] {
  return (NAV_ITEMS as NavItemShape[])
    .filter((item) => isPerm(item.requiredPermission))
    .map((item) => {
      const byPerm = new Map<string, Set<string>>();
      (item.subItems || []).forEach((s) => {
        if (!isPerm(s.requiredPermission) || s.requiredPermission === item.requiredPermission) return;
        if (!byPerm.has(s.requiredPermission)) byPerm.set(s.requiredPermission, new Set());
        byPerm.get(s.requiredPermission)!.add(s.label);
      });
      const children: PermChild[] = [...byPerm.entries()].map(([permission, labels]) => ({
        permission,
        label: [...labels].join(' · '),
      }));
      return { id: item.id, label: item.label, icon: item.icon, permission: item.requiredPermission, children };
    });
}
