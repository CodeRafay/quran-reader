"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { isSaved, onChange, progressOf, remove, save, supported } from "../lib/offline";
import s from "./Offline.module.css";

const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;

export default function Offline({ file, bytes, title }: { file: string; bytes: number; title: string }) {
  const [saved, setSaved] = useState<boolean | null>(null); // null: not checked yet, or this browser can't
  const [error, setError] = useState("");
  const percent = useSyncExternalStore(onChange, () => progressOf(file), () => undefined);

  // Read after mount: the server render can't see the cache.
  useEffect(() => {
    if (!supported()) return;
    const check = () => isSaved(file).then(setSaved, () => {}); // storage blocked: show nothing
    check();
    return onChange(check);
  }, [file]);

  if (saved === null) return null;

  if (percent !== undefined)
    return (
      <p className={s.offline}>
        Downloading {percent}%
        <progress max={100} value={percent} aria-label={`Downloading ${title}`} />
      </p>
    );

  if (saved)
    return (
      <p className={s.offline}>
        Available offline
        <button
          type="button"
          onClick={() => confirm(`Remove ${title} from this device?`) && remove(file)}
          aria-label={`Remove ${title} from this device`}
        >
          Remove
        </button>
      </p>
    );

  const download = () => {
    setError("");
    save(file, bytes).catch((e) =>
      setError(e?.name === "QuotaExceededError" ? "Not enough space on this device." : "Download failed. Try again."),
    );
  };
  return (
    <p className={s.offline}>
      <button type="button" onClick={download} aria-label={`Download ${title}, ${mb(bytes)}, for offline reading`}>
        Download · {mb(bytes)}
      </button>
      {error && (
        <span className={s.error} role="alert">
          {error}
        </span>
      )}
    </p>
  );
}
