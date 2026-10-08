"use client";
import { useState } from "react";
import Link from "next/link";
import { templates } from "@/lib/templates";
import { useLanguage } from "./Language";
const groups = {
  home: [
    "painting",
    "cleaning",
    "tiling",
    "landscaping",
    "roofing",
    "hvac",
    "handyman",
    "flooring",
    "windows",
    "fencing",
    "pest-control",
    "pressure-washing",
  ],
  specialist: ["moving", "auto-detailing", "photography"],
};
export default function TemplateGallery() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const visible = templates.filter(
    (template) =>
      `${t(template.name)} ${t(template.industry)} ${t(template.description)}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()) &&
      (group === "all" || groups[group as keyof typeof groups]?.includes(template.slug)),
  );
  return (
    <>
      <div className="gallery-controls">
        <label>
          {t("Find your service")}
          <input
            className="field"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search templates")}
          />
        </label>
        <label>
          {t("Service category")}
          <select className="field" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">{t("All services")}</option>
            <option value="home">{t("Home and property")}</option>
            <option value="specialist">{t("Specialist services")}</option>
          </select>
        </label>
      </div>
      <p className="small muted" aria-live="polite">
        {t("{count} templates", { count: visible.length })}
      </p>
      <div className="grid template-gallery">
        {visible.map((template) => (
          <article className="card" key={template.slug}>
            <span className="pill">{t(template.industry)}</span>
            <h2>{t(template.name)}</h2>
            <p className="muted">{t(template.description)}</p>
            <div className="row">
              <Link className="btn secondary" href={`/q/${template.slug}`}>
                {t("Try demo")}
              </Link>
              <Link className="btn" href={`/builder/${template.slug}`}>
                {t("Customize")}
              </Link>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <p>{t("No matching templates. Try another service or clear your search.")}</p>
      )}
    </>
  );
}
