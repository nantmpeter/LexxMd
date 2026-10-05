import { describe, it, expect, beforeAll } from 'vitest'
import mermaid from 'mermaid'
import { renderKaTeX } from './mermaid-block'

const COMPLEX_DIAGRAM = `flowchart TD
    P["门户"]

    subgraph L2["行业业务组件"]
        direction LR
        L2A1["油船站数据可视化"]
        L2A2["科技治超数据可视化"]
        L2A3["货运源头数据可视化"]
        L2B1["视频巡逻"]
        L2B2["数据查询"]
        L2B3["实时预警"]
        L2C1["调查令违法管理"]
        L2C2["非现场执法"]
        L2C3["遮挡号牌研判"]
        L2D1["站点资源分布"]
        L2D2["超限实时报警"]
        L2D3["执法力量调度"]
        L2E1["超限率统计分析"]
        L2E2["超限频次分析"]
        L2E3["超限专题分析"]
    end

    subgraph L3["共性业务组件"]
        direction LR
        L3A1["业务资源检索"]
        L3A2["业务权限组件"]
        L3A3["业务资源管理"]
        L3A4["报警引擎组件"]
        L3A5["地图通用服务"]
        L3A6["业务字典组件"]
        L3A7["级联服务组件"]
        L3A8["移动服务后台"]
        L3A9["业务执行代理"]
        L3A10["应用配置"]
        L3A11["任务管理"]
        L3B1["视频应用"]
        L3B2["电视墙客户端"]
        L3B3["移动客户端"]
        L3B4["设备报警应用"]
        L3B5["视频客户端"]
        L3B6["地图应用"]
    end

    subgraph L4["通用服务组件"]
        direction LR
        L4A1["物联网共享组件"]
        L4A2["物联网网关"]
        L4A3["媒体网关"]
        L4A4["物联接入服务"]
        L4A5["设备接入框架"]
        L4A6["智能接入组件"]
        L4B1["云存储"]
        L4B2["CVR"]
        L4B3["ASW"]
        L4C1["播放组件"]
        L4C2["视频点播"]
        L4C3["电视墙组件"]
        L4C4["视频网管"]
        L4C5["消息推送"]
        L4C6["短信代理服务"]
        L4C7["接时服务"]
        L4C8["地图引擎"]
    end

    subgraph L5["基础服务组件"]
        direction LR
        L5A1["reportservice"]
        L5B1["jre"]
        L5C1["activemq"]
        L5D1["rabbitmq"]
        L5E1["redis"]
        L5F1["cluster"]
        L5G1["tomcat"]
        L5H1["consul"]
        L5I1["elasticsearch"]
        L5J1["logservice"]
        L5K1["postgresql"]
        L5L1["nodejs"]
    end

    L6["集成运行环境(核心服务)"]

    P --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
    L5 --> L6

    classDef portal fill:#f5f5f5,stroke:#333,color:#000
    classDef bizComp fill:#e3f2fd,stroke:#1976D2,color:#000
    classDef commonComp fill:#e8f5e9,stroke:#388E3C,color:#000
    classDef genSvc fill:#fff3e0,stroke:#F57C00,color:#000
    classDef baseSvc fill:#fce4ec,stroke:#C2185B,color:#000
    classDef runtime fill:#f5f5f5,stroke:#333,color:#000
    class P portal
    class L2 bizComp
    class L3 commonComp
    class L4 genSvc
    class L5 baseSvc
    class L6 runtime`

describe('mermaid rendering', () => {
  beforeAll(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    })
  })

  it('renders a simple flowchart', async () => {
    const { svg } = await mermaid.render('test-simple', 'flowchart TD\n  A-->B')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('renders the complex architecture diagram', async () => {
    const { svg } = await mermaid.render('test-complex', COMPLEX_DIAGRAM)
    expect(svg).toContain('<svg')
    expect(svg).toContain('门户')
    expect(svg).toContain('行业业务组件')
  })

  it('renders with Chinese characters', async () => {
    const { svg } = await mermaid.render('test-chinese', 'flowchart TD\n  A["中文测试"]-->B["你好世界"]')
    expect(svg).toContain('中文测试')
    expect(svg).toContain('你好世界')
  })

  it('renders subgraphs with direction', async () => {
    const diagram = `flowchart TD
    subgraph S1["Sub One"]
        direction LR
        A1["A"]
        B1["B"]
    end
    subgraph S2["Sub Two"]
        direction LR
        A2["C"]
        B2["D"]
    end
    S1 --> S2`
    const { svg } = await mermaid.render('test-subgraph', diagram)
    expect(svg).toContain('<svg')
    expect(svg).toContain('Sub One')
  })
})

describe('KaTeX trust hardening', () => {
  // The render result is either the HTML or a caught-error string; both must be
  // free of the dangerous payload, so assert against whichever we got.
  function renderedHtml(result: { html: string } | { error: string }): string {
    return 'html' in result ? result.html : result.error
  }

  it('renders normal math unchanged', () => {
    const result = renderKaTeX('\\frac{1}{2}', true)
    expect(result).toHaveProperty('html')
    expect('html' in result && result.html).toContain('katex')
  })

  // Note: assertions target actual XSS sinks (href/src attributes, injected
  // class tokens, anchor/img elements). The MathML <annotation> echoes the raw
  // TeX source verbatim, so the payload string does appear there as inert data
  // even when correctly untrusted — it must not be asserted against.
  it('does not produce a javascript: link from \\href', () => {
    const result = renderKaTeX('\\href{javascript:alert(1)}{x}', true)
    const html = renderedHtml(result)
    // An anchor without href is inert, and "<a" would false-positive on
    // "<annotation" — assert on the sink attribute itself (covers both the
    // HTML <a href> and the MathML <mi href> forms).
    expect(html).not.toContain('href=')
  })

  it('does not produce a remote img from \\includegraphics', () => {
    const result = renderKaTeX('\\includegraphics{https://evil.com/x.png}', true)
    const html = renderedHtml(result)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('src=')
  })

  it('does not inject class attribute from \\htmlClass', () => {
    const result = renderKaTeX('\\htmlClass{evil}{x}', true)
    const html = renderedHtml(result)
    // KaTeX merges the payload into the wrapper span's class list
    // (`class="enclosing evil"` when trusted); check rendered class tokens.
    const classTokens = [...html.matchAll(/class="([^"]*)"/g)]
      .flatMap(m => m[1].split(/\s+/))
    expect(classTokens).not.toContain('evil')
  })
})
