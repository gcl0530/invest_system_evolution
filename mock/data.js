// mock/data.js - 模拟市场数据（开发阶段用）
const { calcMA, calcBOLL, calcMACD, calcRSI, calcKDJ } = require('../utils/indicators')

// 生成模拟 K 线数据
function generateKLineData(count = 60, basePrice = 1.5, volatility = 0.02) {
  const data = []
  let price = basePrice
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  for (let i = count - 1; i >= 0; i--) {
    const ts = now - i * dayMs
    const open = price
    const change = (Math.random() - 0.48) * volatility * price
    const close = Math.max(0.01, open + change)
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.5
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.5
    const volume = Math.floor(Math.random() * 5000000 + 1000000)
    const amount = volume * (open + close) / 2

    data.push({
      timestamp: ts,
      date: formatDate(ts),
      open: round(open),
      close: round(close),
      high: round(high),
      low: round(low),
      volume,
      amount: round(amount)
    })
    price = close
  }
  return data
}

function formatDate(ts) {
  const d = new Date(ts)
  const M = (d.getMonth() + 1).toString().padStart(2, '0')
  const D = d.getDate().toString().padStart(2, '0')
  return `${M}-${D}`
}

function round(n, d = 4) {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

// 基金模拟数据
const mockFunds = [
  {
    code: '110011',
    name: '易方达中小盘混合',
    type: '混合型',
    netValue: 2.3456,
    navDate: '2026-07-22',
    dayChange: 1.23,
    weekChange: 3.45,
    monthChange: -2.1,
    yearChange: 15.6,
    riskLevel: '中高风险',
    scale: '234.5亿'
  },
  {
    code: '161725',
    name: '招商中证白酒指数',
    type: '指数型',
    netValue: 1.1234,
    navDate: '2026-07-22',
    dayChange: -0.56,
    weekChange: 2.1,
    monthChange: 5.2,
    yearChange: 28.3,
    riskLevel: '高风险',
    scale: '512.8亿'
  },
  {
    code: '005827',
    name: '易方达蓝筹精选混合',
    type: '混合型',
    netValue: 1.8765,
    navDate: '2026-07-22',
    dayChange: 0.89,
    weekChange: 1.2,
    monthChange: 3.4,
    yearChange: 12.1,
    riskLevel: '中高风险',
    scale: '186.3亿'
  }
]

// 股票模拟数据
const mockStocks = [
  {
    code: '600519',
    name: '贵州茅台',
    price: 1685.50,
    change: 12.30,
    changePercent: 0.73,
    open: 1673.20,
    high: 1690.00,
    low: 1668.00,
    volume: 23456700,
    amount: 39567890000,
    pe: 28.5,
    pb: 9.8,
    marketCap: 2114500000000,
    industry: '白酒'
  },
  {
    code: '000858',
    name: '五粮液',
    price: 152.30,
    change: -2.10,
    changePercent: -1.36,
    open: 154.00,
    high: 154.50,
    low: 151.80,
    volume: 34567800,
    amount: 52345670000,
    pe: 22.1,
    pb: 5.2,
    marketCap: 591300000000,
    industry: '白酒'
  },
  {
    code: '300750',
    name: '宁德时代',
    price: 215.60,
    change: 4.80,
    changePercent: 2.28,
    open: 211.00,
    high: 217.00,
    low: 210.50,
    volume: 45678900,
    amount: 98765430000,
    pe: 35.2,
    pb: 4.1,
    marketCap: 948600000000,
    industry: '电池'
  }
]

// 周期配置：不同周期生成不同根数和波动率的 K 线（mock 模拟，真实数据由云函数返回）
const PERIOD_CONFIG = {
  '日K': { count: 60, fundVol: 0.015, stockVol: 0.025 },
  '周K': { count: 30, fundVol: 0.03, stockVol: 0.05 },
  '月K': { count: 20, fundVol: 0.05, stockVol: 0.08 }
}

// 基金详情 + K 线
function getFundDetail(code, period) {
  const fund = mockFunds.find(f => f.code === code) || mockFunds[0]
  const cfg = PERIOD_CONFIG[period] || PERIOD_CONFIG['日K']
  const kline = generateKLineData(cfg.count, fund.netValue, cfg.fundVol)
  const closes = kline.map(k => k.close)
  return {
    ...fund,
    kline,
    indicators: {
      ma5: calcMA(closes, 5),
      ma10: calcMA(closes, 10),
      ma20: calcMA(closes, 20),
      ma60: calcMA(closes, 60),
      boll: calcBOLL(closes, 20, 2),
      macd: calcMACD(closes, 12, 26, 9),
      rsi: calcRSI(closes, 14)
    }
  }
}

// 股票详情 + K 线
function getStockDetail(code, period) {
  const stock = mockStocks.find(s => s.code === code) || mockStocks[0]
  const cfg = PERIOD_CONFIG[period] || PERIOD_CONFIG['日K']
  const kline = generateKLineData(cfg.count, stock.price, cfg.stockVol)
  const closes = kline.map(k => k.close)
  const highs = kline.map(k => k.high)
  const lows = kline.map(k => k.low)
  return {
    ...stock,
    kline,
    indicators: {
      ma5: calcMA(closes, 5),
      ma10: calcMA(closes, 10),
      ma20: calcMA(closes, 20),
      ma60: calcMA(closes, 60),
      boll: calcBOLL(closes, 20, 2),
      macd: calcMACD(closes, 12, 26, 9),
      rsi: calcRSI(closes, 14),
      kdj: calcKDJ(highs, lows, closes, 9)
    }
  }
}

module.exports = {
  mockFunds,
  mockStocks,
  generateKLineData,
  getFundDetail,
  getStockDetail
}
