# Surge iPhone 配置

主配置：[Surge.conf](Surge.conf)

分流规则与重写均已整理到本仓库。分流自托管，广告合集只合并去重后的域名；B 站使用 Biliverse 官方模块，YouTube 使用 Maasea 官方模块，DualSubs 使用官方模块。Apple Weather/Maps/LocationService 增强已移除。

公开配置不包含私人节点、密码或证书。首次使用请在 Surge 的代理页面添加自己的节点，再导入主配置。HTTPS 重写需要在 Surge 安装并信任自己的 MITM 证书，只为配置中列出的主机开启解密。

`iOS系统更新` 默认 REJECT，可在策略组手动选 DIRECT；`pomo.mom` 为 DIRECT；GitHub、GreasyFork 使用 GitHub 组。未匹配流量默认进入“漏网之鱼”组。

重写规则是基于官方脚本的组合，未在用户设备上实测，无法保证所有 App 广告都能去除。Surge 每个请求或响应只执行第一条匹配脚本，因此已去除 B 站、YouTube、DualSubs 的重复响应处理。
