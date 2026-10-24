import { useRef, useState, type DragEvent } from "react"
import type { Request, Response } from "./remove-worker.ts"
import { MAX_FILE_BYTES, MAX_FILES, outputName } from "./watermark.ts"

type Item = {
  id: number
  name: string
  original: string
} & (
  | { state: "busy" }
  | { state: "done"; url: string; fileName: string; found: boolean; show: "cleaned" | "original" }
  | { state: "error"; message: string }
)

const OPTION =
  "cursor-pointer rounded-md px-2.5 py-1 text-xs text-neutral-500 transition-colors hover:text-neutral-900 has-checked:bg-neutral-950 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-blue-600"
const BUTTON =
  "inline-flex items-center justify-center rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"

let nextId = 0

const WatermarkRemover = () => {
  const [items, setItems] = useState<Item[]>([])
  const [notice, setNotice] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const worker = useRef<Worker>(undefined)

  const update = (id: number, change: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.id === id ? ({ ...item, ...change } as Item) : item)))

  const getWorker = () => {
    if (worker.current) return worker.current
    const created = new Worker(new URL("./remove-worker.ts", import.meta.url), { type: "module" })
    created.onmessage = ({ data }: MessageEvent<Response>) => {
      if (!data.ok) {
        update(data.id, { state: "error", message: "The tool could not read this image. Try a PNG or a JPEG." })
        return
      }
      setItems((current) =>
        current.map((item) => {
          if (item.id !== data.id) return item
          return {
            ...item,
            state: "done",
            url: URL.createObjectURL(data.blob),
            fileName: outputName(item.name, data.blob.type),
            found: data.found,
            show: "cleaned",
          }
        }),
      )
    }
    worker.current = created
    return created
  }

  const add = (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"))
    const accepted = images.filter((file) => file.size <= MAX_FILE_BYTES).slice(0, MAX_FILES)
    setNotice(
      images.length > accepted.length
        ? `The tool takes up to ${MAX_FILES} images at a time, each up to 30 MB. It skipped ${images.length - accepted.length}.`
        : images.length < files.length
          ? "The tool takes images only (PNG, JPEG, or WebP)."
          : undefined,
    )
    const added = accepted.map((file): Item => ({
      id: nextId++,
      name: file.name,
      original: URL.createObjectURL(file),
      state: "busy",
    }))
    setItems((current) => [...added, ...current])
    for (const [index, item] of added.entries()) {
      getWorker().postMessage({ id: item.id, file: accepted[index] } satisfies Request)
    }
  }

  const clear = () => {
    for (const item of items) {
      URL.revokeObjectURL(item.original)
      if (item.state === "done") URL.revokeObjectURL(item.url)
    }
    setItems([])
    setNotice(undefined)
  }

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    add([...event.dataTransfer.files])
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 text-left">
      <label
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-dragging={dragging || undefined}
        className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center transition-colors hover:border-neutral-400 has-focus-visible:outline-2 has-focus-visible:outline-blue-600 data-dragging:border-blue-500 data-dragging:bg-blue-50"
      >
        <span className="text-sm font-medium text-neutral-900">Choose Gemini images</span>
        <span className="text-sm text-neutral-500">
          PNG, JPEG, or WebP, up to {MAX_FILES} at a time. Or drop them here.
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => {
            add([...(event.target.files ?? [])])
            event.target.value = ""
          }}
        />
      </label>

      <p aria-live="polite" className="text-sm text-pretty text-neutral-500">
        {notice ?? "The tool works in your browser, so your images never leave your device."}
      </p>

      {items.length > 0 && (
        <ul className="flex flex-col gap-6">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium break-all text-neutral-900">{item.name}</span>
                {item.state === "done" && item.found && (
                  <div
                    role="radiogroup"
                    aria-label={`View of ${item.name}`}
                    className="flex gap-1 rounded-lg border border-neutral-200 bg-white p-1"
                  >
                    {(["cleaned", "original"] as const).map((show) => (
                      <label key={show} className={OPTION}>
                        <input
                          type="radio"
                          name={`view-${item.id}`}
                          className="sr-only"
                          checked={item.show === show}
                          onChange={() => update(item.id, { show })}
                        />
                        {show === "cleaned" ? "Cleaned" : "Original"}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <img
                src={item.state === "done" && item.show === "cleaned" ? item.url : item.original}
                alt={item.state === "done" && item.show === "cleaned" ? `${item.name} without the watermark` : item.name}
                className="max-h-[32rem] w-full rounded-lg border border-neutral-200 bg-neutral-100 object-contain"
              />
              <p
                data-state={item.state}
                className="text-sm text-pretty text-neutral-500 data-[state=error]:text-red-600"
              >
                {item.state === "busy" && "Removing the watermark…"}
                {item.state === "error" && item.message}
                {item.state === "done" &&
                  (item.found
                    ? "Done. The sparkle is gone. Compare with the original, then download."
                    : "The tool found no Gemini watermark in this image, so it did not change it.")}
              </p>
              {item.state === "done" && item.found && (
                <a href={item.url} download={item.fileName} className={`${BUTTON} self-start`}>
                  Download {item.fileName.split(".").pop()?.toUpperCase()}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length > 1 && (
        <button type="button" onClick={clear} className="self-start text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900">
          Clear all
        </button>
      )}

      <p className="text-xs text-pretty text-neutral-500">
        It removes the visible mark only, not the invisible SynthID watermark. The source of this tool is on{" "}
        <a
          href="https://github.com/ducan-ne/gemini-watermark-remover"
          className="underline underline-offset-4"
          rel="noopener"
        >
          GitHub
        </a>
        .
      </p>
    </div>
  )
}

export default WatermarkRemover
