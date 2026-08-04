import type { UnitReport } from '../../types';
import IncomingReportCard from './IncomingReportCard';

export default function IncomingReportsTab({ incoming, onReviewed }: { incoming: UnitReport[]; onReviewed: () => void }) {
  return (
    <div className="space-y-3">
      {incoming.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">İncelenecek sunulmuş rapor yok.</p>
      ) : (
        incoming.map(r => <IncomingReportCard key={r.id} report={r} onReviewed={onReviewed} />)
      )}
    </div>
  );
}
