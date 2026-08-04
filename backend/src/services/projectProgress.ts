export interface MilestoneForProgress { title: string; status: string; progress: number }

export interface ProjectProgressResult {
  progress: number;
  phase: string;
  /** true → tüm milestone'lar COMPLETED/CANCELLED; çağıran taraf status=COMPLETED+actualEndDate yazmalı. */
  completed: boolean;
}

/**
 * Projenin milestone'larından türetilen ilerleme/aşama. Saf; DB'den zaten
 * çekilmiş milestone listesi üzerinde çalışır.
 *
 * NOT (kasıtlı, mevcut davranış): milestone listesi BOŞSA `every()` boş
 * dizide her zaman true döner (vacuous truth) → `completed=true`, `phase=
 * 'Tamamlandı'`. Pratikte projeler şablon üzerinden milestone'larla birlikte
 * oluşturulduğu için bu dal muhtemelen hiç tetiklenmiyor, ama davranış
 * değiştirilmeden aynen korundu.
 */
export function computeProjectProgress(milestones: MilestoneForProgress[]): ProjectProgressResult {
  const avgProgress = milestones.length
    ? Math.round(milestones.reduce((s, m) => s + m.progress, 0) / milestones.length)
    : 0;
  const activeMs = milestones.find((m) => m.status === 'IN_PROGRESS');
  const allDone = milestones.every((m) => m.status === 'COMPLETED' || m.status === 'CANCELLED');
  const phase = activeMs?.title ?? (allDone ? 'Tamamlandı' : milestones[0]?.title ?? 'Planlama');
  return { progress: avgProgress, phase, completed: allDone };
}
