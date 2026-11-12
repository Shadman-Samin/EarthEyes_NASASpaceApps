import { catalogueQuerySchema } from "../../../src/domain/catalogue.js"

export function parseCatalogueQuery(params: URLSearchParams) {
  const values = Object.fromEntries(params)
  if ([...params].length !== Object.keys(values).length) {
    throw new Error("Repeated query parameters are not supported")
  }

  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
  return catalogueQuerySchema.parse({
    ...values,
    bbox: values.bbox?.split(",").map((part) => (
      decimal.test(part.trim()) ? Number(part) : Number.NaN
    )),
    limit: values.limit === undefined ? undefined : /^\d+$/.test(values.limit) ? Number(values.limit) : Number.NaN,
  })
}
