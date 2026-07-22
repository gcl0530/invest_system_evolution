// cloudfunctions/strategy/index.js - 策略云函数
// 处理策略的多端同步、定时触发检查、订阅消息推送
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  const { OPENID } = cloud.getWXContext()

  switch (action) {
    case 'list': {
      // 读取该用户的所有策略
      const { data } = await db.collection('strategies')
        .where({ _openid: OPENID })
        .get()
      return { code: 0, data }
    }

    case 'save': {
      // 保存策略列表（简单全量覆盖；生产可改为按 id upsert）
      const { strategies } = event
      // 先删旧
      await db.collection('strategies')
        .where({ _openid: OPENID })
        .remove()
      // 再批量插新
      for (const s of strategies) {
        await db.collection('strategies').add({
          data: { ...s, _openid: OPENID }
        })
      }
      return { code: 0, data: { saved: strategies.length } }
    }

    case 'checkTrigger': {
      // 拉取最新行情 + 跑触发引擎
      // TODO: 接入行情查询 + 复用 indicators/strategy 引擎逻辑
      const { strategy } = event
      return { code: 0, data: { strategyId: strategy.id, triggers: [], hasTrigger: false } }
    }

    default:
      return { code: -1, message: `unknown action: ${action}` }
  }
}
