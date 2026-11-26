// Pinterest serves each image at several widths; we serve the original file
// at every size and report scaled dimensions so the grid lays out correctly.
const WIDTHS = [170, 236, 474, 736];

export function scaledImages(pin, origin) {
  const url = `${origin}${pin.image_path}`;
  const { width, height } = pin;
  const images = {};
  for (const w of WIDTHS) images[`${w}x`] = { url, width: w, height: Math.round((height / width) * w) };
  images.orig = { url, width, height };
  return images;
}
