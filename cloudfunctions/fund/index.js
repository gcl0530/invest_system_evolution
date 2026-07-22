// cloudfunctions/fund/index.js - 基金数据云函数
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { action } = event
  const { OPENID } = cloud.getWXContext()

  switch (action) {
    case 'getList':
      // TODO: 接入真实基金数据源（天天基金 / 腾讯财经 API）
      return { code: 0, data: [] }

    case 'getDetail': {
      const { code } = event
      // TODO: 拉取基金历史净值 + 计算技术指标（SMA/BOLL/MACD 等）
      return { code: 0, data: null }
    }

    case 'search': {
      const { keyword } = event
      return { code: 0, data: [] }
    }

    case 'getWatchlist': {
      // 从云数据库读该用户的关注基金
      const db = cloud.database()
      const { data } = await db.collection('watchlist_funds')
        .where({ _openid: OPENID })
        .get()
      return { code: 0, data }
    }

    default:
      return { code: -1, message: `unknown action: ${action}` }
  }
}
