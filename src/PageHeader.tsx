import type { ReactNode } from 'react';

export function PageHeader({
  title,
  children,
  showTitle = true,
}: {
  title: string;
  children: ReactNode;
  showTitle?: boolean;
}) {
  return (
    <header className="page-header" aria-label="Cabeçalho da página">
      <div className="page-title" aria-hidden={!showTitle || undefined}>
        {showTitle && <h1>{title}</h1>}
      </div>
      {children}
    </header>
  );
}
