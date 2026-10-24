# Gemini watermark remover

Remove the visible Gemini sparkle from images that you made with Gemini or Nano Banana, in your browser. The images never leave your device.

Live at [bannerify.co/tools/gemini-watermark-remover](https://bannerify.co/tools/gemini-watermark-remover).

## How it works

- Gemini blends a white sparkle into the bottom-right corner with a known alpha map. The tool gets the original pixels back: `original = (pixel - alpha × 255) / (1 - alpha)`.
- The detection and the alpha maps come from [gemini-watermark-remover](https://github.com/GargantuaX/gemini-watermark-remover) (MIT), through its `image-data` SDK. No model and no network: it runs in a Web Worker.
- An image without the mark is not changed. PNG stays PNG; JPEG and WebP are saved again at quality 0.95.
- Only the visible mark. The invisible SynthID watermark stays.

## Develop

- `bun install`
- `bun run dev`: a preview page on port 5176
- `bun test` and `bun run typecheck`
- `bun run build`: a React component in `dist/` that bannerify.co loads from `/gemini-watermark-remover/index.js`. React is left out of the build.
- `bun run up`: build, then deploy `dist/` as the static-assets Worker `bannerify-gemini-watermark-remover`.

## License

MIT. The upstream engine is MIT too (© 2025 Jad, © 2024 AllenK).
