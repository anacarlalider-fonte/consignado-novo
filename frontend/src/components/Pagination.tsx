type Props = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}>
        Anterior
      </button>
      <span>
        Pagina {page} de {totalPages}
      </span>
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
        Proxima
      </button>
    </div>
  );
}
