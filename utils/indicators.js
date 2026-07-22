// utils/indicators.js - 技术指标计算引擎

/**
 * 简单移动平均线 (SMA)
 * @param {Array} data - 收盘价数组
 * @param {number} period - 周期
 * @returns {Array} MA 数组，前面不足周期的为 null
 */
function calcMA(data, period) {
  const result = new Array(data.length).fill(null)
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += data[i - j]
    }
    result[i] = sum / period
  }
  return result
}

/**
 * 指数移动平均线 (EMA)
 */
function calcEMA(data, period) {
  const result = new Array(data.length).fill(null)
  const k = 2 / (period + 1)
  let ema = null
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue
    if (i === period - 1) {
      // 初始 SMA
      let sum = 0
      for (let j = 0; j < period; j++) sum += data[j]
      ema = sum / period
    } else {
      ema = data[i] * k + ema * (1 - k)
    }
    result[i] = ema
  }
  return result
}

/**
 * 布林带
 * @param {Array} data - 收盘价数组
 * @param {number} period - 周期（默认20）
 * @param {number} multiplier - 标准差倍数（默认2）
 */
function calcBOLL(data, period = 20, multiplier = 2) {
  const upper = new Array(data.length).fill(null)
  const mid = new Array(data.length).fill(null)
  const lower = new Array(data.length).fill(null)

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) sum += data[i - j]
    const ma = sum / period
    mid[i] = ma

    // 标准差
    let variance = 0
    for (let j = 0; j < period; j++) {
      variance += Math.pow(data[i - j] - ma, 2)
    }
    const sd = Math.sqrt(variance / period)
    upper[i] = ma + multiplier * sd
    lower[i] = ma - multiplier * sd
  }
  return { upper, mid, lower }
}

/**
 * MACD
 * @param {Array} data - 收盘价数组
 * @param {number} fast - 快线周期（默认12）
 * @param {number} slow - 慢线周期（默认26）
 * @param {number} signal - 信号线周期（默认9）
 */
function calcMACD(data, fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(data, fast)
  const emaSlow = calcEMA(data, slow)
  const dif = new Array(data.length).fill(null)
  for (let i = 0; i < data.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      dif[i] = emaFast[i] - emaSlow[i]
    }
  }
  // DEA = EMA(DIF, signal)
  const validDif = dif.filter(v => v !== null)
  const deaValid = calcEMA(validDif, signal)
  const dea = new Array(data.length).fill(null)
  let di = 0
  for (let i = 0; i < data.length; i++) {
    if (dif[i] !== null) {
      dea[i] = deaValid[di]
      di++
    }
  }
  // 柱状图 = (DIF - DEA) * 2
  const histogram = new Array(data.length).fill(null)
  for (let i = 0; i < data.length; i++) {
    if (dif[i] !== null && dea[i] !== null) {
      histogram[i] = (dif[i] - dea[i]) * 2
    }
  }
  return { dif, dea, histogram }
}

/**
 * RSI
 */
function calcRSI(data, period = 14) {
  const result = new Array(data.length).fill(null)
  if (data.length < period + 1) return result

  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1]
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return result
}

/**
 * KDJ
 */
function calcKDJ(highs, lows, closes, period = 9) {
  const k = new Array(closes.length).fill(null)
  const d = new Array(closes.length).fill(null)
  const j = new Array(closes.length).fill(null)
  let prevK = 50
  let prevD = 50

  for (let i = period - 1; i < closes.length; i++) {
    let highest = -Infinity
    let lowest = Infinity
    for (let m = 0; m < period; m++) {
      if (highs[i - m] > highest) highest = highs[i - m]
      if (lows[i - m] < lowest) lowest = lows[i - m]
    }
    const rsv = highest === lowest ? 0 : (closes[i] - lowest) / (highest - lowest) * 100
    const curK = (2 / 3) * prevK + (1 / 3) * rsv
    const curD = (2 / 3) * prevD + (1 / 3) * curK
    const curJ = 3 * curK - 2 * curD
    k[i] = curK
    d[i] = curD
    j[i] = curJ
    prevK = curK
    prevD = curD
  }
  return { k, d, j }
}

/**
 * 成交量均线
 */
function calcVolumeMA(volumes, period) {
  return calcMA(volumes, period)
}

module.exports = {
  calcMA,
  calcEMA,
  calcBOLL,
  calcMACD,
  calcRSI,
  calcKDJ,
  calcVolumeMA
}
