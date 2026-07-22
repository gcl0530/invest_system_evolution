// services/stock.js - 股票数据访问层
// USE_CLOUD=false 走本地 mock；true 走云函数（appid 开通云开发后切换）
const { callCloud } = require('../utils/request')
const { USE_CLOUD } = require('../utils/config')
const mock = require('../mock/data')

/**
 * 获取股票列表
 * @returns {Promise<Array>}
 */
async function getStockList() {
  if (USE_CLOUD) {
    return callCloud('stock', { action: 'getList' })
  }
  return mock.mockStocks
}

/**
 * 获取股票详情（含K线+指标）
 * @param {string} code - 股票代码
 * @returns {Promise<object>}
 */
async function getStockDetail(code) {
  if (USE_CLOUD) {
    return callCloud('stock', { action: 'getDetail', code })
  }
  return mock.getStockDetail(code)
}

/**
 * 搜索股票
 * @param {string} keyword
 * @returns {Promise<Array>}
 */
async function searchStock(keyword) {
  if (USE_CLOUD) {
    return callCloud('stock', { action: 'search', keyword })
  }
  const kw = String(keyword || '').trim()
  if (!kw) return []
  return mock.mockStocks.filter(s => s.name.includes(kw) || s.code.includes(kw))
}

module.exports = { getStockList, getStockDetail, searchStock, USE_CLOUD }
