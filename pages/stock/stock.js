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
      this.loadStockDetail(this.data.currentStock.code)
    }
  },

  async initWatchlist() {
    let watchlist = app.globalData.watchlistStocks
    if (watchlist.length === 0) {
      watchlist = await stockService.getStockList()
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
    const { code } = e.currentTarget.dataset
    const stock = this.data.searchResults.find(s => s.code === code)
    if (stock) {
      const watchlist = app.globalData.watchlistStocks
      if (!watchlist.find(s => s.code === code)) {
        watchlist.push(stock)
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
    const idx = watchlist.findIndex(s => s.code === code)
    if (idx >= 0) {
      watchlist.splice(idx, 1)
      app.saveWatchlist()
      this.initWatchlist()
      wx.showToast({ title: '已移除关注', icon: 'success' })
    }
  },

  selectStock(e) {
    const { code } = e.currentTarget.dataset
    this.loadStockDetail(code)
  },

  async loadStockDetail(code) {
    this.setData({ loading: true })
    wx.showLoading({ title: '加载中...' })
    try {
      const detail = await stockService.getStockDetail(code)
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
    this.setData({ period: e.detail.value || e.currentTarget.dataset.value })
    if (this.data.currentStock) {
      this.loadStockDetail(this.data.currentStock.code)
    }
  }
})
