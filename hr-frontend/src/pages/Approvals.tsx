import { useEffect, useState } from 'react';
import { Check, X, Loader2, ClipboardCheck, AlertCircle } from 'lucide-react';
import { listPendingPredictions, approvePrediction, rejectPrediction } from '../services/resources';
import { apiErrorMessage } from '../services/api';
import type { PredictionHistory } from '../types';
import { useAuth } from '../context/AuthContext';
import ImpactBars from '../components/ImpactBars';
import Modal from '../components/Modal';

type ReviewAction = { record: PredictionHistory; kind: 'approve' | 'reject' };

const Approvals = () => {
  const { user } = useAuth();
  const canReview = user?.role === 'admin' || user?.role === 'hr';

  const [items, setItems] = useState<PredictionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewAction | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listPendingPredictions());
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load pending predictions.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submitReview = async () => {
    if (!review) return;
    setBusy(true);
    try {
      if (review.kind === 'approve') await approvePrediction(review.record.id, note || undefined);
      else await rejectPrediction(review.record.id, note || undefined);
      setReview(null);
      setNote('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not submit that review.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {!canReview && (
        <div className="panel px-5 py-3.5 flex items-center gap-2.5 text-sm text-slate-500 dark:text-slate-400">
          <ClipboardCheck className="w-4 h-4 text-primary-500 shrink-0" />
          You can see what's pending for your team here — approving or rejecting salary changes requires an HR or Admin account.
        </div>
      )}

      {error && (
        <div className="panel p-4 flex items-center gap-3 text-sm border-reject-200 dark:border-reject-500/20 bg-reject-50/50 dark:bg-reject-500/5 text-reject-600 dark:text-reject-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="panel p-16 text-center">
          <ClipboardCheck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-slate-500">Nothing waiting on a decision. New salary-change predictions will show up here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((record) => (
            <div key={record.id} className="panel panel-settle p-6 border-l-4 border-l-pending-400 animate-fadeUp">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-semibold text-slate-800 dark:text-white capitalize">
                      {record.target.replace(/_/g, ' ')}
                    </h3>
                    <span className="text-xs text-slate-400 dark:text-slate-500">· employee #{record.employee_id}</span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Model recommends: <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{record.prediction}</span>
                    {record.confidence !== null && (
                      <span className="tabular"> · {(record.confidence * 100).toFixed(1)}% confidence</span>
                    )}
                  </p>
                </div>

                {canReview && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setReview({ record, kind: 'reject' })}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-reject-600 border border-reject-200 hover:bg-reject-50 dark:text-reject-400 dark:border-reject-500/30 dark:hover:bg-reject-500/10 transition-colors"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button
                      onClick={() => setReview({ record, kind: 'approve' })}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-approve-500 hover:bg-approve-600 transition-colors"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                  </div>
                )}
              </div>

              {record.top_features && record.top_features.length > 0 && (
                <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/[0.06]">
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wide">Why the model recommended this</p>
                  <ImpactBars features={record.top_features} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {review && (
        <Modal
          title={review.kind === 'approve' ? 'Approve prediction' : 'Reject prediction'}
          onClose={() => { setReview(null); setNote(''); }}
          maxWidth="max-w-md"
        >
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {review.kind === 'approve'
              ? 'Approving this will apply the salary change to the employee record.'
              : 'Rejecting this will not change anything on the employee record.'}
          </p>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Add context for the record…"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-primary-400/40 dark:border-white/10 text-sm outline-none focus:border-primary-500 transition-colors mb-6"
          />
          <div className="flex items-center justify-end gap-3">
            <button onClick={() => { setReview(null); setNote(''); }} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button
              onClick={submitReview}
              disabled={busy}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors flex items-center gap-2 disabled:opacity-60 ${
                review.kind === 'approve' ? 'bg-approve-500 hover:bg-approve-600' : 'bg-reject-500 hover:bg-reject-600'
              }`}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {review.kind === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Approvals;