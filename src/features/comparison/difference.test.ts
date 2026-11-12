import { describe, expect, it } from "vitest"
import { browseDifference } from "./difference"

function image(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      data.set(fill(x, y), index)
    }
  }
  return { data, width, height }
}

describe("browseDifference", () => {
  it("marks later-brighter pixels warm and later-darker pixels teal", () => {
    const earlier = image(2, 1, (x) => x === 0 ? [10, 10, 10, 255] : [200, 200, 200, 255])
    const later = image(2, 1, (x) => x === 0 ? [160, 160, 160, 255] : [40, 40, 40, 255])
    const result = browseDifference(earlier, later)
    expect(result.width).toBe(2)
    expect(result.height).toBe(1)
    expect(result.changedShare).toBe(1)
    expect(result.brighterShare).toBeCloseTo(0.5, 5)
    expect(result.darkerShare).toBeCloseTo(0.5, 5)
    const [warmR, warmG, warmB] = [result.pixels[0], result.pixels[1], result.pixels[2]]
    expect(warmR).toBeGreaterThan(warmG)
    expect(warmG).toBeGreaterThan(warmB)
    const [tealR, tealG, tealB] = [result.pixels[4], result.pixels[5], result.pixels[6]]
    expect(tealB).toBeGreaterThan(tealR)
    expect(tealG).toBeGreaterThan(tealR)
  })

  it("keeps identical pixels dark and unchanged in the changed share", () => {
    const same = image(3, 2, () => [120, 90, 60, 255])
    const result = browseDifference(same, image(3, 2, () => [120, 90, 60, 255]))
    expect(result.changedShare).toBe(0)
    for (let index = 0; index < result.pixels.length; index += 4) expect(result.pixels[index]).toBeLessThanOrEqual(8)
  })

  it("clips the comparison to the smaller render and respects transparent areas", () => {
    const earlier = image(2, 1, () => [10, 10, 10, 255])
    const larger = image(3, 2, (x) => x === 0 ? [240, 240, 240, 255] : [10, 10, 10, 255])
    const result = browseDifference(earlier, larger)
    expect(result.width).toBe(2)
    expect(result.height).toBe(1)
    expect(result.changedShare).toBe(0.5)
    expect(result.pixels[3]).toBe(255)
  })
})
