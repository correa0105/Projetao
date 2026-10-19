import { useState } from 'react';
export function ItemPicker({
  items,
  onPick,
  disabled = false,
}: {
  items: { id: string; name: string; image: string }[];
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState('');
  return (
    <div className="rp-item-picker">
      <button type="button" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}>
        Escolha uma peça ▾
      </button>
      {open && (
        <div className="rp-item-options">
          <input
            aria-label="Buscar peça"
            placeholder="Buscar peça…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div>
            {items
              .filter((i) => i.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
              .map((i) => (
                <button
                  type="button"
                  key={i.id}
                  onClick={() => {
                    onPick(i.id);
                    setOpen(false);
                  }}
                >
                  <img src={i.image} alt="" loading="lazy" />
                  <span>{i.name}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
