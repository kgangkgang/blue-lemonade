# GIF export dependencies

These modules are loaded only inside the GIF export worker.

- `gif-writer.js`: writer portion of omggif 1.0.10, Dean McNamee, MIT. Original copyright and license are preserved in the file. https://github.com/deanm/omggif
- `image-q.js`: image-q 4.0.0 ESM bundle, Igor Bezkrovny and contributors, MIT. The complete license and bundled notices are preserved in the file. https://github.com/ibezkrovny/image-quantization

No CDN, remote encoder, or upload is used for GIF export.
