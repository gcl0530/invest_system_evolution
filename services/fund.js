// services/fund.js - 基金数据访问层
// FUND_USE_CLOUD=false 走本地 mock；true 走云函数（天天基金净值）
const { callCloud } = require('../utils/request')
const { FUND_USE_CLOUD } = require('../utils/config')
const mock = require('../mock/data')
const { calcMA, calcBOLL, calcMACD, calcRSI } = require('../utils/indicators')

/**
 * 获取基金列表
 */
async function getFundList() {
  if (FUND_USE_CLOUD) {
    const list = await callCloud('fund', { action: 'getList' })
    return (list && list.length > 0) ? list : mock.mockFunds
  }
  return mock.mockFunds
}

/**
 * 批量拉取关注列表的实时估值（按 codes）
 */
async function getBatchFundGz(codes) {
  if (!FUND_USE_CLOUD || !codes || codes.length === 0) return []
  try {
    const quotes = await callCloud('fund', { action: 'getList', codes })
    return quotes || []
  } catch (err) {
    console.error('[getBatchFundGz]', err)
    return []
  }
}

/**
 * 获取基金详情（含K线+指标）
 */
async function getFundDetail(code, period) {
  if (FUND_USE_CLOUD) {
    const raw = await callCloud('fund', { action: 'getDetail', code, period })
    const closes = raw.kline.map(k => k.close)
    return {
      ...raw,
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
  return mock.getFundDetail(code, period)
}

/**
 * 搜索基金
 */
async function searchFund(keyword) {
  const kw = String(keyword || '').trim()
  if (!kw) return []
  if (FUND_USE_CLOUD) {
    const list = await callCloud('fund', { action: 'search', keyword })
    return (list && list.length > 0) ? list : mock.mockFunds.filter(f => f.name.includes(kw) || f.code.includes(kw))
  }
  return mock.mockFunds.filter(f => f.name.includes(kw) || f.code.includes(kw))
}

module.exports = { getFundList, getBatchFundGz, getFundDetail, searchFund, FUND_USE_CLOUD }
