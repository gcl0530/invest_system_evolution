// components/kline-chart/kline-chart.js
Component({
  properties: {
    // K 线数据
    klineData: {
      type: Array,
      value: []
    },
    // 指标数据
    indicators: {
      type: Object,
      value: {}
    },
    // 显示哪些指标
    showMA: { type: Boolean, value: true },
    showBOLL: { type: Boolean, value: false },
    showMACD: { type: Boolean, value: true },
    showVolume: { type: Boolean, value: true },
    showRSI: { type: Boolean, value: false },
    // 宽度（rpx 转 px）
    canvasWidth: { type: Number, value: 375 },
    // 颜色配置
    colors: {
      type: Object,
      value: {
        bg: '#0f0f1e',
        up: '#ef5350',
        down: '#26a69a',
        ma5: '#ffa726',
        ma10: '#42a5f5',
        ma20: '#66bb6a',
        ma60: '#ab47bc',
        bollUpper: '#ef5350',
        bollMid: '#78909c',
        bollLower: '#26a69a',
        macdDif: '#42a5f5',
        macdDea: '#ffa726',
        macdUp: '#ef5350',
        macdDown: '#26a69a',
        volumeUp: 'rgba(239, 83, 80, 0.6)',
        volumeDown: 'rgba(38, 166, 154, 0.6)',
        grid: 'rgba(255, 255, 255, 0.05)',
        text: '#5a5a70'
      }
    }
  },

  data: {
    canvasId: 'kline_' + Math.random().toString(36).substr(2, 9),
    visibleCount: 30,  // 可见 K 线数
    startIndex: 0,     // 起始索引
    touchStartX: 0,
    touchStartIndex: 0,
    crosshairX: -1,
    crosshairY: -1,
    showCrosshair: false
  },

  lifetimes: {
    attached() {
      // 延迟绘制，等待布局完成
      setTimeout(() => this.draw(), 100)
    }
  },

  observers: {
    'klineData, indicators, showMA, showBOLL, showMACD, showVolume, showRSI'() {
      // 防抖：合并短时间内的多次 properties 变化，避免频繁重绘
      if (this._drawTimer) clearTimeout(this._drawTimer)
      this._drawTimer = setTimeout(() => this.draw(), 50)
    }
  },

  methods: {
    // 获取 canvas 上下文
    getCtx() {
      const query = this.createSelectorQuery()
      return new Promise(resolve => {
        query.select('#' + this.data.canvasId)
          .fields({ node: true, size: true })
          .exec(res => {
            if (res[0]) {
              const canvas = res[0].node
              const ctx = canvas.getContext('2d')
              // 缓存 dpr，避免每次 draw 都调同步 API（wx.getSystemInfoSync 已不推荐）
              if (!this._dpr) {
                const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
                this._dpr = info.pixelRatio
              }
              const dpr = this._dpr
              canvas.width = res[0].width * dpr
              canvas.height = res[0].height * dpr
              ctx.scale(dpr, dpr)
              resolve({ ctx, width: res[0].width, height: res[0].height })
            } else {
              resolve(null)
            }
          })
      })
    },

    // 主绘制函数
    async draw() {
      const { klineData, indicators, colors } = this.properties
      if (!klineData || klineData.length === 0) return

      const canvasInfo = await this.getCtx()
      if (!canvasInfo) return
      const { ctx, width, height } = canvasInfo

      // 清空画布
      ctx.fillStyle = colors.bg
      ctx.fillRect(0, 0, width, height)

      const data = klineData
      const total = data.length
      const visible = Math.min(this.data.visibleCount, total)
      const start = Math.max(0, total - visible)
      const end = total

      const visibleData = data.slice(start, end)

      // 计算价格范围
      let minPrice = Infinity
      let maxPrice = -Infinity
      visibleData.forEach(d => {
        if (d.low < minPrice) minPrice = d.low
        if (d.high > maxPrice) maxPrice = d.high
      })

      // 布林带范围
      if (this.properties.showBOLL && indicators.boll) {
        for (let i = start; i < end; i++) {
          if (indicators.boll.upper && indicators.boll.upper[i] != null) {
            if (indicators.boll.upper[i] > maxPrice) maxPrice = indicators.boll.upper[i]
            if (indicators.boll.lower && indicators.boll.lower[i] != null) {
              if (indicators.boll.lower[i] < minPrice) minPrice = indicators.boll.lower[i]
            }
          }
        }
      }

      const priceRange = maxPrice - minPrice || 1
      const padding = { top: 20, right: 50, bottom: 20, left: 10 }
      const chartWidth = width - padding.left - padding.right
      
      // 区域分配
      const volumeHeight = this.properties.showVolume ? 50 : 0
      const macdHeight = this.properties.showMACD ? 60 : 0
      const rsiHeight = this.properties.showRSI ? 40 : 0
      const klineHeight = height - volumeHeight - macdHeight - rsiHeight - 30

      // 各区域 y 起始
      const klineY = padding.top
      const volumeY = klineY + klineHeight + 10
      const macdY = volumeY + volumeHeight + 10
      const rsiY = macdY + macdHeight + 10

      // 绘制网格和坐标
      this.drawGrid(ctx, padding, klineY, klineHeight, chartWidth, minPrice, maxPrice, colors)
      
      // 绘制 K 线
      this.drawKLine(ctx, visibleData, indicators, start, padding, klineY, klineHeight, chartWidth, minPrice, maxPrice, colors)
      
      // 绘制均线
      if (this.properties.showMA) {
        this.drawMA(ctx, indicators, start, end, padding, klineY, klineHeight, chartWidth, minPrice, maxPrice, colors)
      }
      
      // 绘制布林带
      if (this.properties.showBOLL && indicators.boll) {
        this.drawBOLL(ctx, indicators.boll, start, end, padding, klineY, klineHeight, chartWidth, minPrice, maxPrice, colors)
      }
      
      // 绘制成交量
      if (this.properties.showVolume) {
        this.drawVolume(ctx, visibleData, padding, volumeY, volumeHeight, chartWidth, colors)
      }
      
      // 绘制 MACD
      if (this.properties.showMACD && indicators.macd) {
        this.drawMACD(ctx, indicators.macd, start, end, padding, macdY, macdHeight, chartWidth, colors)
      }
      
      // 绘制 RSI
      if (this.properties.showRSI && indicators.rsi) {
        this.drawRSI(ctx, indicators.rsi, start, end, padding, rsiY, rsiHeight, chartWidth, colors)
      }
      
      // 绘制十字光标
      if (this.data.showCrosshair && this.data.crosshairX >= 0) {
        this.drawCrosshair(ctx, width, height, padding, colors)
      }
    },

    // 网格
    drawGrid(ctx, padding, y, h, w, minP, maxP, colors) {
      ctx.strokeStyle = colors.grid
      ctx.lineWidth = 0.5
      ctx.fillStyle = colors.text
      ctx.font = '10px sans-serif'
      
      const lines = 4
      for (let i = 0; i <= lines; i++) {
        const gy = y + (h / lines) * i
        ctx.beginPath()
        ctx.moveTo(padding.left, gy)
        ctx.lineTo(padding.left + w, gy)
        ctx.stroke()
        
        const price = maxP - (price => price)((maxP - minP) / lines * i)
        const priceVal = maxP - (maxP - minP) / lines * i
        ctx.fillText(priceVal.toFixed(2), padding.left + w + 5, gy + 4)
      }
    },

    // K 线
    drawKLine(ctx, data, indicators, startOffset, padding, baseY, h, w, minP, maxP, colors) {
      const n = data.length
      const candleWidth = w / n * 0.7
      const gap = w / n * 0.3
      const range = maxP - minP || 1

      data.forEach((d, i) => {
        const x = padding.left + (w / n) * (i + 0.5)
        const openY = baseY + h - ((d.open - minP) / range) * h
        const closeY = baseY + h - ((d.close - minP) / range) * h
        const highY = baseY + h - ((d.high - minP) / range) * h
        const lowY = baseY + h - ((d.low - minP) / range) * h

        const isUp = d.close >= d.open
        const color = isUp ? colors.up : colors.down

        // 影线
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, highY)
        ctx.lineTo(x, lowY)
        ctx.stroke()

        // 实体
        const bodyTop = Math.min(openY, closeY)
        const bodyHeight = Math.abs(closeY - openY) || 1
        ctx.fillStyle = color
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight)
      })
    },

    // 均线
    drawMA(ctx, indicators, start, end, padding, baseY, h, w, minP, maxP, colors) {
      const range = maxP - minP || 1
      const n = end - start
      const mas = [
        { data: indicators.ma5, color: colors.ma5, label: 'MA5' },
        { data: indicators.ma10, color: colors.ma10, label: 'MA10' },
        { data: indicators.ma20, color: colors.ma20, label: 'MA20' },
        { data: indicators.ma60, color: colors.ma60, label: 'MA60' }
      ]
      
      mas.forEach(ma => {
        if (!ma.data) return
        ctx.strokeStyle = ma.color
        ctx.lineWidth = 1
        ctx.beginPath()
        let started = false
        for (let i = start; i < end; i++) {
          if (ma.data[i] == null) continue
          const x = padding.left + (w / n) * (i - start + 0.5)
          const y = baseY + h - ((ma.data[i] - minP) / range) * h
          if (!started) {
            ctx.moveTo(x, y)
            started = true
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
      })
    },

    // 布林带
    drawBOLL(ctx, boll, start, end, padding, baseY, h, w, minP, maxP, colors) {
      const range = maxP - minP || 1
      const n = end - start
      const bands = [
        { data: boll.upper, color: colors.bollUpper },
        { data: boll.mid, color: colors.bollMid },
        { data: boll.lower, color: colors.bollLower }
      ]
      bands.forEach(band => {
        if (!band.data) return
        ctx.strokeStyle = band.color
        ctx.lineWidth = 1
        ctx.beginPath()
        let started = false
        for (let i = start; i < end; i++) {
          if (band.data[i] == null) continue
          const x = padding.left + (w / n) * (i - start + 0.5)
          const y = baseY + h - ((band.data[i] - minP) / range) * h
          if (!started) { ctx.moveTo(x, y); started = true }
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      })
    },

    // 成交量
    drawVolume(ctx, data, padding, baseY, h, w, colors) {
      const n = data.length
      let maxVol = 0
      data.forEach(d => { if (d.volume > maxVol) maxVol = d.volume })
      
      const barWidth = w / n * 0.7
      data.forEach((d, i) => {
        const x = padding.left + (w / n) * (i + 0.5)
        const barH = (d.volume / maxVol) * h
        const isUp = d.close >= d.open
        ctx.fillStyle = isUp ? colors.volumeUp : colors.volumeDown
        ctx.fillRect(x - barWidth / 2, baseY + h - barH, barWidth, barH)
      })
      
      // 标签
      ctx.fillStyle = colors.text
      ctx.font = '10px sans-serif'
      ctx.fillText('VOL', padding.left, baseY - 4)
    },

    // MACD
    drawMACD(ctx, macd, start, end, padding, baseY, h, colors) {
      const w = this.data.canvasWidth - padding.left - padding.right
      const n = end - start
      
      let maxVal = 0
      for (let i = start; i < end; i++) {
        if (macd.histogram && macd.histogram[i] != null) {
          if (Math.abs(macd.histogram[i]) > maxVal) maxVal = Math.abs(macd.histogram[i])
        }
        if (macd.dif && macd.dif[i] != null) {
          if (Math.abs(macd.dif[i]) > maxVal) maxVal = Math.abs(macd.dif[i])
        }
        if (macd.dea && macd.dea[i] != null) {
          if (Math.abs(macd.dea[i]) > maxVal) maxVal = Math.abs(macd.dea[i])
        }
      }
      maxVal = maxVal || 1
      
      const zeroY = baseY + h / 2
      
      // 零轴
      ctx.strokeStyle = colors.grid
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(padding.left, zeroY)
      ctx.lineTo(padding.left + w, zeroY)
      ctx.stroke()
      
      // 柱状图
      const barWidth = w / n * 0.6
      for (let i = start; i < end; i++) {
        if (macd.histogram == null || macd.histogram[i] == null) continue
        const idx = i - start
        const x = padding.left + (w / n) * (idx + 0.5)
        const barH = (Math.abs(macd.histogram[i]) / maxVal) * (h / 2)
        ctx.fillStyle = macd.histogram[i] >= 0 ? colors.macdUp : colors.macdDown
        if (macd.histogram[i] >= 0) {
          ctx.fillRect(x - barWidth / 2, zeroY - barH, barWidth, barH)
        } else {
          ctx.fillRect(x - barWidth / 2, zeroY, barWidth, barH)
        }
      }
      
      // DIF 线
      ctx.strokeStyle = colors.macdDif
      ctx.lineWidth = 1
      ctx.beginPath()
      let started = false
      for (let i = start; i < end; i++) {
        if (macd.dif == null || macd.dif[i] == null) continue
        const idx = i - start
        const x = padding.left + (w / n) * (idx + 0.5)
        const y = zeroY - (macd.dif[i] / maxVal) * (h / 2)
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      
      // DEA 线
      ctx.strokeStyle = colors.macdDea
      ctx.lineWidth = 1
      ctx.beginPath()
      started = false
      for (let i = start; i < end; i++) {
        if (macd.dea == null || macd.dea[i] == null) continue
        const idx = i - start
        const x = padding.left + (w / n) * (idx + 0.5)
        const y = zeroY - (macd.dea[i] / maxVal) * (h / 2)
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      
      // 标签
      ctx.fillStyle = colors.text
      ctx.font = '10px sans-serif'
      ctx.fillText('MACD', padding.left, baseY - 4)
    },

    // RSI
    drawRSI(ctx, rsi, start, end, padding, baseY, h, w, colors) {
      const n = end - start
      
      ctx.strokeStyle = colors.grid
      ctx.lineWidth = 0.5
      // 70 线
      const y70 = baseY + h * 0.3
      const y30 = baseY + h * 0.7
      ctx.beginPath()
      ctx.moveTo(padding.left, y70)
      ctx.lineTo(padding.left + w, y70)
      ctx.moveTo(padding.left, y30)
      ctx.lineTo(padding.left + w, y30)
      ctx.stroke()
      
      if (!rsi) return
      ctx.strokeStyle = '#ab47bc'
      ctx.lineWidth = 1
      ctx.beginPath()
      let started = false
      for (let i = start; i < end; i++) {
        if (rsi[i] == null) continue
        const idx = i - start
        const x = padding.left + (w / n) * (idx + 0.5)
        const y = baseY + h - (rsi[i] / 100) * h
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      
      ctx.fillStyle = colors.text
      ctx.font = '10px sans-serif'
      ctx.fillText('RSI', padding.left, baseY - 4)
    },

    // 十字光标
    drawCrosshair(ctx, width, height, padding, colors) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(this.data.crosshairX, 0)
      ctx.lineTo(this.data.crosshairX, height)
      ctx.stroke()
      ctx.setLineDash([])
    },

    // 触摸事件
    onTouchStart(e) {
      this.setData({
        touchStartX: e.touches[0].clientX,
        touchStartIndex: this.data.startIndex
      })
    },

    onTouchMove(e) {
      const dx = e.touches[0].clientX - this.data.touchStartX
      const candleWidth = 10 // 估算
      const indexShift = Math.round(-dx / candleWidth)
      let newStart = this.data.touchStartIndex + indexShift
      const maxStart = Math.max(0, this.properties.klineData.length - this.data.visibleCount)
      newStart = Math.max(0, Math.min(maxStart, newStart))
      if (newStart !== this.data.startIndex) {
        this.setData({ startIndex: newStart })
        this.draw()
      }
    },

    onTouchEnd() {
      // 保持位置
    },

    // 切换指标显示
    toggleMA() {
      this.setData({ showMA: !this.data.showMA })
      this.draw()
    },
    toggleBOLL() {
      this.setData({ showBOLL: !this.data.showBOLL })
      this.draw()
    },
    toggleMACD() {
      this.setData({ showMACD: !this.data.showMACD })
      this.draw()
    },
    toggleVolume() {
      this.setData({ showVolume: !this.data.showVolume })
      this.draw()
    },
    toggleRSI() {
      this.setData({ showRSI: !this.data.showRSI })
      this.draw()
    }
  }
})
