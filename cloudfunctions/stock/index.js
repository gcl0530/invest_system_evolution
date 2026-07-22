// cloudfunctions/stock/index.js - 股票数据云函数
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { action } = event
  const { OPENID } = cloud.getWXContext()

  switch (action) {
    case 'getList':
      // TODO: 接入真实股票数据源（东方财富 / 新浪行情 API）
      return { code: 0, data: [] }

    case 'getDetail': {
      const { code } = event
      // TODO: 拉取股票日K + 计算技术指标（含 KDJ）
      return { code: 0, data: null }
    }

    case 'search': {
      const { keyword } = event
      return { code: 0, data: [] }
    }

    case 'getWatchlist': {
      const db = cloud.database()
      const { data } = await db.collection('watchlist_stocks')
        .where({ _openid: OPENID })
        .get()
      return { code: 0, data }
    }

    default:
      return { code: -1, message: `unknown action: ${action}` }
  }
}
