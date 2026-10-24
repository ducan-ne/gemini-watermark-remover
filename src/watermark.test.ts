import { describe, expect, test } from "bun:test"
import { calculateWatermarkPosition, detectWatermarkConfig } from "@pilio/gemini-watermark-remover/image-data"
// @ts-expect-error: the package does not export its core files, and has no types for them.
import { getEmbeddedAlphaMap } from "../node_modules/@pilio/gemini-watermark-remover/src/core/embeddedAlphaMaps.js"
import { outputName, outputType, removeMark } from "./watermark.ts"

// A photo-like image: smooth gradients and some noise, with a fixed seed.
const photo = (width: number, height: number) => {
  const data = new Uint8ClampedArray(width * height * 4)
  let seed = 7
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 24
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = 60 + (x / width) * 120 + noise()
      data[i + 1] = 90 + (y / height) * 80 + noise()
      data[i + 2] = 140 + Math.sin(x / 40) * 30 + noise()
      data[i + 3] = 255
    }
  }
  return { width, height, data, colorSpace: "srgb" } as ImageData
}

// Blends the white sparkle into the corner, as Gemini does.
const addMark = (image: ImageData) => {
  const config = detectWatermarkConfig(image.width, image.height)
  const box = calculateWatermarkPosition(image.width, image.height, config)
  const alpha: Float32Array = getEmbeddedAlphaMap(config.logoSize)
  const marked = new Uint8ClampedArray(image.data)
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const a = alpha[y * box.width + x]
      const i = ((box.y + y) * image.width + box.x + x) * 4
      for (let c = 0; c < 3; c++) marked[i + c] = a * 255 + (1 - a) * image.data[i + c]
    }
  }
  return { image: { ...image, data: marked } as ImageData, box }
}

const maxDifference = (a: ImageData, b: ImageData) => {
  let max = 0
  for (let i = 0; i < a.data.length; i++) max = Math.max(max, Math.abs(a.data[i] - b.data[i]))
  return max
}

describe("removeMark", () => {
  for (const [width, height] of [
    [1024, 1024],
    [2048, 2048],
  ]) {
    test(`gives back the original pixels of a ${width}×${height} image`, () => {
      const original = photo(width, height)
      const { image } = addMark(original)
      expect(maxDifference(image, original)).toBeGreaterThan(60)
      const result = removeMark(image)
      expect(result.found).toBe(true)
      expect(maxDifference(result.imageData, original)).toBeLessThanOrEqual(3)
    })
  }

  test("does not change an image without the mark", () => {
    const original = photo(1024, 1024)
    const result = removeMark({ ...original, data: new Uint8ClampedArray(original.data) } as ImageData)
    expect(result.found).toBe(false)
    expect(maxDifference(result.imageData, original)).toBe(0)
  })
})

describe("output", () => {
  test("keeps JPEG and WebP, and makes PNG of other types", () => {
    expect(outputType("image/jpeg")).toBe("image/jpeg")
    expect(outputType("image/webp")).toBe("image/webp")
    expect(outputType("image/png")).toBe("image/png")
    expect(outputType("image/heic")).toBe("image/png")
  })

  test("names the file after the original", () => {
    expect(outputName("Gemini_Generated_Image.png", "image/png")).toBe("Gemini_Generated_Image-no-watermark.png")
    expect(outputName("photo.jpeg", "image/jpeg")).toBe("photo-no-watermark.jpg")
  })
})
