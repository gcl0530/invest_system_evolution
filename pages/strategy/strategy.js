// pages/strategy/strategy.js
const app = getApp()
const { calcPyramidPlan, checkStrategyTrigger, buildAlertMessage, DEFAULT_PYRAMID } = require('../../utils/strategy')
const { formatPrice } = require('../../utils/format')

Page({
  data: {
    // Tab 切换
    activeTab: 'list',  // list | create | pyramid
    
    // 策略列表
    strategies: [],
    
    // 当前编辑策略
    editingStrategy: null,
    
    // 金字塔配置
    pyramidConfig: { ...DEFAULT_PYRAMID },
    pyramidPlan: null,
    
    // 表单数据
    formData: {
      name: '',
      targetCode: '',
      targetType: 'stock',  // stock | fund
      conditions: [],
      pyramidEnabled: true,
      capital: 100000
    },
    
    // 条件类型
    conditionTypes: [
      { label: '均线交叉', value: 'price_cross_ma' },
      { label: 'MACD金叉/死叉', value: 'macd_cross' },
      { label: '布林带突破', value: 'boll_breakout' },
      { label: 'RSI超买超卖', value: 'rsi_over' },
      { label: '放量', value: 'volume_surge' },
      { label: '目标价格', value: 'price_target' }
    ],
    
    // 提醒记录
    alerts: []
  },

  onLoad() {
    this.loadStrategies()
    this.calcPyramid()
  },

  onShow() {
    this.loadStrategies()
  },

  // 加载策略列表
  loadStrategies() {
    const strategies = app.globalData.strategies || []
    this.setData({
      strategies: strategies.map(s => ({
        ...s,
        formattedCapital: formatPrice(s.capital, 0)
      }))
    })
  },

  // Tab 切换
  onTabChange(e) {
    const tab = e.detail.value || e.currentTarget.dataset.value
    this.setData({ activeTab: tab })
    if (tab === 'pyramid') {
      this.calcPyramid()
    }
  },

  // ===== 策略创建 =====
  
  onNameInput(e) {
    this.setData({ 'formData.name': e.detail.value })
  },

  onCodeInput(e) {
    this.setData({ 'formData.targetCode': e.detail.value })
  },

  onTypeChange(e) {
    this.setData({ 'formData.targetType': e.detail.value })
  },

  onCapitalInput(e) {
    const val = Number(e.detail.value) || 0
    this.setData({ 
      'formData.capital': val,
      'pyramidConfig.totalCapital': val
    })
    this.calcPyramid()
  },

  onPyramidToggle(e) {
    this.setData({ 'formData.pyramidEnabled': e.detail.value })
  },

  // 添加条件
  onConditionTypeChange(e) {
    const idx = e.detail.value
    const condType = this.data.conditionTypes[idx].value
    const newCondition = {
      id: Date.now(),
      type: condType,
      direction: 'up',
      action: 'notify',
      ma: 'MA20',
      threshold: 70,
      volumeRatio: 2,
      targetPrice: 0,
      pyramidLayer: null
    }
    this.setData({
      'formData.conditions': [...this.data.formData.conditions, newCondition]
    })
  },

  // 删除条件
  removeCondition(e) {
    const { id } = e.currentTarget.dataset
    const conditions = this.data.formData.conditions.filter(c => c.id !== id)
    this.setData({ 'formData.conditions': conditions })
  },

  // 条件方向切换
  onConditionDirectionChange(e) {
    const { id } = e.currentTarget.dataset
    const conditions = this.data.formData.conditions.map(c => {
      if (c.id === id) return { ...c, direction: e.detail.value }
      return c
    })
    this.setData({ 'formData.conditions': conditions })
  },

  // 条件操作切换
  onConditionActionChange(e) {
    const { id } = e.currentTarget.dataset
    const conditions = this.data.formData.conditions.map(c => {
      if (c.id === id) return { ...c, action: e.detail.value }
      return c
    })
    this.setData({ 'formData.conditions': conditions })
  },

  // 保存策略
  saveStrategy() {
    const { name, targetCode, targetType, conditions, pyramidEnabled, capital } = this.data.formData
    
    if (!name.trim()) {
      wx.showToast({ title: '请输入策略名称', icon: 'none' })
      return
    }
    if (!targetCode.trim()) {
      wx.showToast({ title: '请输入标的代码', icon: 'none' })
      return
    }
    if (conditions.length === 0) {
      wx.showToast({ title: '请至少添加一个条件', icon: 'none' })
      return
    }

    const strategy = {
      id: Date.now(),
      name,
      targetCode,
      targetType,
      conditions,
      pyramidEnabled,
      capital,
      createdAt: new Date().toISOString(),
      enabled: true
    }

    const strategies = app.globalData.strategies
    strategies.push(strategy)
    app.saveStrategies()

    // 重置表单
    this.setData({
      formData: {
        name: '',
        targetCode: '',
        targetType: 'stock',
        conditions: [],
        pyramidEnabled: true,
        capital: 100000
      },
      activeTab: 'list'
    })

    this.loadStrategies()
    wx.showToast({ title: '策略创建成功', icon: 'success' })
  },

  // 切换策略启用状态
  toggleStrategy(e) {
    const { id } = e.currentTarget.dataset
    const strategies = app.globalData.strategies.map(s => {
      if (s.id === id) return { ...s, enabled: !s.enabled }
      return s
    })
    app.globalData.strategies = strategies
    app.saveStrategies()
    this.loadStrategies()
  },

  // 删除策略
  deleteStrategy(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个策略吗？',
      success: res => {
        if (res.confirm) {
          const strategies = app.globalData.strategies.filter(s => s.id !== id)
          app.globalData.strategies = strategies
          app.saveStrategies()
          this.loadStrategies()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  // 跳转回测
  onBacktest(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: '/pages/backtest/backtest?strategyId=' + id
    })
  },

  // 模拟检查触发（实际应用中由后端定时检查）
  simulateCheck(e) {
    const { id } = e.currentTarget.dataset
    const strategy = app.globalData.strategies.find(s => s.id === id)
    if (!strategy) return

    // 模拟市场数据
    const mockData = {
      price: Math.random() * 100 + 10,
      ma5: Math.random() * 100 + 10,
      ma10: Math.random() * 100 + 10,
      ma20: Math.random() * 100 + 10,
      macd: {
        dif: Math.random() * 2 - 1,
        dea: Math.random() * 2 - 1,
        histogram: Math.random() * 2 - 1
      },
      bollUpper: Math.random() * 120 + 20,
      bollLower: Math.random() * 80,
      rsi: Math.random() * 100,
      volume: { ratio: Math.random() * 5 + 0.5 }
    }

    const result = checkStrategyTrigger(strategy, mockData)
    if (result.hasTrigger) {
      const message = buildAlertMessage(result, mockData)
      const alert = {
        id: Date.now(),
        strategyId: strategy.id,
        strategyName: strategy.name,
        message,
        timestamp: new Date().toLocaleString()
      }
      const alerts = [alert, ...this.data.alerts].slice(0, 20)
      this.setData({ alerts })
      
      wx.showModal({
        title: '策略触发提醒',
        content: message,
        showCancel: false
      })
    } else {
      wx.showToast({ title: '暂无触发条件', icon: 'none' })
    }
  },

  // ===== 金字塔加仓 =====
  
  calcPyramid() {
    const plan = calcPyramidPlan(this.data.pyramidConfig, 10.5, 2)
    this.setData({ pyramidPlan: plan })
  },

  onPyramidLayerChange(e) {
    const layers = [...this.data.pyramidConfig.layers]
    layers[e.currentTarget.dataset.index].ratio = Number(e.detail.value) / 100
    this.setData({ 'pyramidConfig.layers': layers })
    this.calcPyramid()
  },

  onStopLossChange(e) {
    const val = Number(e.detail.value) / 100
    this.setData({ 'pyramidConfig.stopLossRatio': -Math.abs(val) })
    this.calcPyramid()
  },

  onTakeProfitChange(e) {
    const val = Number(e.detail.value) / 100
    this.setData({ 'pyramidConfig.takeProfitRatio': val })
    this.calcPyramid()
  },

  onShareAppMessage() {
    return {
      title: '投资助手 · 策略与金字塔加仓',
      path: '/pages/strategy/strategy'
    }
  },

  onShareTimeline() {
    return { title: '投资助手 · 策略与金字塔加仓' }
  }
})
