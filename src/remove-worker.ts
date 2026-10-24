import { outputType, removeMark } from "./watermark.ts"

export type Request = { id: number; file: File }
export type Response =
  | { id: number; ok: true; blob: Blob; found: boolean }
  | { id: number; ok: false }

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    const bitmap = await createImageBitmap(data.file)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext("2d", { willReadFrequently: true })!
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const { imageData, found } = removeMark(context.getImageData(0, 0, canvas.width, canvas.height))
    context.putImageData(imageData, 0, 0)
    const blob = await canvas.convertToBlob({ type: outputType(data.file.type), quality: 0.95 })
    self.postMessage({ id: data.id, ok: true, blob, found } satisfies Response)
  } catch (error) {
    console.error("[gemini-watermark-remover]", error)
    self.postMessage({ id: data.id, ok: false } satisfies Response)
  }
}
