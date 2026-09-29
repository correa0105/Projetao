import { PAPER_LABELS, PAPER_STYLES, type PaperStyle } from '../shared/notice-board';

export function PaperPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: PaperStyle;
  onChange: (value: PaperStyle) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="paper-picker" disabled={disabled}>
      <legend>Modelo de papel</legend>
      <div>
        {PAPER_STYLES.map((style) => (
          <button
            type="button"
            key={style}
            aria-pressed={value === style}
            onClick={() => onChange(style)}
          >
            <img src={`/notices/paper-${style}.png`} alt="" />
            <span>{PAPER_LABELS[style]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
