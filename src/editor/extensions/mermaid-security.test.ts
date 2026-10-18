import { describe, it, expect, beforeAll } from 'vitest'
import mermaid from 'mermaid'

const COMPLEX_DIAGRAM = `flowchart TD
    P["门户"]
    subgraph L2["行业业务组件"]
        direction LR
        L2A1["油船站数据可视化"]
    end
    P --> L2`

describe('mermaid securityLevel comparison', () => {
  it('renders with strict mode', async () => {
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' })
    const { svg } = await mermaid.render('test-strict', COMPLEX_DIAGRAM)
    expect(svg).toContain('<svg')
  })

  it('renders with loose mode', async () => {
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
    const { svg } = await mermaid.render('test-loose', COMPLEX_DIAGRAM)
    expect(svg).toContain('<svg')
  })
})
