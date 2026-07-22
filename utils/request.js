// utils/request.js - 统一请求封装
// 云开发模式下走 wx.cloud.callFunction，Promise 化封装 + 统一错误处理

/**
 * 调用云函数
 * @param {string} name - 云函数名
 * @param {object} data - 入参
 * @returns {Promise<any>} 云函数返回的 data 字段
 */
const callCloud = (name, data = {}) => {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => {
        // 约定云函数返回 { code: 0, data: ... } 结构
        if (res.result && res.result.code === 0) {
          resolve(res.result.data)
        } else {
          console.error(`[cloud:${name}] 业务异常`, res.result)
          reject(res.result || { code: -1, message: '云函数返回异常' })
        }
      },
      fail: (err) => {
        console.error(`[cloud:${name}] 调用失败`, err)
        reject({ code: -1, message: '云函数调用失败', detail: err })
      }
    })
  })
}

/**
 * 本地缓存读（同步）
 */
const getStorage = (key) => {
  try {
    return wx.getStorageSync(key)
  } catch (e) {
    console.error(`[storage:get] ${key}`, e)
    return null
  }
}

/**
 * 本地缓存写（同步）
 */
const setStorage = (key, data) => {
  try {
    wx.setStorageSync(key, data)
    return true
  } catch (e) {
    console.error(`[storage:set] ${key}`, e)
    return false
  }
}

module.exports = { callCloud, getStorage, setStorage }
