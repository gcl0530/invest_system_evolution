// pages/stock/stock.js
const app = getApp()
const stockService = require('../../services/stock')
const { formatPrice, formatPercent, formatVolume, formatAmount, getColor } = require('../../utils/format')

Page({
  data: {
    searchValue: '',
    showSearch: false,
    watchlist: [],
    searchResults: [],
    currentStock: null,
    stockDetail: null,
    period: '日K',
    loading: false
  },

  onLoad() {
    this.initWatchlist()
  },

  onShow() {
    this.initWatchlist()
    if (this.data.currentStock) {
      this.loadStockDetail(this.data.currentStock.code, this.data.period, this.data.currentStock.market)
    }
  },

  async initWatchlist() {
    let watchlist = app.globalData.watchlistStocks
    if (watchlist.length === 0) {
      watchlist = await stockService.getStockList()
    }
    // 真实数据模式下，批量刷新关注列表价格（传 {code, market} 支持港股/美股）
    const items = watchlist.map(s => ({ code: s.code, market: s.market }))
    const quotes = await stockService.getBatchQuotes(items)
    if (quotes.length > 0) {
      watchlist = watchlist.map(s => {
        const q = quotes.find(x => x.code === s.code)
        return q ? { ...s, ...q } : s
      })
    }
    this.setData({
      watchlist: watchlist.map(s => ({
        ...s,
        formattedChange: formatPercent(s.changePercent),
        formattedPrice: formatPrice(s.price),
        formattedVolume: formatVolume(s.volume),
        formattedAmount: formatAmount(s.amount),
        colorClass: getColor(s.changePercent)
      }))
    })
  },

  async onSearchInput(e) {
    const value = e.detail.value
    this.setData({ searchValue: value })
    if (value.trim()) {
      const results = await stockService.searchStock(value)
      this.setData({ searchResults: results })
    } else {
      this.setData({ searchResults: [] })
    }
  },

  toggleSearch() {
    this.setData({ showSearch: !this.data.showSearch, searchValue: '', searchResults: [] })
  },

  addToWatchlist(e) {
    const { code, market } = e.currentTarget.dataset
    const stock = this.data.searchResults.find(s => s.code === code)
    if (stock) {
      const watchlist = app.globalData.watchlistStocks
      if (!watchlist.find(s => s.code === code)) {
        // 存储时带 market（港股/美股点进去要走对应市场接口）
        watchlist.push({ ...stock, market: stock.market || market })
        app.saveWatchlist()
        wx.showToast({ title: '已添加关注', icon: 'success' })
        this.setData({ showSearch: false, searchValue: '', searchResults: [] })
        this.initWatchlist()
      } else {
        wx.showToast({ title: '已存在关注列表', icon: 'none' })
      }
    }
  },

  removeFromWatchlist(e) {
    const { code } = e.currentTarget.dataset
    const watchlist = app.globalData.watchlistStocks
    const stock = watchlist.find(s => s.code === code)
    if (!stock) {
      wx.showToast({ title: '未找到该股票', icon: 'none' })
      return
    }
    wx.showModal({
      title: '取消关注',
      content: `确定取消关注 ${stock.name || stock.code}？`,
      success: (res) => {
        if (res.confirm) {
          const idx = watchlist.findIndex(s => s.code === code)
          if (idx >= 0) {
            watchlist.splice(idx, 1)
            app.saveWatchlist()
            this.initWatchlist()
            // 如果详情页显示的就是这只，关掉详情页
            if (this.data.currentStock && this.data.currentStock.code === code) {
              this.setData({ currentStock: null, stockDetail: null })
            }
            wx.showToast({ title: '已移除关注', icon: 'success' })
          }
        }
      }
    })
  },

  selectStock(e) {
    const { code, market } = e.currentTarget.dataset
    this.setData({ showSearch: false, searchValue: '', searchResults: [] })
    this.loadStockDetail(code, this.data.period, market)
  },

  async loadStockDetail(code, period, market) {
    this.setData({ loading: true })
    wx.showLoading({ title: '加载中...' })
    try {
      const detail = await stockService.getStockDetail(code, period, market)
      if (detail) {
        this.setData({
          currentStock: detail,
          stockDetail: detail
        })
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
    wx.hideLoading()
    this.setData({ loading: false })
  },

  closeDetail() {
    this.setData({ currentStock: null, stockDetail: null })
  },

  onPeriodChange(e) {
    const val = e.detail.value || e.currentTarget.dataset.value
    this.setData({ period: val })
    if (this.data.currentStock) {
      this.loadStockDetail(this.data.currentStock.code, val, this.data.currentStock.market)
    }
  },

  onShareAppMessage() {
    return {
      title: '投资助手 · 股票关注',
      path: '/pages/stock/stock'
    }
  },

  onShareTimeline() {
    return { title: '投资助手 · 股票关注' }
  }
})
