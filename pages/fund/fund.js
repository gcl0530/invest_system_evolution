// pages/fund/fund.js
const app = getApp()
const fundService = require('../../services/fund')
const { formatPrice, formatPercent, getColor, getTagClass } = require('../../utils/format')

Page({
  data: {
    // 搜索
    searchValue: '',
    showSearch: false,

    // 关注列表
    watchlist: [],
    searchResults: [],

    // 详情
    currentFund: null,
    fundDetail: null,

    // 指标显示控制
    activeTab: 'kline',
    period: '日K',
    loading: false,
  },

  // 格式化函数（不放入 data，避免序列化问题）
  _format: { formatPrice, formatPercent, getColor, getTagClass },

  onLoad() {
    this.initWatchlist()
  },

  onShow() {
    // 刷新关注列表
    this.initWatchlist()
    // 如果有选中基金，刷新详情
    if (this.data.currentFund) {
      this.loadFundDetail(this.data.currentFund.code)
    }
  },

  // 初始化关注列表
  async initWatchlist() {
    let watchlist = app.globalData.watchlistFunds
    if (watchlist.length === 0) {
      // 首次进入，用 service 拉默认列表（mock 模式返回 mockFunds）
      watchlist = await fundService.getFundList()
    }
    this.setData({
      watchlist: watchlist.map(f => ({
        ...f,
        formattedChange: formatPercent(f.dayChange),
        formattedNav: formatPrice(f.netValue, 4),
        colorClass: getColor(f.dayChange)
      }))
    })
  },

  // 搜索基金
  async onSearchInput(e) {
    const value = e.detail.value
    this.setData({ searchValue: value })
    if (value.trim()) {
      const results = await fundService.searchFund(value)
      this.setData({ searchResults: results })
    } else {
      this.setData({ searchResults: [] })
    }
  },

  // 切换搜索显示
  toggleSearch() {
    this.setData({ showSearch: !this.data.showSearch, searchValue: '', searchResults: [] })
  },

  // 添加关注
  addToWatchlist(e) {
    const { code } = e.currentTarget.dataset
    const fund = this.data.searchResults.find(f => f.code === code)
    if (fund) {
      const watchlist = app.globalData.watchlistFunds
      if (!watchlist.find(f => f.code === code)) {
        watchlist.push(fund)
        app.saveWatchlist()
        wx.showToast({ title: '已添加关注', icon: 'success' })
        this.setData({ showSearch: false, searchValue: '', searchResults: [] })
        this.initWatchlist()
      } else {
        wx.showToast({ title: '已存在关注列表', icon: 'none' })
      }
    }
  },

  // 移除关注
  removeFromWatchlist(e) {
    const { code } = e.currentTarget.dataset
    const watchlist = app.globalData.watchlistFunds
    const idx = watchlist.findIndex(f => f.code === code)
    if (idx >= 0) {
      watchlist.splice(idx, 1)
      app.saveWatchlist()
      this.initWatchlist()
      wx.showToast({ title: '已移除关注', icon: 'success' })
    }
  },

  // 选中基金查看详情
  selectFund(e) {
    const { code } = e.currentTarget.dataset
    this.loadFundDetail(code)
  },

  // 加载基金详情
  async loadFundDetail(code) {
    this.setData({ loading: true })
    wx.showLoading({ title: '加载中...' })
    try {
      const detail = await fundService.getFundDetail(code)
      if (detail) {
        this.setData({
          currentFund: detail,
          fundDetail: detail
        })
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
    wx.hideLoading()
    this.setData({ loading: false })
  },

  // 关闭详情
  closeDetail() {
    this.setData({ currentFund: null, fundDetail: null })
  },

  // 切换 Tab
  onTabChange(e) {
    this.setData({ activeTab: e.detail.value })
  },

  // 切换周期
  onPeriodChange(e) {
    this.setData({ period: e.detail.value })
    if (this.data.currentFund) {
      this.loadFundDetail(this.data.currentFund.code)
    }
  }
})
