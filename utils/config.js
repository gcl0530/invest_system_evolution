// utils/config.js - 环境配置统一管理
// 开通云开发后，只需修改本文件即可全局切换数据源：
//   ① 在云开发控制台开通服务并拿到云环境ID
//   ② 把 USE_CLOUD 改为 true
//   ③ 把 CLOUD_ENV_ID 改为真实云环境ID
// app.js 的 cloud.init 与各 service 的数据访问都读这里，一处修改全局生效。

module.exports = {
  // 全局云开发开关（false=本地 mock）
  USE_CLOUD: false,

  // 分类开关：股票已接真实数据（腾讯财经），基金暂用 mock
  STOCK_USE_CLOUD: true,
  FUND_USE_CLOUD: false,

  // 云环境ID（已开通：cloudbase-d2go9p6ina9b57e2b）
  CLOUD_ENV_ID: 'cloudbase-d2go9p6ina9b57e2b'
}
