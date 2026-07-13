import { useState } from 'react';
import { Briefcase, Plus, Users, Trash2 } from 'lucide-react';
import type { JobDescription } from '../../types';
import { deleteJobDescription } from '../../services/resources';
import CreateJDModal from './CreateJDModal';

const JobDescriptionSidebar = ({
  jds,
  selectedId,
  onSelect,
  onCreated,
  onDeleted,
}: {
  jds: JobDescription[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreated: (jd: JobDescription) => void;
  onDeleted: (id: number) => void;
}) => {
  const [showCreate, setShowCreate] = useState(false);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Delete this job description and all its candidates/reports? This cannot be undone.')) return;
    await deleteJobDescription(id);
    onDeleted(id);
  };

  return (
    <>
      <div className="panel p-4 space-y-1.5 h-fit">
        <div className="flex items-center justify-between px-1 mb-2">
          <h3 className="font-display text-sm font-semibold text-slate-800 dark:text-white">Job openings</h3>
          <button
            onClick={() => setShowCreate(true)}
            className="p-1.5 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10"
            aria-label="New job description"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {jds.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 px-1 py-4 text-center">
            No job openings yet — create one to start matching candidates.
          </p>
        )}

        {jds.map((jd) => (
          <button
            key={jd.id}
            onClick={() => onSelect(jd.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors group ${
              selectedId === jd.id
                ? 'bg-primary-50 dark:bg-primary-500/10'
                : 'hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Briefcase className={`w-3.5 h-3.5 shrink-0 ${selectedId === jd.id ? 'text-primary-500' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium truncate ${selectedId === jd.id ? 'text-primary-700 dark:text-primary-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {jd.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 pl-5">
                  {jd.department && <span>{jd.department}</span>}
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{jd.candidate_count}</span>
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(e, jd.id)}
                className="p-1 rounded-md text-slate-300 hover:text-reject-500 hover:bg-reject-50 dark:hover:bg-reject-500/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                aria-label="Delete job description"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </button>
        ))}
      </div>

      {showCreate && (
        <CreateJDModal
          onClose={() => setShowCreate(false)}
          onCreated={(jd) => { onCreated(jd); setShowCreate(false); }}
        />
      )}
    </>
  );
};

export default JobDescriptionSidebar;
