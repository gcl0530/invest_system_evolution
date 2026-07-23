// cloudfunctions/fund/index.js - 基金数据云函数（真实净值，调天天基金接口）
const cloud = require('wx-server-sdk')
const https = require('https')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 通用 https GET（返回 utf8 文本，用于 JS 文件/JSONP）
function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

// 通用 https GET JSON
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('JSON解析失败: ' + e.message)) }
      })
    }).on('error', reject)
  })
}

function formatDate(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 拉取基金 pingzhongdata JS 文件（含历史净值 Data_netWorthTrend）
// 返回 { name, klineRaw: [{x: ms, y: 单位净值, equityReturn: 涨跌幅, unitMoney: 累计净值}, ...] }
async function fetchFundData(code) {
  const url = `https://fund.eastmoney.com/pingzhongdata/${code}.js`
  const text = await fetchText(url)
  // 解析 var Data_netWorthTrend = [...];
  const match = text.match(/var\s+Data_netWorthTrend\s*=\s*(\[.+?\]);/s)
  if (!match) throw new Error('基金净值数据解析失败（可能是非公募基金或已清盘）')
  const arr = JSON.parse(match[1])
  // 基金名称
  const nameMatch = text.match(/var\s+fS_name\s*=\s*"([^"]+)"/)
  const name = nameMatch ? nameMatch[1] : code
  return { name, klineRaw: arr }
}

// 按周期聚合净值（基金净值没有 OHLC，用单位净值 y 作为 close，open 取前一日）
function aggregateByPeriod(dailyData, period) {
  if (period === '日K') {
    return dailyData.map((d, i) => {
      const prev = i > 0 ? dailyData[i - 1].y : d.y
      return {
        timestamp: d.x,
        date: formatDate(d.x),
        open: prev,
        close: d.y,
        high: Math.max(prev, d.y),
        low: Math.min(prev, d.y),
        volume: 0,
        amount: 0
      }
    })
  }
  // 周 K / 月 K：按周/月分组，取组内首尾
  const groupMap = new Map()
  for (const d of dailyData) {
    const date = new Date(d.x)
    let key
    if (period === '周K') {
      const year = date.getFullYear()
      const onejan = new Date(year, 0, 1)
      const week = Math.ceil(((date - onejan) / 86400000 + onejan.getDay() + 1) / 7)
      key = `${year}-W${week}`
    } else {
      key = `${date.getFullYear()}-${date.getMonth() + 1}`
    }
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key).push(d)
  }
  const result = []
  for (const [, group] of groupMap) {
    const sorted = group.sort((a, b) => a.x - b.x)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    result.push({
      timestamp: last.x,
      date: formatDate(last.x),
      open: first.y,
      close: last.y,
      high: Math.max(...sorted.map(s => s.y)),
      low: Math.min(...sorted.map(s => s.y)),
      volume: 0,
      amount: 0
    })
  }
  return result
}

// 实时估值（fundgz 接口，交易时段返回估算净值）
// 返回 {name, netValue, estimatedNav, dayChange, navDate, estimateTime}
async function fetchFundGz(code) {
  const url = `https://fundgz.1234567.com.cn/js/${code}.js`
  const text = await fetchText(url)
  // 格式：jsonpgz({...});
  const match = text.match(/jsonpgz\((.+)\);/)
  if (!match) return null
  try {
    const obj = JSON.parse(match[1])
    return {
      name: obj.name,
      netValue: parseFloat(obj.dwjz) || 0,        // 单位净值
      estimatedNav: parseFloat(obj.gsz) || 0,      // 估算净值
      dayChange: parseFloat(obj.gszzl) || 0,       // 估算涨跌幅 %
      navDate: obj.jzrq,                            // 净值日期
      estimateTime: obj.gztime                     // 估值时间
    }
  } catch (e) { return null }
}

// 默认基金列表（热门基金 code）
const DEFAULT_FUNDS = [
  { code: '110011', name: '易方达优质精选混合', type: '混合型' },
  { code: '005827', name: '易方达蓝筹精选混合', type: '混合型' },
  { code: '161725', name: '招商中证白酒指数', type: '指数型' }
]

exports.main = async (event, context) => {
  const { action } = event
  const { OPENID } = cloud.getWXContext()

  switch (action) {
    case 'getList': {
      // codes 传入时按用户关注列表拉估值；无 codes 返回默认 3 只热门基金
      const { codes } = event
      const targetCodes = (codes && codes.length > 0) ? codes : DEFAULT_FUNDS.map(f => f.code)
      try {
        const results = await Promise.all(
          targetCodes.map(async code => {
            const gz = await fetchFundGz(code)
            const defaultFund = DEFAULT_FUNDS.find(f => f.code === code)
            return {
              code,
              name: (gz && gz.name) || (defaultFund && defaultFund.name) || code,
              type: (defaultFund && defaultFund.type) || '混合型',
              netValue: (gz && gz.netValue) || 0,
              dayChange: (gz && gz.dayChange) || 0,
              navDate: (gz && gz.navDate) || '',
              estimatedNav: (gz && gz.estimatedNav) || 0,
              weekChange: 0,
              monthChange: 0
            }
          })
        )
        return { code: 0, data: results }
      } catch (err) {
        console.error('[fund:getList]', err)
        return { code: -1, message: '获取基金列表失败: ' + err.message }
      }
    }

    case 'getDetail': {
      const { code, period } = event
      try {
        const [fundData, gz] = await Promise.all([
          fetchFundData(code),
          fetchFundGz(code)
        ])
        const periodData = aggregateByPeriod(fundData.klineRaw, period || '日K')
        const lastClose = periodData.length > 0 ? periodData[periodData.length - 1].close : 0
        return {
          code: 0,
          data: {
            code,
            name: fundData.name,
            type: '混合型',
            netValue: (gz && gz.netValue) || lastClose,
            dayChange: (gz && gz.dayChange) || 0,
            navDate: (gz && gz.navDate) || '',
            estimatedNav: (gz && gz.estimatedNav) || 0,
            weekChange: 0,
            monthChange: 0,
            kline: periodData
          }
        }
      } catch (err) {
        console.error('[fund:getDetail]', err)
        return { code: -1, message: '获取基金详情失败: ' + err.message }
      }
    }

    case 'search': {
      const { keyword } = event
      try {
        const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchPageAPI.ashx?m=1&key=${encodeURIComponent(keyword)}&pageIndex=1&pageSize=15`
        const data = await fetchJson(url)
        const list = (data.Datas || []).map(item => ({
          code: item.CODE,
          name: item.NAME,
          type: (item.FundBaseInfo && item.FundBaseInfo.FTTYPE) || '混合型'
        })).filter(item => item.code)
        return { code: 0, data: list }
      } catch (err) {
        console.error('[fund:search]', err)
        return { code: -1, message: '搜索失败: ' + err.message }
      }
    }

    case 'getWatchlist': {
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
