// utils/format.js - 格式化工具
function formatPrice(num, decimals = 2) {
  if (num === null || num === undefined) return '--'
  return Number(num).toFixed(decimals)
}

function formatPercent(num, withSign = true) {
  if (num === null || num === undefined) return '--'
  const sign = withSign && num > 0 ? '+' : ''
  return sign + Number(num).toFixed(2) + '%'
}

function formatChange(num, withSign = true) {
  if (num === null || num === undefined) return '--'
  const sign = withSign && num > 0 ? '+' : ''
  return sign + Number(num).toFixed(2)
}

function formatVolume(vol) {
  if (vol === null || vol === undefined) return '--'
  if (vol >= 100000000) return (vol / 100000000).toFixed(2) + '亿'
  if (vol >= 10000) return (vol / 10000).toFixed(2) + '万'
  return vol.toString()
}

function formatAmount(amt) {
  if (amt === null || amt === undefined) return '--'
  if (amt >= 100000000) return (amt / 100000000).toFixed(2) + '亿'
  if (amt >= 10000) return (amt / 10000).toFixed(2) + '万'
  return amt.toString()
}

function getColor(num) {
  if (num > 0) return 'text-up'
  if (num < 0) return 'text-down'
  return 'text-flat'
}

function getTagClass(num) {
  if (num > 0) return 'tag-up'
  if (num < 0) return 'tag-down'
  return 'tag-flat'
}

function formatDate(ts, fmt = 'MM-DD') {
  const d = new Date(ts)
  const M = (d.getMonth() + 1).toString().padStart(2, '0')
  const D = d.getDate().toString().padStart(2, '0')
  const H = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return fmt.replace('MM', M).replace('DD', D).replace('HH', H).replace('mm', m)
}

module.exports = {
  formatPrice,
  formatPercent,
  formatChange,
  formatVolume,
  formatAmount,
  getColor,
  getTagClass,
  formatDate
}
