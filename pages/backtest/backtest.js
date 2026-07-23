// pages/backtest/backtest.js
const app = getApp()
const { runBacktest, buildBacktestSummary } = require('../../utils/backtest')
const { DEFAULT_PYRAMID } = require('../../utils/strategy')
const stockService = require('../../services/stock')
const fundService = require('../../services/fund')

Page({
  data: {
    // 选择策略
    strategies: [],
    selectedStrategyId: null,
    selectedStrategy: null,

    // 回测配置
    targetType: 'stock',
    targetCode: '',
    period: '日K',
    periodOptions: ['日K', '周K', '月K'],
    periodIndex: 0,

    // 金字塔配置
    usePyramid: true,
    capital: 100000,
    stopLossRatio: 8,
    takeProfitRatio: 15,

    // 回测状态
    loading: false,
    result: null,
    summary: '',

    // 标的搜索
    searchKeyword: '',
    searchResults: [],
    showSearchResults: false
  },

  onLoad(options) {
    // 从策略页面跳转过来，带 strategyId
    if (options.strategyId) {
      this.setData({ selectedStrategyId: Number(options.strategyId) })
    }
    this.loadStrategies()
  },

  onShow() {
    this.loadStrategies()
  },

  loadStrategies() {
    const strategies = app.globalData.strategies || []
    this.setData({ strategies })

    if (this.data.selectedStrategyId) {
      this.selectStrategy(this.data.selectedStrategyId)
    }
  },

  // 选择策略
  onStrategyChange(e) {
    const id = Number(e.detail.value)
    this.selectStrategy(id)
  },

  selectStrategy(id) {
    const strategy = this.data.strategies.find(s => s.id === id)
    if (strategy) {
      this.setData({
        selectedStrategyId: id,
        selectedStrategy: strategy,
        targetType: strategy.targetType,
        targetCode: strategy.targetCode,
        usePyramid: strategy.pyramidEnabled,
        capital: strategy.capital || 100000
      })
    }
  },

  // 标的搜索
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    if (!keyword || keyword.length < 1) {
      this.setData({ searchResults: [], showSearchResults: false })
      return
    }
    this.setData({ showSearchResults: true })
    this.doSearch(keyword)
  },

  doSearch(keyword) {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(async () => {
      try {
        const results = this.data.targetType === 'stock'
          ? await stockService.searchStock(keyword)
          : await fundService.searchFund(keyword)
        this.setData({ searchResults: results || [] })
      } catch (err) {
        console.error('搜索失败', err)
        this.setData({ searchResults: [] })
      }
    }, 400)
  },

  onSearchResultTap(e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      targetCode: item.code,
      searchKeyword: item.name,
      showSearchResults: false
    })
  },

  onTargetTypeTap(e) {
    this.setData({ 
      targetType: e.currentTarget.dataset.value,
      targetCode: '',
      searchKeyword: '',
      searchResults: [],
      showSearchResults: false
    })
  },

  onTargetTypeChange(e) {
    this.setData({ 
      targetType: e.detail.value,
      targetCode: '',
      searchKeyword: '',
      searchResults: [],
      showSearchResults: false
    })
  },

  onPeriodTap(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.setData({
      periodIndex: idx,
      period: this.data.periodOptions[idx]
    })
  },

  onPeriodChange(e) {
    this.setData({
      periodIndex: e.detail.value,
      period: this.data.periodOptions[e.detail.value]
    })
  },

  onCapitalInput(e) {
    this.setData({ capital: Number(e.detail.value) || 100000 })
  },

  onPyramidToggle(e) {
    this.setData({ usePyramid: e.detail.value })
  },

  onStopLossChange(e) {
    this.setData({ stopLossRatio: Number(e.detail.value) || 8 })
  },

  onTakeProfitChange(e) {
    this.setData({ takeProfitRatio: Number(e.detail.value) || 15 })
  },

  // 执行回测
  async runBacktestTest() {
    const { targetType, targetCode, period, usePyramid, capital, stopLossRatio, takeProfitRatio, selectedStrategy } = this.data

    if (!targetCode) {
      wx.showToast({ title: '请输入标的代码', icon: 'none' })
      return
    }

    const conditions = selectedStrategy ? selectedStrategy.conditions : []
    if (!conditions || conditions.length === 0) {
      wx.showToast({ title: '策略无触发条件', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      // 拉取历史K线数据
      let detail
      if (targetType === 'stock') {
        detail = await stockService.getStockDetail(targetCode, period)
      } else {
        detail = await fundService.getFundDetail(targetCode, period)
      }

      if (!detail || !detail.kline || detail.kline.length < 70) {
        wx.showToast({ title: '历史数据不足', icon: 'none' })
        this.setData({ loading: false })
        return
      }

      // 构建金字塔配置
      const pyramidConfig = {
        ...DEFAULT_PYRAMID,
        totalCapital: capital,
        stopLossRatio: -stopLossRatio / 100,
        takeProfitRatio: takeProfitRatio / 100
      }

      // 执行回测
      const result = runBacktest({
        kline: detail.kline,
        conditions,
        pyramidConfig,
        usePyramid,
        capital,
        startIndex: 60
      })

      const summary = buildBacktestSummary(result)

      this.setData({
        result,
        summary,
        loading: false
      })

      wx.showToast({ title: '回测完成', icon: 'success' })
    } catch (err) {
      console.error('回测失败', err)
      wx.showToast({ title: '回测失败: ' + (err.message || '未知错误'), icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '投资助手 · 策略回测',
      path: '/pages/backtest/backtest'
    }
  },

  onShareTimeline() {
    return { title: '投资助手 · 策略回测' }
  }
})
