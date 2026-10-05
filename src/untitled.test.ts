import { describe, it, expect } from 'vitest'
import { uniqueUntitledName } from './untitled'

describe('uniqueUntitledName', () => {
  it('generates a markdown filename with the Untitled prefix', () => {
    const name = uniqueUntitledName()
    expect(name).toMatch(/^Untitled-.+\.md$/)
  })

  it('is unique across calls (temp dir is shared across windows)', () => {
    const names = new Set(Array.from({ length: 1000 }, () => uniqueUntitledName()))
    expect(names.size).toBe(1000)
  })
})
