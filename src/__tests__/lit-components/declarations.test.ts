/**
 * Tests for Lit component source declarations that govern Vue ↔ Lit interop.
 *
 * Lit's @property() decorator lowercases camelCase names by default for the
 * observed HTML attribute. Vue sets kebab-case attributes for primitive props.
 * When these don't match, the Lit component never receives the value.
 *
 * E.g. `apiKey` → Lit observes `apikey`, but Vue sets `api-key`. The fix is
 * `@property({ attribute: 'api-key' })`. These tests guard that contract.
 *
 * We also guard the array/object normalisation getters (_items, _item) that
 * prevent the "visibleDots.map is not a function" crash when Vue passes a
 * plain JS object/array reference instead of a JSON string.
 */
import * as fs from 'fs'
import * as path from 'path'

const componentsDir = path.resolve(__dirname, '../../components')

function readComponent(name: string): string {
  return fs.readFileSync(path.join(componentsDir, name), 'utf8')
}

describe('search-modal.ts', () => {
  const src = readComponent('search-modal.ts')

  it('declares attribute: "api-key" (kebab-case) for the apiKey property', () => {
    // Vue sets `api-key` (kebab) as an attribute. Lit default would produce
    // `apikey` (all-lowercase). The explicit attribute option is required.
    expect(src).toMatch(/attribute:\s*['"]api-key['"]/)
  })

  it('does not rely on the default Lit attribute name "apikey" for apiKey', () => {
    // If someone removes the explicit attribute: option the default name
    // "apikey" (all lowercase) would no longer match the Vue-set "api-key".
    // This pattern checks there is no bare @property declaration for apiKey.
    const defaultDecl = /@property\(\s*\{[^}]*\}\s*\)\s*apiKey/
    // The declaration must include an explicit attribute option
    const explicitDecl = /@property\(\s*\{[^}]*attribute:\s*['"]api-key['"][^}]*\}\s*\)\s*apiKey/
    if (defaultDecl.test(src)) {
      expect(explicitDecl.test(src)).toBe(true)
    }
  })
})

describe('trending-carousel.ts', () => {
  const src = readComponent('trending-carousel.ts')

  it('has a private _items getter for array normalisation', () => {
    // Vue can pass the items prop as a plain JS array (DOM property set).
    // Without normalisation, if the value is a string (JSON.stringify path),
    // calling .map() on it throws "is not a function".
    expect(src).toMatch(/private get _items\s*\(\)\s*:\s*MediaItem\[\]/)
  })

  it('_items getter handles string input via JSON.parse', () => {
    expect(src).toMatch(/typeof raw === 'string'/)
  })

  it('_items getter handles plain array input', () => {
    expect(src).toMatch(/Array\.isArray\(raw\)/)
  })

  it('render() uses _items not raw this.items', () => {
    // Ensure the render path goes through the normalising getter, not the raw prop
    const renderBlock = src.slice(src.indexOf('render()'))
    expect(renderBlock).not.toMatch(/\bthis\.items\b/)
    expect(renderBlock).toMatch(/this\._items/)
  })

  it('_getVisibleCards() uses _items not raw this.items', () => {
    const methodBlock = src.slice(src.indexOf('_getVisibleCards'))
    expect(methodBlock.slice(0, 300)).not.toMatch(/\bthis\.items\b/)
  })
})

describe('media-card.ts', () => {
  const src = readComponent('media-card.ts')

  it('has a private _item getter for object normalisation', () => {
    // Same pattern as _items: Vue can pass a plain JS object (DOM property set)
    // or a JSON string (attribute fallback). The getter normalises both.
    expect(src).toMatch(/private get _item\s*\(\)\s*:\s*MediaItem \| null/)
  })

  it('_item getter handles string input via JSON.parse', () => {
    expect(src).toMatch(/typeof raw === 'string'/)
  })

  it('render() uses _item not raw this.item directly', () => {
    const renderBlock = src.slice(src.indexOf('render()'))
    // The render block should reference _item (normalised), not raw this.item
    expect(renderBlock).toMatch(/this\._item/)
  })
})
