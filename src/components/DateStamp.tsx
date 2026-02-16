interface DateStampProps {
  date: Date;
}

export default function DateStamp({ date }: DateStampProps) {
  const d = date instanceof Date ? date : new Date(date);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();

  return (
    <time
      dateTime={d.toISOString()}
      className="inline-block font-mono text-[11px] uppercase tracking-widest text-terracotta bg-terracotta/[0.06] px-2 py-0.5 rounded select-none"
    >
      {month} {day}, {year}
    </time>
  );
}
