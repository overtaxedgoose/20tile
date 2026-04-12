"use client";

import { useState } from "react";

type Section = "regular" | "junior";
type IssueType = "remove" | "add";
type ModalState = "idle" | "submitting" | "success" | "error";

interface Props {
  defaultSection?: Section;
  className?: string;
}

export function ReportWordButton({ defaultSection, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? "text-xs opacity-40 hover:opacity-70 transition-opacity font-mono tracking-wider"}
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        report a word
      </button>

      {open && (
        <ReportWordModal
          defaultSection={defaultSection}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

interface ModalProps {
  defaultSection?: Section;
  onClose: () => void;
}

function ReportWordModal({ defaultSection, onClose }: ModalProps) {
  const [section, setSection] = useState<Section>(defaultSection ?? "regular");
  const [issueType, setIssueType] = useState<IssueType>("remove");
  const [word, setWord] = useState("");
  const [notes, setNotes] = useState("");
  const [modalState, setModalState] = useState<ModalState>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!word.trim()) return;

    setModalState("submitting");

    try {
      const res = await fetch("/api/report-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          issue_type: issueType,
          word: word.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed");
      setModalState("success");
    } catch {
      setModalState("error");
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal */}
      <div
        className="w-full max-w-sm rounded-xl shadow-2xl p-6 space-y-5"
        style={{ background: "#fff", color: "#1e293b" }}
      >
        {modalState === "success" ? (
          <SuccessState onClose={onClose} />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold tracking-wide font-mono">
                  REPORT A WORD
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Let us know if a word is missing or shouldn&apos;t be there.
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none mt-0.5"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Section toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 tracking-wider mb-1.5">
                  DICTIONARY
                </label>
                <div className="flex gap-2">
                  {(["regular", "junior"] as Section[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSection(s)}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-mono font-bold tracking-wider border-2 transition-all"
                      style={{
                        borderColor: section === s ? (s === "junior" ? "#0369a1" : "#16a34a") : "#e2e8f0",
                        background: section === s ? (s === "junior" ? "#e0f2fe" : "#f0fdf4") : "#f8fafc",
                        color: section === s ? (s === "junior" ? "#0369a1" : "#15803d") : "#94a3b8",
                      }}
                    >
                      {s === "regular" ? "REGULAR" : "JUNIOR"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Issue type toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 tracking-wider mb-1.5">
                  ISSUE
                </label>
                <div className="flex gap-2">
                  {([
                    { value: "remove", label: "Shouldn't be there" },
                    { value: "add", label: "Should be added" },
                  ] as { value: IssueType; label: string }[]).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setIssueType(value)}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-mono border-2 transition-all"
                      style={{
                        borderColor: issueType === value ? "#64748b" : "#e2e8f0",
                        background: issueType === value ? "#f1f5f9" : "#f8fafc",
                        color: issueType === value ? "#1e293b" : "#94a3b8",
                        fontWeight: issueType === value ? 600 : 400,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Word input */}
              <div>
                <label
                  htmlFor="report-word"
                  className="block text-xs font-semibold text-slate-500 tracking-wider mb-1.5"
                >
                  WORD
                </label>
                <input
                  id="report-word"
                  type="text"
                  value={word}
                  onChange={(e) => setWord(e.target.value.toLowerCase())}
                  placeholder="e.g. crag"
                  maxLength={50}
                  className="w-full px-3 py-2.5 rounded-lg border-2 text-sm font-mono outline-none transition-colors"
                  style={{
                    borderColor: word ? "#64748b" : "#e2e8f0",
                    background: "#f8fafc",
                  }}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="none"
                />
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor="report-notes"
                  className="block text-xs font-semibold text-slate-500 tracking-wider mb-1.5"
                >
                  NOTES <span className="font-normal opacity-60">(optional)</span>
                </label>
                <textarea
                  id="report-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything else worth knowing?"
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-2.5 rounded-lg border-2 text-sm outline-none transition-colors resize-none"
                  style={{
                    borderColor: notes ? "#64748b" : "#e2e8f0",
                    background: "#f8fafc",
                  }}
                />
              </div>

              {/* Error */}
              {modalState === "error" && (
                <p className="text-xs text-red-500 font-mono">
                  Something went wrong — please try again.
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!word.trim() || modalState === "submitting"}
                className="w-full py-3 rounded-lg text-sm font-mono font-bold tracking-widest transition-all disabled:opacity-40"
                style={{
                  background: "#1e293b",
                  color: "#fff",
                  cursor: !word.trim() || modalState === "submitting" ? "not-allowed" : "pointer",
                }}
              >
                {modalState === "submitting" ? "SENDING..." : "SEND REPORT"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function SuccessState({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center space-y-4 py-2">
      <div className="text-3xl">✓</div>
      <div>
        <h2 className="text-base font-bold tracking-wide font-mono">REPORT SENT</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Thanks — we&apos;ll take a look and update the dictionary if needed.
        </p>
      </div>
      <button
        onClick={onClose}
        className="text-xs font-mono text-slate-400 hover:text-slate-600 transition-colors tracking-wider"
      >
        CLOSE
      </button>
    </div>
  );
}
