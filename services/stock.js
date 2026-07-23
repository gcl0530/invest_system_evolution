// services/stock.js - 股票数据访问层
// USE_CLOUD=false 走本地 mock；true 走云函数（appid 开通云开发后切换）
const { callCloud } = require('../utils/request')
const { STOCK_USE_CLOUD } = require('../utils/config')
const mock = require('../mock/data')
const { calcMA, calcBOLL, calcMACD, calcRSI, calcKDJ } = require('../utils/indicators')

/**
 * 获取股票列表
 * @returns {Promise<Array>}
 */
async function getStockList() {
  if (STOCK_USE_CLOUD) {
    const list = await callCloud('stock', { action: 'getList' })
    // 云函数返回空时 fallback mock 默认列表（code 是真实的，详情走真实数据）
    return (list && list.length > 0) ? list : mock.mockStocks
  }
  return mock.mockStocks
}

/**
 * 获取股票详情（含K线+指标）
 * @param {string} code - 股票代码
 * @returns {Promise<object>}
 */
async function getStockDetail(code, period) {
  if (STOCK_USE_CLOUD) {
    const raw = await callCloud('stock', { action: 'getDetail', code, period })
    // 云函数返回 { ...info, kline }，本地计算技术指标
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
 * 搜索股票
 * @param {string} keyword
 * @returns {Promise<Array>}
 */
async function searchStock(keyword) {
  const kw = String(keyword || '').trim()
  if (!kw) return []
  if (STOCK_USE_CLOUD) {
    const list = await callCloud('stock', { action: 'search', keyword })
    // 云函数搜索暂未实现，fallback mock 模糊匹配（能搜到 3 只示例股票）
    return (list && list.length > 0) ? list : mock.mockStocks.filter(s => s.name.includes(kw) || s.code.includes(kw))
  }
  return mock.mockStocks.filter(s => s.name.includes(kw) || s.code.includes(kw))
}

// 批量拉取关注列表的真实行情
async function getBatchQuotes(codes) {
  if (!STOCK_USE_CLOUD || !codes || codes.length === 0) return []
  try {
    const quotes = await callCloud('stock', { action: 'getList', codes })
    return quotes || []
  } catch (err) {
    console.error('[getBatchQuotes]', err)
    return []
  }
}

module.exports = { getStockList, getStockDetail, searchStock, getBatchQuotes, STOCK_USE_CLOUD }
