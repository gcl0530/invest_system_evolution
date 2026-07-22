// services/strategy.js - 策略数据访问层
// 策略本体存本地（用户私有数据），行情查询走 fund/stock service 或云函数
const { callCloud, getStorage, setStorage } = require('../utils/request')
const { USE_CLOUD } = require('../utils/config')

const STORAGE_KEY = 'strategies'

/**
 * 获取本地策略列表
 * @returns {Promise<Array>}
 */
async function getStrategies() {
  if (USE_CLOUD) {
    // 云开发场景下可走云数据库，支持多端同步
    return callCloud('strategy', { action: 'list' })
  }
  return getStorage(STORAGE_KEY) || []
}

/**
 * 保存策略列表
 * @param {Array} strategies
 */
async function saveStrategies(strategies) {
  if (USE_CLOUD) {
    return callCloud('strategy', { action: 'save', strategies })
  }
  return setStorage(STORAGE_KEY, strategies)
}

/**
 * 检查策略触发（查询行情 + 跑触发引擎）
 * @param {object} strategy - 策略对象
 * @returns {Promise<object>} 触发结果
 */
async function checkTrigger(strategy) {
  if (USE_CLOUD) {
    return callCloud('strategy', { action: 'checkTrigger', strategy })
  }
  // 本地 mock：暂返回无触发（真实触发需要行情数据，待接入）
  return { strategyId: strategy.id, triggers: [], hasTrigger: false }
}

module.exports = { getStrategies, saveStrategies, checkTrigger, USE_CLOUD }
