// utils/backtest.js - 策略历史回测引擎
// 复用 indicators.js 计算指标，strategy.js 的触发条件引擎
// 逐 bar 模拟策略执行，统计胜率/盈亏比/最大回撤/夏普比率/年化收益

const { calcMA, calcEMA, calcBOLL, calcMACD, calcRSI, calcKDJ, calcVolumeMA } = require('./indicators')
const { calcPyramidPlan, DEFAULT_PYRAMID } = require('./strategy')

/**
 * 计算指定位置的技术指标值
 * @param {Array} kline - K线数组
 * @param {number} i - 当前bar索引
 * @returns {Object} marketData - 供 checkStrategyTrigger 使用的市场数据
 */
function buildMarketData(kline, i) {
  const closes = kline.map(k => k.close)
  const highs = kline.map(k => k.high)
  const lows = kline.map(k => k.low)
  const volumes = kline.map(k => k.volume || 0)

  const ma5 = calcMA(closes, 5)
  const ma10 = calcMA(closes, 10)
  const ma20 = calcMA(closes, 20)
  const ma60 = calcMA(closes, 60)
  const boll = calcBOLL(closes, 20, 2)
  const macd = calcMACD(closes, 12, 26, 9)
  const rsi = calcRSI(closes, 14)
  const kdj = calcKDJ(highs, lows, closes, 9)
  const volMA5 = calcVolumeMA(volumes, 5)

  const macdObj = (macd.dif[i] !== null && macd.dea[i] !== null) ? {
    dif: macd.dif[i],
    dea: macd.dea[i],
    histogram: macd.histogram[i]
  } : null

  const volumeRatio = (volMA5[i] !== null && volMA5[i] > 0) ? volumes[i] / volMA5[i] : 1

  return {
    price: closes[i],
    ma5: ma5[i],
    ma10: ma10[i],
    ma20: ma20[i],
    ma60: ma60[i],
    macd: macdObj,
    bollUpper: boll.upper[i],
    bollLower: boll.lower[i],
    rsi: rsi[i],
    volume: { ratio: volumeRatio, raw: volumes[i] }
  }
}

/**
 * 检查策略触发条件（从 strategy.js 逻辑简化，直接用预计算指标）
 */
function checkConditions(conditions, marketData) {
  const triggers = []
  const { price, ma5, ma10, ma20, macd, bollUpper, bollLower, rsi, volume } = marketData

  for (const cond of conditions) {
    let triggered = false
    let action = cond.action || 'notify'

    switch (cond.type) {
      case 'price_cross_ma': {
        const maVal = cond.ma === 'MA5' ? ma5 : cond.ma === 'MA10' ? ma10 : ma20
        if (maVal != null) {
          if (cond.direction === 'up' && price > maVal) triggered = true
          else if (cond.direction === 'down' && price < maVal) triggered = true
        }
        break
      }
      case 'macd_cross': {
        if (macd) {
          if (cond.direction === 'golden' && macd.dif > macd.dea && macd.histogram > 0) triggered = true
          else if (cond.direction === 'death' && macd.dif < macd.dea && macd.histogram < 0) triggered = true
        }
        break
      }
      case 'boll_breakout': {
        if (bollUpper != null && bollLower != null) {
          if (cond.direction === 'up' && price > bollUpper) triggered = true
          else if (cond.direction === 'down' && price < bollLower) triggered = true
        }
        break
      }
      case 'rsi_over': {
        if (rsi != null) {
          const threshold = cond.threshold || 70
          if (cond.direction === 'overbought' && rsi > threshold) triggered = true
          else if (cond.direction === 'oversold' && rsi < (100 - threshold)) triggered = true
        }
        break
      }
      case 'volume_surge': {
        if (volume && cond.volumeRatio && volume.ratio >= cond.volumeRatio) triggered = true
        break
      }
      case 'price_target': {
        if (cond.targetPrice) {
          if (cond.direction === 'up' && price >= cond.targetPrice) triggered = true
          else if (cond.direction === 'down' && price <= cond.targetPrice) triggered = true
        }
        break
      }
    }

    if (triggered) {
      triggers.push({ condition: cond, action })
    }
  }

  return triggers
}

/**
 * 执行回测
 * @param {Object} params
 * @param {Array} params.kline - K线数据
 * @param {Array} params.conditions - 策略触发条件
 * @param {Object} params.pyramidConfig - 金字塔配置（可选）
 * @param {boolean} params.usePyramid - 是否启用金字塔加仓
 * @param {number} params.capital - 初始资金
 * @param {number} params.startIndex - 开始回测的bar索引（前面留给指标预热）
 * @returns {Object} 回测结果
 */
function runBacktest(params) {
  const {
    kline,
    conditions,
    pyramidConfig = DEFAULT_PYRAMID,
    usePyramid = true,
    capital = 100000,
    startIndex = 60  // MA60 需要至少60根bar
  } = params

  if (!kline || kline.length < startIndex + 10) {
    return { error: 'K线数据不足，至少需要 ' + (startIndex + 10) + ' 根' }
  }

  // 回测状态
  let cash = capital
  let position = 0        // 持仓股数
  let avgCost = 0         // 平均成本
  let pyramidLevel = 0    // 当前金字塔层数
  let entryPrice = 0      // 首次建仓价

  // 统计
  let totalTrades = 0
  let winTrades = 0
  let lossTrades = 0
  let totalProfit = 0     // 累计盈亏
  let maxProfit = 0       // 单笔最大盈利
  let maxLoss = 0         // 单笔最大亏损
  let maxDrawdown = 0     // 最大回撤
  let peakEquity = capital // 权益峰值

  // 交易记录
  const trades = []
  // 每日权益曲线
  const equityCurve = []
  // 持仓记录
  const positions = []

  // 预计算所有指标（只算一次，避免逐 bar 重复计算）
  const closes = kline.map(k => k.close)
  const highs = kline.map(k => k.high)
  const lows = kline.map(k => k.low)
  const volumes = kline.map(k => k.volume || 0)

  const indicators = {
    ma5: calcMA(closes, 5),
    ma10: calcMA(closes, 10),
    ma20: calcMA(closes, 20),
    ma60: calcMA(closes, 60),
    boll: calcBOLL(closes, 20, 2),
    macd: calcMACD(closes, 12, 26, 9),
    rsi: calcRSI(closes, 14),
    kdj: calcKDJ(highs, lows, closes, 9),
    volMA5: calcVolumeMA(volumes, 5)
  }

  for (let i = startIndex; i < kline.length; i++) {
    const bar = kline[i]
    const price = bar.close

    // 构建当前 bar 的市场数据
    const macdObj = (indicators.macd.dif[i] !== null && indicators.macd.dea[i] !== null) ? {
      dif: indicators.macd.dif[i],
      dea: indicators.macd.dea[i],
      histogram: indicators.macd.histogram[i]
    } : null

    const volumeRatio = (indicators.volMA5[i] !== null && indicators.volMA5[i] > 0)
      ? volumes[i] / indicators.volMA5[i] : 1

    const marketData = {
      price,
      ma5: indicators.ma5[i],
      ma10: indicators.ma10[i],
      ma20: indicators.ma20[i],
      ma60: indicators.ma60[i],
      macd: macdObj,
      bollUpper: indicators.boll.upper[i],
      bollLower: indicators.boll.lower[i],
      rsi: indicators.rsi[i],
      volume: { ratio: volumeRatio, raw: volumes[i] }
    }

    // 检查触发条件
    const triggers = checkConditions(conditions, marketData)

    // 处理触发
    for (const t of triggers) {
      if (t.action === 'buy') {
        // 买入逻辑
        if (usePyramid && pyramidLevel < (pyramidConfig.layers || []).length) {
          // 金字塔加仓
          const layer = pyramidConfig.layers[pyramidLevel]
          const layerCapital = capital * layer.ratio
          const shares = Math.floor(layerCapital / price / 100) * 100
          if (shares > 0 && cash >= shares * price) {
            const cost = shares * price
            cash -= cost
            const oldTotal = position * avgCost
            position += shares
            avgCost = (oldTotal + cost) / position
            if (pyramidLevel === 0) entryPrice = price
            pyramidLevel++

            trades.push({
              date: bar.date,
              type: 'buy',
              price,
              shares,
              cost,
              reason: t.condition.type + ' ' + (layer.label || ('层' + pyramidLevel)),
              pyramidLevel
            })
          }
        } else if (!usePyramid && position === 0) {
          // 非金字塔：全仓买入
          const shares = Math.floor(cash / price / 100) * 100
          if (shares > 0) {
            const cost = shares * price
            cash -= cost
            position = shares
            avgCost = price
            entryPrice = price
            totalTrades++

            trades.push({
              date: bar.date,
              type: 'buy',
              price,
              shares,
              cost,
              reason: t.condition.type
            })
          }
        }
      } else if (t.action === 'sell') {
        // 卖出逻辑
        if (position > 0) {
          const revenue = position * price
          const profit = (price - avgCost) * position
          cash += revenue

          // 统计
          totalTrades++
          if (profit > 0) {
            winTrades++
            totalProfit += profit
            if (profit > maxProfit) maxProfit = profit
          } else {
            lossTrades++
            totalProfit += profit
            if (profit < maxLoss) maxLoss = profit
          }

          trades.push({
            date: bar.date,
            type: 'sell',
            price,
            shares: position,
            revenue,
            profit,
            profitPercent: (price - avgCost) / avgCost * 100,
            reason: t.condition.type
          })

          // 清仓
          position = 0
          avgCost = 0
          pyramidLevel = 0
          entryPrice = 0
        }
      }
      // notify 类型不执行交易，仅记录
    }

    // 检查止损止盈（金字塔模式）
    if (usePyramid && position > 0 && pyramidConfig.stopLossRatio && pyramidConfig.takeProfitRatio) {
      const stopLossPrice = avgCost * (1 + pyramidConfig.stopLossRatio)
      const takeProfitPrice = avgCost * (1 + pyramidConfig.takeProfitRatio)

      if (price <= stopLossPrice) {
        // 止损
        const revenue = position * price
        const profit = (price - avgCost) * position
        cash += revenue
        totalTrades++
        if (profit > 0) winTrades++
        else lossTrades++
        totalProfit += profit
        if (profit > maxProfit) maxProfit = profit
        if (profit < maxLoss) maxLoss = profit

        trades.push({
          date: bar.date,
          type: 'sell',
          price,
          shares: position,
          revenue,
          profit,
          profitPercent: (price - avgCost) / avgCost * 100,
          reason: '止损'
        })

        position = 0
        avgCost = 0
        pyramidLevel = 0
        entryPrice = 0
      } else if (price >= takeProfitPrice) {
        // 止盈
        const revenue = position * price
        const profit = (price - avgCost) * position
        cash += revenue
        totalTrades++
        winTrades++
        totalProfit += profit
        if (profit > maxProfit) maxProfit = profit

        trades.push({
          date: bar.date,
          type: 'sell',
          price,
          shares: position,
          revenue,
          profit,
          profitPercent: (price - avgCost) / avgCost * 100,
          reason: '止盈'
        })

        position = 0
        avgCost = 0
        pyramidLevel = 0
        entryPrice = 0
      }
    }

    // 计算当日权益
    const equity = cash + position * price
    equityCurve.push({
      date: bar.date,
      equity,
      drawdown: 0
    })

    if (equity > peakEquity) peakEquity = equity
    const drawdown = (peakEquity - equity) / peakEquity
    if (drawdown > maxDrawdown) maxDrawdown = drawdown

    positions.push({
      date: bar.date,
      price,
      position,
      avgCost,
      cash,
      equity
    })
  }

  // 收尾：如果还持仓，按最后收盘价平仓计算
  const lastBar = kline[kline.length - 1]
  if (position > 0) {
    const price = lastBar.close
    const profit = (price - avgCost) * position
    cash += position * price
    totalTrades++
    if (profit > 0) winTrades++
    else lossTrades++
    totalProfit += profit

    trades.push({
      date: lastBar.date,
      type: 'sell',
      price,
      shares: position,
      revenue: position * price,
      profit,
      profitPercent: (price - avgCost) / avgCost * 100,
      reason: '回测结束平仓'
    })

    position = 0
  }

  // 更新权益曲线的回撤
  let peak = capital
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity
    point.drawdown = peak > 0 ? (peak - point.equity) / peak : 0
  }

  // ========== 统计指标 ==========

  const finalEquity = cash
  const totalReturn = (finalEquity - capital) / capital
  const tradingDays = kline.length - startIndex
  const years = tradingDays / 244  // A股一年约244个交易日
  const annualizedReturn = years > 0 ? Math.pow(finalEquity / capital, 1 / years) - 1 : 0

  const winRate = totalTrades > 0 ? winTrades / totalTrades : 0
  const avgWin = winTrades > 0 ? totalProfit / winTrades : 0  // 简化：用总盈亏/盈利次数
  const avgLoss_ = lossTrades > 0 ? totalProfit / lossTrades : 0
  const profitFactor = maxLoss !== 0 ? Math.abs(maxProfit / maxLoss) : 0

  // 夏普比率（简化：用日收益率标准差）
  const dailyReturns = []
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i - 1].equity > 0) {
      dailyReturns.push((equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity)
    }
  }
  const avgDailyReturn = dailyReturns.length > 0
    ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    : 0
  const variance = dailyReturns.length > 0
    ? dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length
    : 0
  const stdDev = Math.sqrt(variance)
  const sharpeRatio = stdDev > 0
    ? (avgDailyReturn / stdDev) * Math.sqrt(244)  // 年化
    : 0

  // 买卖统计
  const buyTrades = trades.filter(t => t.type === 'buy')
  const sellTrades = trades.filter(t => t.type === 'sell')

  return {
    // 核心指标
    capital,
    finalEquity,
    totalReturn,           // 总收益率
    annualizedReturn,      // 年化收益率
    maxDrawdown,           // 最大回撤
    sharpeRatio,           // 夏普比率

    // 交易统计
    totalTrades,
    winTrades,
    lossTrades,
    winRate,               // 胜率
    profitFactor,          // 盈亏比（最大盈利/最大亏损）
    maxProfit,
    maxLoss,
    avgWin,
    avgLoss: avgLoss_,

    // 明细
    trades,                // 交易记录
    equityCurve,           // 权益曲线
    positions,             // 持仓记录

    // 配置回显
    config: {
      usePyramid,
      pyramidConfig,
      conditions,
      klineCount: kline.length,
      tradingDays
    }
  }
}

/**
 * 生成回测摘要文本
 */
function buildBacktestSummary(result) {
  if (result.error) return result.error

  const lines = [
    `回测结果摘要`,
    `══════════════════════════`,
    `初始资金: ¥${result.capital.toLocaleString()}`,
    `最终权益: ¥${result.finalEquity.toLocaleString()}`,
    `总收益率: ${(result.totalReturn * 100).toFixed(2)}%`,
    `年化收益: ${(result.annualizedReturn * 100).toFixed(2)}%`,
    `最大回撤: ${(result.maxDrawdown * 100).toFixed(2)}%`,
    `夏普比率: ${result.sharpeRatio.toFixed(3)}`,
    `──────────────────────────`,
    `总交易次数: ${result.totalTrades}`,
    `盈利次数: ${result.winTrades} | 亏损次数: ${result.lossTrades}`,
    `胜率: ${(result.winRate * 100).toFixed(1)}%`,
    `盈亏比: ${result.profitFactor.toFixed(2)}`,
    `单笔最大盈利: ¥${result.maxProfit.toFixed(0)}`,
    `单笔最大亏损: ¥${result.maxLoss.toFixed(0)}`,
    `══════════════════════════`
  ]
  return lines.join('\n')
}

module.exports = {
  runBacktest,
  buildBacktestSummary,
  checkConditions,
  buildMarketData
}
