import { describe, it, expect, beforeAll } from 'vitest'
import mermaid from 'mermaid'

const FULL_DIAGRAM = `flowchart TD
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

describe('mermaid SVG output analysis', () => {
  beforeAll(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    })
  })

  it('analyzes full diagram SVG output', async () => {
    const { svg } = await mermaid.render('analyze-full', FULL_DIAGRAM)

    // Check basic SVG structure
    expect(svg).toContain('<svg')

    // Check viewBox
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/)
    expect(viewBoxMatch).toBeTruthy()
    const [, viewBox] = viewBoxMatch!
    const [, , w, h] = viewBox.split(/[\s,]+/).map(Number)
    console.log('ViewBox:', { w, h, ratio: h / w })

    // Check classDef fill colors applied
    console.log('Has fill:#f5f5f5 (portal):', svg.includes('fill:#f5f5f5') || svg.includes('fill:rgb(245,245,245)') || svg.includes('fill: #f5f5f5'))
    console.log('Has fill:#e3f2fd (bizComp):', svg.includes('fill:#e3f2fd') || svg.includes('fill:rgb(227,242,253)'))
    console.log('Has fill:#e8f5e9 (commonComp):', svg.includes('fill:#e8f5e9'))

    // Check Chinese characters
    console.log('Has 门户:', svg.includes('门户'))
    console.log('Has 行业业务组件:', svg.includes('行业业务组件'))

    // Check SVG dimensions
    const widthMatch = svg.match(/width="([^"]+)"/)
    const styleMatch = svg.match(/style="([^"]*max-width[^"]*)"/)
    console.log('Width attr:', widthMatch?.[1] ?? 'none')
    console.log('Style with max-width:', styleMatch?.[1] ?? 'none')

    // Check for error indicators
    console.log('Has error class:', svg.includes('error'))
    console.log('SVG length:', svg.length)
  })
})
