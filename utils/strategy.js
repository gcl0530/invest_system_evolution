// utils/strategy.js - 策略与金字塔加仓引擎

/**
 * 金字塔加仓模型
 * 每一层加仓数量递增，降低平均成本
 */

// 默认金字塔配置
const DEFAULT_PYRAMID = {
  layers: [
    { level: 1, ratio: 0.1, label: '试探仓' },    // 第一层：10%资金，试探
    { level: 2, ratio: 0.2, label: '基础仓' },    // 第二层：20%资金
    { level: 3, ratio: 0.3, label: '加仓1' },     // 第三层：30%资金
    { level: 4, ratio: 0.4, label: '加仓2' }      // 第四层：40%资金（金字塔底部）
  ],
  totalCapital: 100000,  // 总资金
  maxPosition: 0.8,       // 最大持仓比例
  stopLossRatio: -0.08,   // 止损比例
  takeProfitRatio: 0.15   // 止盈比例
}

/**
 * 计算金字塔加仓计划
 * @param {Object} config - 金字塔配置
 * @param {number} currentPrice - 当前价格
 * @param {number} currentLayer - 当前已加仓层数（0表示未建仓）
 * @returns {Object} 加仓计划
 */
function calcPyramidPlan(config, currentPrice, currentLayer = 0) {
  const cfg = { ...DEFAULT_PYRAMID, ...config }
  const layers = cfg.layers
  const totalCapital = cfg.totalCapital
  
  // 计算每层资金和股数
  const plan = layers.map((layer, idx) => {
    const capital = totalCapital * layer.ratio
    const shares = Math.floor(capital / currentPrice / 100) * 100  // 整百
    const actualCapital = shares * currentPrice
    return {
      level: layer.level,
      label: layer.label,
      ratio: layer.ratio,
      plannedCapital: capital,
      actualCapital: actualCapital,
      shares: shares,
      price: currentPrice,
      executed: idx < currentLayer
    }
  })
  
  // 累计统计
  let totalShares = 0
  let totalInvested = 0
  plan.forEach(p => {
    if (p.executed) {
      totalShares += p.shares
      totalInvested += p.actualCapital
    }
  })
  const avgCost = totalShares > 0 ? totalInvested / totalShares : 0
  
  // 下一层
  const nextLayer = plan.find(p => !p.executed)
  
  // 止损止盈价
  const stopLossPrice = avgCost > 0 ? avgCost * (1 + cfg.stopLossRatio) : 0
  const takeProfitPrice = avgCost > 0 ? avgCost * (1 + cfg.takeProfitRatio) : 0
  
  return {
    plan,
    totalShares,
    totalInvested,
    avgCost,
    nextLayer,
    stopLossPrice,
    takeProfitPrice,
    config: cfg
  }
}

/**
 * 检查策略触发条件
 * @param {Object} strategy - 策略配置
 * @param {Object} marketData - 当前市场数据
 * @returns {Object} 触发结果
 */
function checkStrategyTrigger(strategy, marketData) {
  const triggers = []
  const { price, ma5, ma10, ma20, macd, bollUpper, bollLower, rsi, volume } = marketData
  
  // 检查买卖条件
  if (strategy.conditions) {
    strategy.conditions.forEach(cond => {
      let triggered = false
      let message = ''
      
      switch (cond.type) {
        case 'price_cross_ma':
          // 价格穿越均线
          const maVal = cond.ma === 'MA5' ? ma5 : cond.ma === 'MA10' ? ma10 : ma20
          if (maVal) {
            if (cond.direction === 'up' && price > maVal) {
              triggered = true
              message = `价格${price.toFixed(2)}上穿${cond.ma}`
            } else if (cond.direction === 'down' && price < maVal) {
              triggered = true
              message = `价格${price.toFixed(2)}下穿${cond.ma}`
            }
          }
          break
          
        case 'macd_cross':
          // MACD 金叉/死叉
          if (macd) {
            if (cond.direction === 'golden' && macd.dif > macd.dea && macd.histogram > 0) {
              triggered = true
              message = `MACD金叉信号`
            } else if (cond.direction === 'death' && macd.dif < macd.dea && macd.histogram < 0) {
              triggered = true
              message = `MACD死叉信号`
            }
          }
          break
          
        case 'boll_breakout':
          // 布林带突破
          if (bollUpper && bollLower) {
            if (cond.direction === 'up' && price > bollUpper) {
              triggered = true
              message = `价格突破布林带上轨${bollUpper.toFixed(2)}`
            } else if (cond.direction === 'down' && price < bollLower) {
              triggered = true
              message = `价格跌破布林带下轨${bollLower.toFixed(2)}`
            }
          }
          break
          
        case 'rsi_over':
          // RSI 超买超卖
          if (rsi) {
            if (cond.direction === 'overbought' && rsi > (cond.threshold || 70)) {
              triggered = true
              message = `RSI=${rsi.toFixed(2)}，超买区`
            } else if (cond.direction === 'oversold' && rsi < (cond.threshold || 30)) {
              triggered = true
              message = `RSI=${rsi.toFixed(2)}，超卖区`
            }
          }
          break
          
        case 'volume_surge':
          // 放量
          if (volume && cond.volumeRatio && volume.ratio >= cond.volumeRatio) {
            triggered = true
            message = `成交量放大${volume.ratio.toFixed(1)}倍`
          }
          break
          
        case 'price_target':
          // 目标价格
          if (cond.targetPrice) {
            if (cond.direction === 'up' && price >= cond.targetPrice) {
              triggered = true
              message = `价格达到目标价${cond.targetPrice}`
            } else if (cond.direction === 'down' && price <= cond.targetPrice) {
              triggered = true
              message = `价格跌至目标价${cond.targetPrice}`
            }
          }
          break
      }
      
      if (triggered) {
        triggers.push({
          condition: cond,
          message,
          action: cond.action || 'notify',  // notify | buy | sell
          pyramidLayer: cond.pyramidLayer || null
        })
      }
    })
  }
  
  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    triggers,
    hasTrigger: triggers.length > 0
  }
}

/**
 * 生成买卖提醒消息
 */
function buildAlertMessage(triggerResult, marketData) {
  const { strategyName, triggers } = triggerResult
  const lines = [
    `【${strategyName}】策略提醒`,
    `当前价格: ${marketData.price.toFixed(2)}`,
    ''
  ]
  triggers.forEach(t => {
    lines.push(`▸ ${t.message}`)
    if (t.pyramidLayer) {
      lines.push(`  → 建议加仓层: 第${t.pyramidLayer}层`)
    }
    if (t.action === 'buy') lines.push(`  → 操作: 买入`)
    if (t.action === 'sell') lines.push(`  → 操作: 卖出`)
  })
  return lines.join('\n')
}

module.exports = {
  DEFAULT_PYRAMID,
  calcPyramidPlan,
  checkStrategyTrigger,
  buildAlertMessage
}
