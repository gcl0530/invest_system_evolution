// cloudfunctions/stock/index.js - 股票数据云函数（真实行情，调腾讯财经+东方财富接口）
const cloud = require('wx-server-sdk')
const https = require('https')
const iconv = require('iconv-lite')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 股票代码转腾讯格式：6开头沪市(sh)，0/3开头深市(sz)
function toTxCode(code) {
  if (code.startsWith('6')) return 'sh' + code
  if (code.startsWith('0') || code.startsWith('3')) return 'sz' + code
  return 'sh' + code
}

// 周期映射
function toTxPeriod(period) {
  if (period === '周K') return 'week'
  if (period === '月K') return 'month'
  return 'day'
}

// 通用 https GET JSON（utf8）
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

// 通用 https GET GBK（腾讯实时行情是 GBK 编码）
function fetchGbk(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(iconv.decode(Buffer.concat(chunks), 'gbk')))
    }).on('error', reject)
  })
}

// 拉取腾讯K线（前复权）
function fetchKLine(txCode, txPeriod) {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${txCode},${txPeriod},,,640,qfq`
  return fetchJson(url)
}

// 拉取单个实时行情（GBK）
async function fetchQuote(txCode) {
  const gbkStr = await fetchGbk(`https://qt.gtimg.cn/q=${txCode}`)
  const match = gbkStr.match(/v_\w+="([^"]+)"/)
  if (!match) return null
  const f = match[1].split('~')
  return {
    code: f[2] || txCode,
    name: f[1] || txCode,
    price: parseFloat(f[3]) || 0,
    change: parseFloat(f[31]) || 0,
    changePercent: parseFloat(f[32]) || 0,
    open: parseFloat(f[5]) || 0,
    high: parseFloat(f[33]) || 0,
    low: parseFloat(f[34]) || 0,
    volume: parseInt(f[6]) || 0,
    amount: parseFloat(f[37]) || 0,
    marketCap: (parseFloat(f[45]) || 0) * 10000,
    pe: parseFloat(f[39]) || 0,
    pb: parseFloat(f[46]) || 0,
    industry: f[44] || ''
  }
}

// 批量拉取实时行情（一次请求多只股票，腾讯支持批量）
async function fetchBatchQuotes(txCodes) {
  const gbkStr = await fetchGbk(`https://qt.gtimg.cn/q=${txCodes.join(',')}`)
  const result = []
  const lines = gbkStr.split('\n')
  for (const line of lines) {
    const match = line.match(/v_\w+="([^"]+)"/)
    if (match) {
      const f = match[1].split('~')
      result.push({
        code: f[2],
        name: f[1],
        price: parseFloat(f[3]) || 0,
        change: parseFloat(f[31]) || 0,
        changePercent: parseFloat(f[32]) || 0,
        open: parseFloat(f[5]) || 0,
        high: parseFloat(f[33]) || 0,
        low: parseFloat(f[34]) || 0,
        volume: parseInt(f[6]) || 0,
        amount: parseFloat(f[37]) || 0,
        pe: parseFloat(f[39]) || 0,
        pb: parseFloat(f[46]) || 0
      })
    }
  }
  return result
}

// 解析腾讯K线为小程序格式
function parseKLine(txData, txCode, txPeriod) {
  const stockData = txData.data && txData.data[txCode]
  if (!stockData) return []
  const key = 'qfq' + txPeriod  // qfqday / qfqweek / qfqmonth
  const rawKLine = stockData[key] || stockData[txPeriod] || []
  return rawKLine.map(item => ({
    timestamp: new Date(item[0]).getTime(),
    date: item[0],
    open: parseFloat(item[1]),
    close: parseFloat(item[2]),
    high: parseFloat(item[3]),
    low: parseFloat(item[4]),
    volume: parseInt(item[5]) || 0,
    amount: 0
  }))
}

// 东方财富搜索（返回 JSON，格式明确）
async function searchEastMoney(keyword) {
  const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&count=10&token=D43BF722C8E33BDC906FB84D85E326E8`
  const data = await fetchJson(url)
  // 返回结构 { QuotationCodeTable: { Data: [...] } }，注意不是顶层 Data
  const table = data.QuotationCodeTable || {}
  // 只保留 A 股（沪深），港股/美股接口格式不同（腾讯用 hk/us 前缀，A股用 sh/sz），暂不支持
  const list = (table.Data || [])
    .filter(item => (item.SecurityTypeName || '').includes('A'))
    .map(item => ({
      code: item.Code,
      name: item.Name,
      industry: item.SecurityTypeName || ''
    }))
  return list
}

exports.main = async (event, context) => {
  const { action } = event
  const { OPENID } = cloud.getWXContext()

  switch (action) {
    case 'getDetail': {
      const { code, period } = event
      const txCode = toTxCode(code)
      const txPeriod = toTxPeriod(period)
      try {
        const [txData, quote] = await Promise.all([
          fetchKLine(txCode, txPeriod),
          fetchQuote(txCode)
        ])
        const kline = parseKLine(txData, txCode, txPeriod)
        const info = quote || { code, name: code, price: 0 }
        return { code: 0, data: { ...info, kline } }
      } catch (err) {
        console.error('[stock:getDetail]', err)
        return { code: -1, message: '获取股票数据失败: ' + err.message }
      }
    }

    case 'getList': {
      // 批量拉取关注列表的真实行情（codes 从页面传入）
      const { codes } = event
      if (!codes || codes.length === 0) return { code: 0, data: [] }
      try {
        const txCodes = codes.map(toTxCode)
        const quotes = await fetchBatchQuotes(txCodes)
        return { code: 0, data: quotes }
      } catch (err) {
        console.error('[stock:getList]', err)
        return { code: -1, message: '批量行情失败: ' + err.message }
      }
    }

    case 'search': {
      const { keyword } = event
      try {
        const list = await searchEastMoney(keyword)
        return { code: 0, data: list }
      } catch (err) {
        console.error('[stock:search]', err)
        return { code: -1, message: '搜索失败: ' + err.message }
      }
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
