// pages/philosophy/philosophy.js
const app = getApp()

Page({
  data: {
    // 道法术器势框架
    framework: {
      dao: {
        title: '道 · 投资哲学',
        subtitle: '核心理念与价值观',
        color: '#ffd54f',
        items: [
          { id: 'dao1', title: '投资本质', content: '投资是对未来现金流的折现，买入优质资产，时间做朋友。', editing: false },
          { id: 'dao2', title: '风险认知', content: '风险来自不知道自己在做什么。承认无知，才能避免大错。', editing: false },
          { id: 'dao3', title: '市场观', content: '市场是投票机（短期）也是称重机（长期）。情绪带来机会，价值决定价格。', editing: false },
          { id: 'dao4', title: '能力圈', content: '只投资能看懂的标的。能力圈不在于多大，而在于知道边界在哪。', editing: false }
        ]
      },
      fa: {
        title: '法 · 投资体系',
        subtitle: '策略框架与决策原则',
        color: '#7c4dff',
        items: [
          { id: 'fa1', title: '资产配置', content: '股债平衡，分散与集中结合。核心仓位长期持有，卫星仓位灵活调仓。', editing: false },
          { id: 'fa2', title: '仓位管理', content: '金字塔加仓，分批建仓。不满仓、不空仓，永远留有余地。', editing: false },
          { id: 'fa3', title: '买卖纪律', content: '买入看价值+安全边际，卖出看基本面恶化或极度高估。不因涨而卖，不因跌而买。', editing: false },
          { id: 'fa4', title: '止损规则', content: '单标的止损不超过总仓位的8%。止损保命，不止损要命。', editing: false }
        ]
      },
      shu: {
        title: '术 · 技术分析',
        subtitle: '工具方法与操作技巧',
        color: '#42a5f5',
        items: [
          { id: 'shu1', title: '趋势判断', content: '均线多头排列看多，空头排列看空。20日均线为中期趋势分水岭。', editing: false },
          { id: 'shu2', title: '买卖信号', content: 'MACD金叉买入，死叉卖出。结合成交量确认信号有效性。', editing: false },
          { id: 'shu3', title: '震荡指标', content: 'RSI>70超买警惕，RSI<30超卖关注。布林带突破确认趋势启动。', editing: false },
          { id: 'shu4', title: '量价关系', content: '量在价先。放量上涨=资金进场，缩量下跌=抛压减弱，背离需警惕。', editing: false }
        ]
      },
      qi: {
        title: '器 · 工具平台',
        subtitle: '执行工具与数据来源',
        color: '#26a69a',
        items: [
          { id: 'qi1', title: '行情工具', content: '东方财富/同花顺看行情，本小程序做快速盯盘和策略提醒。', editing: false },
          { id: 'qi2', title: '数据分析', content: '理杏仁看估值数据，乌龟量化做因子筛选，集思录看套利机会。', editing: false },
          { id: 'qi3', title: '交易执行', content: '条件单+网格交易自动化执行，减少人工情绪干扰。', editing: false },
          { id: 'qi4', title: '记录复盘', content: '每笔交易记录买卖理由，定期复盘总结得失。形成自己的交易日志。', editing: false }
        ]
      },
      shi: {
        title: '势 · 市场环境',
        subtitle: '宏观趋势与周期判断',
        color: '#ef5350',
        items: [
          { id: 'shi1', title: '经济周期', content: '美林时钟：复苏期股票、过热期商品、滞胀期现金、衰退期债券。', editing: false },
          { id: 'shi2', title: '货币政策', content: '宽松周期利好权益资产，紧缩周期偏向防御。关注利率和流动性变化。', editing: false },
          { id: 'shi3', title: '行业景气', content: '跟踪行业景气度变化，选择处于上行周期的行业。自上而下与自下而上结合。', editing: false },
          { id: 'shi4', title: '市场情绪', content: '恐惧贪婪指数、换手率、融资余额等衡量市场情绪。人弃我取，人取我予。', editing: false }
        ]
      }
    },
    
    // 当前展开的层级
    activeLevel: 'dao',
    
    // 编辑状态
    editingItem: null,
    editingContent: '',
    
    // 新增条目
    showAddPanel: false,
    newTitle: '',
    newContent: ''
  },

  onLoad() {
    this.loadPhilosophy()
  },

  // 加载自定义体系
  loadPhilosophy() {
    const saved = app.globalData.philosophy
    if (saved && saved.framework) {
      this.setData({ framework: saved.framework })
    } else {
      // 保存默认框架
      app.globalData.philosophy = { framework: this.data.framework }
      app.savePhilosophy()
    }
  },

  // 切换层级
  onLevelChange(e) {
    const level = e.currentTarget.dataset.level || e.detail.value
    this.setData({ activeLevel: level })
  },

  // 编辑条目
  editItem(e) {
    const { level, id } = e.currentTarget.dataset
    const items = this.data.framework[level].items
    const item = items.find(i => i.id === id)
    if (item) {
      this.setData({
        editingItem: { level, id },
        editingContent: item.content
      })
    }
  },

  // 保存编辑
  saveEdit() {
    const { level, id } = this.data.editingItem
    const framework = { ...this.data.framework }
    framework[level].items = framework[level].items.map(i => {
      if (i.id === id) return { ...i, content: this.data.editingContent }
      return i
    })
    this.setData({ framework, editingItem: null, editingContent: '' })
    this.savePhilosophy(framework)
  },

  // 取消编辑
  cancelEdit() {
    this.setData({ editingItem: null, editingContent: '' })
  },

  // 编辑内容输入
  onEditContentInput(e) {
    this.setData({ editingContent: e.detail.value })
  },

  // 删除条目
  deleteItem(e) {
    const { level, id } = e.currentTarget.dataset
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条内容吗？',
      success: res => {
        if (res.confirm) {
          const framework = { ...this.data.framework }
          framework[level].items = framework[level].items.filter(i => i.id !== id)
          this.setData({ framework })
          this.savePhilosophy(framework)
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  // 显示新增面板
  showAdd() {
    this.setData({ showAddPanel: true, newTitle: '', newContent: '' })
  },

  hideAdd() {
    this.setData({ showAddPanel: false })
  },

  onNewTitleInput(e) {
    this.setData({ newTitle: e.detail.value })
  },

  onNewContentInput(e) {
    this.setData({ newContent: e.detail.value })
  },

  // 添加条目
  addItem() {
    const { newTitle, newContent, activeLevel } = this.data
    if (!newTitle.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!newContent.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }

    const framework = { ...this.data.framework }
    framework[activeLevel].items.push({
      id: Date.now().toString(),
      title: newTitle,
      content: newContent,
      editing: false
    })
    this.setData({ framework, showAddPanel: false, newTitle: '', newContent: '' })
    this.savePhilosophy(framework)
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  // 保存到全局
  savePhilosophy(framework) {
    app.globalData.philosophy = { framework }
    app.savePhilosophy()
  }
})
