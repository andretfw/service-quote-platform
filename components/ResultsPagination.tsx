"use client";
import Link from "next/link";
import { useLanguage } from "./Language";

export default function ResultsPagination({
  page,
  total,
  pageSize,
  path,
  filters,
  label,
}: {
  page: number;
  total: number;
  pageSize: number;
  path: string;
  filters: Record<string, string>;
  label: string;
}) {
  const { t } = useLanguage();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const url = (number: number) => {
    const query = new URLSearchParams({ page: String(number) });
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
    return `${path}?${query}`;
  };
  return (
    <nav className="lead-pagination" aria-label={t("Result pages")}>
      <p className="muted">{t(label, { count: total, page, pages })}</p>
      <div className="row">
        {page > 1 && (
          <Link className="btn secondary" href={url(Math.min(page - 1, pages))}>
            {t("Previous page")}
          </Link>
        )}
        {page < pages && (
          <Link className="btn secondary" href={url(page + 1)}>
            {t("Next page")}
          </Link>
        )}
      </div>
    </nav>
  );
}
