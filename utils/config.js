// utils/config.js - 环境配置统一管理
// 开通云开发后，只需修改本文件即可全局切换数据源：
//   ① 在云开发控制台开通服务并拿到云环境ID
//   ② 把 USE_CLOUD 改为 true
//   ③ 把 CLOUD_ENV_ID 改为真实云环境ID
// app.js 的 cloud.init 与各 service 的数据访问都读这里，一处修改全局生效。

module.exports = {
  // 云开发开关：false=走本地 mock 数据，true=走云函数
  // 游客模式(touristappid)必须为 false，否则 wx.cloud.init 会报错
  USE_CLOUD: false,

  // 云环境ID（开通云开发后在「云开发控制台」获取，形如 cloud1-2g5abc...）
  CLOUD_ENV_ID: 'your-env-id'
}
