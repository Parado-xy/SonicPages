"use client";

import { CheckCircle2, FileUp, LoaderCircle, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type UploadIntent = {
  uploadId: string;
  upload: { url: string; fields: Record<string, string> };
};

const accept = ".pdf,.epub,.docx,.txt";

export function UploadDocument() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"idle" | "uploading" | "complete">("idle");
  const [error, setError] = useState<string | null>(null);

  async function uploadDocument() {
    if (!file) return;
    setState("uploading");
    setError(null);

    let intent: UploadIntent | undefined;
    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || contentTypeFromName(file.name),
          sizeBytes: file.size,
        }),
      });
      const body = (await response.json()) as UploadIntent & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to prepare the upload.");
      intent = body;

      const form = new FormData();
      Object.entries(intent.upload.fields).forEach(([key, value]) => form.append(key, value));
      form.append("file", file);
      await sendToStorage(intent.upload.url, form, setProgress);

      const completion = await fetch(`/api/uploads/${intent.uploadId}/complete`, { method: "POST" });
      const completionBody = (await completion.json()) as { error?: string };
      if (!completion.ok) throw new Error(completionBody.error ?? "Unable to verify the upload.");

      setState("complete");
      router.refresh();
    } catch (uploadError) {
      if (intent) {
        await fetch(`/api/uploads/${intent.uploadId}`, { method: "DELETE" }).catch(() => undefined);
      }
      setState("idle");
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    }
  }

  function reset() {
    setFile(null);
    setProgress(0);
    setState("idle");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    reset();
    setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload className="size-4" /> Add document
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/25 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-title"
        >
          <Card className="w-full max-w-lg p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Private upload</p>
                <h2 id="upload-title" className="mt-2 text-2xl font-semibold">Add to your library</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  PDF, EPUB, DOCX, or TXT. Files are sent directly to private storage.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={close} aria-label="Close upload dialog" disabled={state === "uploading"}>
                <X className="size-4" />
              </Button>
            </div>

            {state === "complete" ? (
              <div className="mt-8 rounded-2xl border border-primary/25 bg-primary/5 p-6 text-center">
                <CheckCircle2 className="mx-auto size-9 text-primary" />
                <p className="mt-3 font-semibold">Upload secured</p>
                <p className="mt-1 text-sm text-muted-foreground">Your document is queued for processing.</p>
                <Button className="mt-5" onClick={close}>Done</Button>
              </div>
            ) : (
              <>
                <label
                  className={cn(
                    "mt-7 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center transition-colors hover:border-primary hover:bg-primary/5",
                    file && "border-primary/50 bg-primary/5",
                    state === "uploading" && "pointer-events-none",
                  )}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    className="sr-only"
                    disabled={state === "uploading"}
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setError(null);
                    }}
                  />
                  <FileUp className="size-8 text-primary" />
                  <span className="mt-3 max-w-full truncate font-semibold">
                    {file?.name ?? "Choose a document"}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {file ? formatFileSize(file.size) : "Maximum file size: 50 MiB"}
                  </span>
                </label>

                {state === "uploading" ? (
                  <div className="mt-5" aria-live="polite">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Uploading securely</span><span>{progress}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : null}
                {error ? <p className="mt-4 text-sm text-destructive" role="alert">{error}</p> : null}
                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="ghost" onClick={close} disabled={state === "uploading"}>Cancel</Button>
                  <Button onClick={uploadDocument} disabled={!file || state === "uploading"}>
                    {state === "uploading" ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {state === "uploading" ? "Uploading" : "Upload document"}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}

function sendToStorage(url: string, form: FormData, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("Private storage rejected the upload."));
    });
    request.addEventListener("error", () => reject(new Error("The storage service could not be reached.")));
    request.send(form);
  });
}

function contentTypeFromName(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return {
    pdf: "application/pdf",
    epub: "application/epub+zip",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
  }[extension ?? ""] ?? "application/octet-stream";
}

function formatFileSize(bytes: number) {
  return bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}
