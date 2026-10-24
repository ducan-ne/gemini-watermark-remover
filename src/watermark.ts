import { removeWatermarkFromImageDataSync } from "@pilio/gemini-watermark-remover/image-data"

export const MAX_FILES = 10
export const MAX_FILE_BYTES = 30 * 1024 * 1024

export type Removal = { imageData: ImageData; found: boolean }

// Gemini blends a white sparkle into the corner with a known alpha map, so the original pixels
// come back exactly: original = (pixel - alpha × 255) / (1 - alpha). The upstream engine finds the
// mark, its size, and its alpha map, and does nothing when no mark is there.
export const removeMark = (imageData: ImageData): Removal => {
  const result = removeWatermarkFromImageDataSync(imageData, { adaptiveMode: "auto" })
  return { imageData: result.imageData as ImageData, found: result.meta.applied }
}

// A JPEG or WebP stays in its format (at high quality). Every other image becomes a PNG.
export const outputType = (type: string) => (type === "image/jpeg" || type === "image/webp" ? type : "image/png")

export const outputName = (name: string, type: string) => {
  const extension = type === "image/jpeg" ? "jpg" : type.slice("image/".length)
  return `${name.replace(/\.[^.]+$/, "")}-no-watermark.${extension}`
}
