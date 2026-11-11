export type DifferenceInput = { data: Uint8ClampedArray | number[]; width: number; height: number }
export type DifferenceResult = {
  pixels: Uint8ClampedArray<ArrayBuffer>
  width: number
  height: number
  changedShare: number
}

const changeThreshold = 26
const luminance = (data: Uint8ClampedArray | number[], index: number) =>
  0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]

export function browseDifference(a: DifferenceInput, b: DifferenceInput): DifferenceResult {
  const width = Math.min(a.width, b.width)
  const height = Math.min(a.height, b.height)
  const pixels = new Uint8ClampedArray(new ArrayBuffer(width * height * 4))
  let changed = 0
  for (let y = 0; y < height; y++) {
    const rowA = a.width * y
    const rowB = b.width * y
    const rowOut = width * y
    for (let x = 0; x < width; x++) {
      const indexA = (rowA + x) * 4
      const indexB = (rowB + x) * 4
      const indexOut = (rowOut + x) * 4
      const alpha = Math.min(a.data[indexA + 3], b.data[indexB + 3])
      const delta = Math.abs(luminance(a.data, indexA) - luminance(b.data, indexB))
      const intensity = Math.min(255, delta * 3.2)
      const increase = luminance(b.data, indexB) > luminance(a.data, indexA)
      pixels[indexOut] = increase ? intensity : intensity * 0.16
      pixels[indexOut + 1] = increase ? intensity * 0.66 : intensity * 0.62
      pixels[indexOut + 2] = increase ? intensity * 0.28 : intensity
      pixels[indexOut + 3] = alpha
      if (delta > changeThreshold && alpha > 0) changed++
    }
  }
  return { pixels, width, height, changedShare: changed / (width * height) }
}
