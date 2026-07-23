// services/fund.js - 基金数据访问层
// USE_CLOUD=false 走本地 mock；true 走云函数（appid 开通云开发后切换）
const { callCloud } = require('../utils/request')
const { USE_CLOUD } = require('../utils/config')
const mock = require('../mock/data')

/**
 * 获取基金列表
 * @returns {Promise<Array>} 基金列表
 */
async function getFundList() {
  if (USE_CLOUD) {
    return callCloud('fund', { action: 'getList' })
  }
  return mock.mockFunds
}

/**
 * 获取基金详情（含K线+指标）
 * @param {string} code - 基金代码
 * @returns {Promise<object>}
 */
async function getFundDetail(code, period) {
  if (USE_CLOUD) {
    return callCloud('fund', { action: 'getDetail', code, period })
  }
  return mock.getFundDetail(code, period)
}

/**
 * 搜索基金
 * @param {string} keyword
 * @returns {Promise<Array>}
 */
async function searchFund(keyword) {
  if (USE_CLOUD) {
    return callCloud('fund', { action: 'search', keyword })
  }
  const kw = String(keyword || '').trim()
  if (!kw) return []
  return mock.mockFunds.filter(f => f.name.includes(kw) || f.code.includes(kw))
}

module.exports = { getFundList, getFundDetail, searchFund, USE_CLOUD }
