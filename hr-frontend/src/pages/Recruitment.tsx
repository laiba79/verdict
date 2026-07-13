import { useEffect, useState } from 'react';
import { Users2, ShieldCheck, Stethoscope, Loader2 } from 'lucide-react';
import type { JobDescription } from '../types';
import { listJobDescriptions } from '../services/resources';
import JobDescriptionSidebar from '../components/recruitment/JobDescriptionSidebar';
import CandidatesPanel from '../components/recruitment/CandidatesPanel';
import BiasCheckerPanel from '../components/recruitment/BiasCheckerPanel';
import ResumeDoctorPanel from '../components/recruitment/ResumeDoctorPanel';

type Tab = 'match' | 'bias' | 'doctor';

const TABS: { key: Tab; label: string; icon: typeof Users2 }[] = [
  { key: 'match', label: 'Resume Matching', icon: Users2 },
  { key: 'bias', label: 'Bias Checker', icon: ShieldCheck },
  { key: 'doctor', label: 'Resume Doctor', icon: Stethoscope },
];

const Recruitment = () => {
  const [tab, setTab] = useState<Tab>('match');
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await listJobDescriptions();
        setJds(data);
        if (data.length > 0) setSelectedId(data[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = jds.find((j) => j.id === selectedId) ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-800 dark:text-white mb-1">AI Recruitment</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Match resumes against job descriptions, rank candidates, catch biased language before you post,
          and get resume improvement feedback — all AI-generated.
        </p>
      </div>

      <div className="flex gap-1.5 border-b border-slate-200 dark:border-white/[0.06]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-primary-500 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'match' && (
        loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
            <JobDescriptionSidebar
              jds={jds}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreated={(jd) => { setJds((prev) => [jd, ...prev]); setSelectedId(jd.id); }}
              onDeleted={(id) => {
                setJds((prev) => prev.filter((j) => j.id !== id));
                if (selectedId === id) setSelectedId(null);
              }}
            />
            {selected ? (
              <CandidatesPanel
                jd={selected}
                onCandidateAdded={() =>
                  setJds((prev) => prev.map((j) => j.id === selected.id ? { ...j, candidate_count: j.candidate_count + 1 } : j))
                }
              />
            ) : (
              <div className="panel p-16 text-center text-sm text-slate-400 dark:text-slate-500">
                Select or create a job opening to start uploading and matching candidates.
              </div>
            )}
          </div>
        )
      )}

      {tab === 'bias' && <BiasCheckerPanel />}
      {tab === 'doctor' && <ResumeDoctorPanel />}
    </div>
  );
};

export default Recruitment;
