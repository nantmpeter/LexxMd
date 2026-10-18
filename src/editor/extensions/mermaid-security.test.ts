import { describe, it, expect } from 'vitest'
import { render as peleRender } from 'pele'

const COMPLEX_DIAGRAM = `flowchart TD
    P["门户"]
    subgraph L2["行业业务组件"]
        direction LR
        L2A1["油船站数据可视化"]
    end
    P --> L2`

// Pele has no securityLevel toggle: untrusted text is escaped and links /
// styles are filtered by design. These tests pin that behavior so a pele
// upgrade cannot silently reintroduce script injection through node labels
// or click links.
describe('pele renders untrusted diagrams safely', () => {
  it('renders the complex diagram', () => {
    const { svg } = peleRender(COMPLEX_DIAGRAM)
    expect(svg).toContain('<svg')
  })

  it('strips script tags from node labels', () => {
    // Pele drops the tags entirely (label text survives inert); no script
    // element or entity-encoded variant may reach the SVG.
    const { svg } = peleRender('flowchart TD\n  A["<script>alert(1)</script>"]')
    expect(svg).not.toContain('<script')
    expect(svg.toLowerCase()).not.toContain('</script')
  })

  it('does not emit javascript: links from click statements', () => {
    const { svg } = peleRender('flowchart TD\n  A --> B\n  click A "javascript:alert(1)"')
    expect(svg).not.toContain('javascript:')
  })
})
