import type { ReactNode } from 'react';

export function PageHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="page-header" aria-label="Cabeçalho da página">
      <div className="page-title">
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}
