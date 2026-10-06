(() => {
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return;

  const publicId = script.dataset.serviceQuote;
  if (!publicId) return;

  const baseUrl = new URL(script.src).origin;
  const iframe = document.createElement("iframe");
  iframe.src = `${baseUrl}/embed/${encodeURIComponent(publicId)}`;
  iframe.title = "Instant quote";
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.style.cssText = "width:100%;min-height:640px;border:0;display:block;";

  script.insertAdjacentElement("afterend", iframe);
})();
