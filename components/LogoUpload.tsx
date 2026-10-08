"use client";
import { Text, LocalizedInput } from "@/components/Language";

import Image from "next/image";
import { useState } from "react";

export default function LogoUpload({
  value,
  onChange,
  onBusyChange,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File) {
    setError("");
    setBusy(true);
    onBusyChange(true);
    let bitmap: ImageBitmap | undefined;
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 2 * 1024 * 1024
      )
        throw new Error("Choose a PNG, JPEG or WebP image under 2 MB.");
      bitmap = await createImageBitmap(file);
      if (bitmap.width > 4096 || bitmap.height > 4096)
        throw new Error("Logo dimensions must be at most 4096 × 4096 pixels.");
      const canvas = document.createElement("canvas");
      let result = "";
      for (const [width, height] of [
        [256, 128],
        [128, 64],
      ]) {
        const ratio = Math.min(1, width / bitmap.width, height / bitmap.height);
        canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
        canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Your browser could not process this image.");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        result = canvas.toDataURL("image/png");
        if (result.length <= 87000) break;
      }
      if (result.length > 87000) throw new Error("Choose a simpler or smaller logo.");
      onChange(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not read the logo image.");
    } finally {
      bitmap?.close();
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <div className="editor-section">
      <label className="editor-field">
        <Text>{"Business logo"}</Text>
        <LocalizedInput
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      <p className="muted">
        <Text>
          {
            "PNG, JPEG or WebP, up to 2 MB. Your logo appears on the hosted calculator and website embed. Save your calculator to publish it."
          }
        </Text>
      </p>
      {value && (
        <>
          <Image
            src={value}
            alt="Your business logo preview"
            width={160}
            height={80}
            unoptimized
            className="business-logo"
          />
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={() => {
              onChange(undefined);
              setError("");
            }}
          >
            <Text>{"Remove logo"}</Text>
          </button>
        </>
      )}
      {busy && (
        <p role="status">
          <Text>{"Preparing logo…"}</Text>
        </p>
      )}
      {error && (
        <p className="error-message" role="alert">
          <Text>{error}</Text>
        </p>
      )}
    </div>
  );
}
