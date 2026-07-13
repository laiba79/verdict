interface ScoreRingProps {
  score: number; // 0-100
  size?: number;
}

const tone = (score: number) => {
  if (score >= 75) return { ring: '#1F9D6B', text: 'text-approve-600 dark:text-approve-400' };
  if (score >= 50) return { ring: '#D98E1B', text: 'text-pending-600 dark:text-pending-400' };
  return { ring: '#E0435C', text: 'text-reject-600 dark:text-reject-400' };
};

const ScoreRing = ({ score, size = 88 }: ScoreRingProps) => {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(score, 0), 100) / 100);
  const { ring, text } = tone(score);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={7} className="stroke-slate-100 dark:stroke-white/[0.06]" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={7}
          fill="none"
          stroke={ring}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-display text-xl font-bold tabular ${text}`}>{Math.round(score)}</span>
      </div>
    </div>
  );
};

export default ScoreRing;
