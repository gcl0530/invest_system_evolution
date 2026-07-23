// services/stock.js - 股票数据访问层
// STOCK_USE_CLOUD=false 走本地 mock；true 走云函数（腾讯财经，支持A股/港股/美股）
const { callCloud } = require('../utils/request')
const { STOCK_USE_CLOUD } = require('../utils/config')
const mock = require('../mock/data')
const { calcMA, calcBOLL, calcMACD, calcRSI, calcKDJ } = require('../utils/indicators')

/**
 * 获取股票列表
 */
async function getStockList() {
  if (STOCK_USE_CLOUD) {
    const list = await callCloud('stock', { action: 'getList' })
    return (list && list.length > 0) ? list : mock.mockStocks
  }
  return mock.mockStocks
}

/**
 * 获取股票详情（含K线+指标）
 * @param {string} code - 股票代码
 * @param {string} period - 周期 日K/周K/月K
 * @param {string} market - 市场 sh/sz/hk/us
 */
async function getStockDetail(code, period, market) {
  if (STOCK_USE_CLOUD) {
    const raw = await callCloud('stock', { action: 'getDetail', code, period, market })
    const closes = raw.kline.map(k => k.close)
    const highs = raw.kline.map(k => k.high)
    const lows = raw.kline.map(k => k.low)
    return {
      ...raw,
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
  return mock.getStockDetail(code, period)
}

/**
 * 搜索股票（返回带 market 字段）
 */
async function searchStock(keyword) {
  const kw = String(keyword || '').trim()
  if (!kw) return []
  if (STOCK_USE_CLOUD) {
    const list = await callCloud('stock', { action: 'search', keyword })
    return (list && list.length > 0) ? list : mock.mockStocks.filter(s => s.name.includes(kw) || s.code.includes(kw))
  }
  return mock.mockStocks.filter(s => s.name.includes(kw) || s.code.includes(kw))
}

/**
 * 批量拉取关注列表的实时行情
 * @param {Array} items - [{code, market}] 或 [code]
 */
async function getBatchQuotes(items) {
  if (!STOCK_USE_CLOUD || !items || items.length === 0) return []
  try {
    const quotes = await callCloud('stock', { action: 'getList', codes: items })
    return quotes || []
  } catch (err) {
    console.error('[getBatchQuotes]', err)
    return []
  }
}

module.exports = { getStockList, getStockDetail, searchStock, getBatchQuotes, STOCK_USE_CLOUD }
