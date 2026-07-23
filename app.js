// app.js - 投资助手小程序
App({
  globalData: {
    // 用户配置
    userInfo: null,
    
    // 关注列表
    watchlistFunds: [],
    watchlistStocks: [],
    
    // 策略列表
    strategies: [],
    
    // 投资体系
    philosophy: null,
    
    // API 基础地址（实际部署时替换）
    apiBaseUrl: 'https://your-api-domain.com/api/v1',
    
    // 指标周期配置
    periods: ['日K', '周K', '月K'],
    defaultPeriod: '日K',
    
    // 均线配置
    maConfigs: [
      { name: 'MA5', color: '#ffa726', period: 5 },
      { name: 'MA10', color: '#42a5f5', period: 10 },
      { name: 'MA20', color: '#66bb6a', period: 20 },
      { name: 'MA60', color: '#ab47bc', period: 60 }
    ],
    
    // 布林带配置
    bollConfig: {
      period: 20,
      multiplier: 2,
      upperColor: '#ef5350',
      midColor: '#78909c',
      lowerColor: '#26a69a'
    },
    
    // MACD 配置
    macdConfig: {
      fast: 12,
      slow: 26,
      signal: 9,
      difColor: '#42a5f5',
      deaColor: '#ffa726',
      histogramUp: '#ef5350',
      histogramDown: '#26a69a'
    }
  },

  onLaunch() {
    // 云开发初始化（任一分类开关开启时初始化）
    const { USE_CLOUD, STOCK_USE_CLOUD, FUND_USE_CLOUD, CLOUD_ENV_ID } = require('./utils/config')
    if ((USE_CLOUD || STOCK_USE_CLOUD || FUND_USE_CLOUD) && wx.cloud) {
      try {
        wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true })
      } catch (e) {
        console.warn('云开发初始化失败:', e)
      }
    }

    // 全局错误监听（接入监控后填充上报逻辑）
    wx.onError && wx.onError((err) => {
      console.error('[全局JS错误]', err)
    })
    wx.onUnhandledRejection && wx.onUnhandledRejection((res) => {
      console.error('[未处理的Promise]', res)
    })

    // 加载本地缓存的关注列表
    this.loadWatchlist()
    this.loadStrategies()
    this.loadPhilosophy()
  },

  // 加载关注列表
  loadWatchlist() {
    try {
      const funds = wx.getStorageSync('watchlist_funds')
      const stocks = wx.getStorageSync('watchlist_stocks')
      if (funds) this.globalData.watchlistFunds = funds
      if (stocks) this.globalData.watchlistStocks = stocks
    } catch (e) {
      console.error('加载关注列表失败:', e)
    }
  },

  // 保存关注列表
  saveWatchlist() {
    try {
      wx.setStorageSync('watchlist_funds', this.globalData.watchlistFunds)
      wx.setStorageSync('watchlist_stocks', this.globalData.watchlistStocks)
    } catch (e) {
      console.error('保存关注列表失败:', e)
    }
  },

  // 加载策略
  loadStrategies() {
    try {
      const strategies = wx.getStorageSync('strategies')
      if (strategies) this.globalData.strategies = strategies
    } catch (e) {
      console.error('加载策略失败:', e)
    }
  },

  // 保存策略
  saveStrategies() {
    try {
      wx.setStorageSync('strategies', this.globalData.strategies)
    } catch (e) {
      console.error('保存策略失败:', e)
    }
  },

  // 加载投资体系
  loadPhilosophy() {
    try {
      const philosophy = wx.getStorageSync('philosophy')
      if (philosophy) this.globalData.philosophy = philosophy
    } catch (e) {
      console.error('加载投资体系失败:', e)
    }
  },

  // 保存投资体系
  savePhilosophy() {
    try {
      wx.setStorageSync('philosophy', this.globalData.philosophy)
    } catch (e) {
      console.error('保存投资体系失败:', e)
    }
  }
})
