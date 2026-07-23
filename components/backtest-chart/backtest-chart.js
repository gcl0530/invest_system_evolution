// components/backtest-chart/backtest-chart.js
// 回测结果可视化组件：权益曲线 + 回撤曲线 + 买卖点标记

Component({
  properties: {
    // 回测结果对象
    result: {
      type: Object,
      value: null
    },
    // 宽度（rpx）
    chartWidth: {
      type: Number,
      value: 750
    },
    // 高度（rpx）
    chartHeight: {
      type: Number,
      value: 500
    }
  },

  data: {
    canvasWidth: 0,
    canvasHeight: 0,
    activeTab: 'equity', // equity | drawdown | trades
    tabs: [
      { label: '权益曲线', value: 'equity' },
      { label: '回撤曲线', value: 'drawdown' },
      { label: '交易记录', value: 'trades' }
    ]
  },

  lifetimes: {
    attached() {
      this.calcSize()
    }
  },

  observers: {
    'result': function (val) {
      if (val && val.equityCurve) {
        this.drawChart()
      }
    }
  },

  methods: {
    calcSize() {
      const sysInfo = wx.getWindowInfo()
      const width = sysInfo.windowWidth
      this.setData({
        canvasWidth: width,
        canvasHeight: Math.floor(width * 0.55)
      }, () => {
        if (this.data.result && this.data.result.equityCurve) {
          this.drawChart()
        }
      })
    },

    onTabChange(e) {
      const tab = e.currentTarget.dataset.value
      this.setData({ activeTab: tab }, () => {
        if (tab !== 'trades') {
          this.drawChart()
        }
      })
    },

    drawChart() {
      const { result, activeTab, canvasWidth, canvasHeight } = this.data
      if (!result || !result.equityCurve) return

      const query = this.createSelectorQuery()
      query.select('#backtestCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getWindowInfo().pixelRatio || 2
          canvas.width = canvasWidth * dpr
          canvas.height = canvasHeight * dpr
          ctx.scale(dpr, dpr)

          if (activeTab === 'equity') {
            this.drawEquityCurve(ctx, result, canvasWidth, canvasHeight)
          } else if (activeTab === 'drawdown') {
            this.drawDrawdownCurve(ctx, result, canvasWidth, canvasHeight)
          }
        })
    },

    drawEquityCurve(ctx, result, w, h) {
      const { equityCurve, capital, trades } = result
      if (!equityCurve || equityCurve.length === 0) return

      const padding = { top: 20, right: 16, bottom: 30, left: 60 }
      const chartW = w - padding.left - padding.right
      const chartH = h - padding.top - padding.bottom

      // 清空
      ctx.clearRect(0, 0, w, h)

      // 数据范围
      let minVal = capital
      let maxVal = capital
      for (const p of equityCurve) {
        if (p.equity < minVal) minVal = p.equity
        if (p.equity > maxVal) maxVal = p.equity
      }
      const range = maxVal - minVal || 1
      const padRange = range * 0.1
      minVal -= padRange
      maxVal += padRange

      const xStep = chartW / Math.max(equityCurve.length - 1, 1)
      const yScale = chartH / (maxVal - minVal)

      // 背景
      ctx.fillStyle = '#0f0f1e'
      ctx.fillRect(0, 0, w, h)

      // 网格线
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(padding.left + chartW, y)
        ctx.stroke()

        // Y轴标签
        const val = maxVal - (maxVal - minVal) * (i / 4)
        ctx.fillStyle = '#5a5a70'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(this.formatNum(val), padding.left - 8, y + 3)
      }

      // 基准线（初始资金）
      const baseY = padding.top + (maxVal - capital) * yScale
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(padding.left, baseY)
      ctx.lineTo(padding.left + chartW, baseY)
      ctx.stroke()
      ctx.setLineDash([])

      // 权益曲线
      ctx.strokeStyle = '#42a5f5'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < equityCurve.length; i++) {
        const x = padding.left + i * xStep
        const y = padding.top + (maxVal - equityCurve[i].equity) * yScale
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // 填充
      ctx.lineTo(padding.left + (equityCurve.length - 1) * xStep, padding.top + chartH)
      ctx.lineTo(padding.left, padding.top + chartH)
      ctx.closePath()
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH)
      gradient.addColorStop(0, 'rgba(66,165,245,0.25)')
      gradient.addColorStop(1, 'rgba(66,165,245,0)')
      ctx.fillStyle = gradient
      ctx.fill()

      // 买卖点标记
      if (trades && trades.length > 0) {
        // 建立 date -> index 映射
        const dateIndex = {}
        equityCurve.forEach((p, i) => { dateIndex[p.date] = i })

        for (const t of trades) {
          const idx = dateIndex[t.date]
          if (idx === undefined) continue
          const x = padding.left + idx * xStep
          const y = padding.top + (maxVal - equityCurve[idx].equity) * yScale

          if (t.type === 'buy') {
            ctx.fillStyle = '#ef5350'
            ctx.beginPath()
            ctx.arc(x, y, 3, 0, Math.PI * 2)
            ctx.fill()
          } else {
            ctx.fillStyle = '#26a69a'
            ctx.beginPath()
            ctx.arc(x, y, 3, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      // X轴标签（首尾日期）
      ctx.fillStyle = '#5a5a70'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(equityCurve[0].date, padding.left, h - 8)
      ctx.textAlign = 'right'
      ctx.fillText(equityCurve[equityCurve.length - 1].date, padding.left + chartW, h - 8)

      // 图例
      ctx.fillStyle = '#42a5f5'
      ctx.fillRect(padding.left, 4, 12, 2)
      ctx.fillStyle = '#8a8aa0'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('权益', padding.left + 16, 8)

      ctx.fillStyle = '#ef5350'
      ctx.beginPath()
      ctx.arc(padding.left + 60, 6, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#8a8aa0'
      ctx.fillText('买入', padding.left + 68, 8)

      ctx.fillStyle = '#26a69a'
      ctx.beginPath()
      ctx.arc(padding.left + 100, 6, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#8a8aa0'
      ctx.fillText('卖出', padding.left + 108, 8)
    },

    drawDrawdownCurve(ctx, result, w, h) {
      const { equityCurve } = result
      if (!equityCurve || equityCurve.length === 0) return

      const padding = { top: 20, right: 16, bottom: 30, left: 60 }
      const chartW = w - padding.left - padding.right
      const chartH = h - padding.top - padding.bottom

      ctx.clearRect(0, 0, w, h)

      const maxDD = Math.max(...equityCurve.map(p => p.drawdown || 0), 0.01)

      // 背景
      ctx.fillStyle = '#0f0f1e'
      ctx.fillRect(0, 0, w, h)

      // 网格
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(padding.left + chartW, y)
        ctx.stroke()

        const val = -maxDD * (i / 4) * 100
        ctx.fillStyle = '#5a5a70'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(val.toFixed(1) + '%', padding.left - 8, y + 3)
      }

      const xStep = chartW / Math.max(equityCurve.length - 1, 1)
      const yScale = chartH / maxDD

      // 回撤曲线（向下填充）
      ctx.strokeStyle = '#ef5350'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < equityCurve.length; i++) {
        const x = padding.left + i * xStep
        const y = padding.top + (equityCurve[i].drawdown || 0) * yScale
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // 填充
      ctx.lineTo(padding.left + (equityCurve.length - 1) * xStep, padding.top)
      ctx.lineTo(padding.left, padding.top)
      ctx.closePath()
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH)
      gradient.addColorStop(0, 'rgba(239,83,80,0)')
      gradient.addColorStop(1, 'rgba(239,83,80,0.3)')
      ctx.fillStyle = gradient
      ctx.fill()

      // X轴标签
      ctx.fillStyle = '#5a5a70'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(equityCurve[0].date, padding.left, h - 8)
      ctx.textAlign = 'right'
      ctx.fillText(equityCurve[equityCurve.length - 1].date, padding.left + chartW, h - 8)

      // 最大回撤标注
      const maxDDIdx = equityCurve.reduce((maxI, p, i, arr) => p.drawdown > arr[maxI].drawdown ? i : maxI, 0)
      const maxDDPoint = equityCurve[maxDDIdx]
      if (maxDDPoint) {
        const x = padding.left + maxDDIdx * xStep
        const y = padding.top + maxDDPoint.drawdown * yScale
        ctx.fillStyle = '#ef5350'
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`最大回撤: ${(maxDDPoint.drawdown * 100).toFixed(1)}%`, x, y + 16)
      }
    },

    formatNum(n) {
      if (n >= 100000) return (n / 10000).toFixed(1) + '万'
      if (n >= 10000) return (n / 10000).toFixed(2) + '万'
      return Math.round(n).toString()
    }
  }
})
