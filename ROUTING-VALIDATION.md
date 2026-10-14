# Surge分流构建与验证报告

构建日期：2026-10-14。目标：`woziji159/Surge`。

读取 40 份原生主列表及7份原生域名列表；每份TOTAL计数已核对。保留6个失效来源的旧分类回退，保留系统更新4主机。

输出51份平铺规则资源、43个策略组、469,137条规则。所有远程引用均指向自己的公开仓库根路径。

## 优先级与冲突处理

1. 自定义直连/代理置顶；pomo.mom直连。系统更新、国外邮件、苹果智能优先于普通苹果直连。

2. Bili六核心主机精确放行；没有导入FMZ完整Rule段，避免Bili API和safebrowsing错误封禁。

3. pubads仅对DualSubs点播清单/字幕URL放行至谷歌服务；广告URL与非字幕分片继续拒绝。广告规则未启用pre-matching，避免跳过URL/前置服务例外。

4. HTTPDNS在广告前，默认DIRECT、可切换REJECT。原有已明确的本地服务例外保留。

5. Github/Copilot与GreasyFork同组；游戏下载先于游戏平台；邮箱/云盘/学术先于对应通用服务；专门AI分类先于通用微软/谷歌。

6. 国内ChinaMax/China域名与合并中国IP放在所有指定业务分类后、FINAL前。最终默认节点选择，支持dns-failed。

广告原始输入367,387条；删除完全重复54,330条、父域覆盖重复7,343条，优先级处理前保留305,714条。未搬运原38.9万条全量旧规则。

跨分类完全重复5,712条按首次匹配保留，其中不同策略4,581条；逐条记录见surge-routing-conflicts.json。

中国IP从31,804条来源记录合并为12,576个等价地址段，均使用no-resolve。

原challenges.cloudflare.com精确AI例外保留，重复且相冲突的Copilot父域例外不再新增。苹果智能仅含原配置4个路由端点，gspe1-ssl.ls.apple.com继续作为普通苹果DIRECT。

## 分类覆盖
| 类别 | 策略 | 输入 | 保留 | 文件 |
|---|---|---:|---:|---|
| custom-direct | DIRECT | 1 | 1 | surge-custom-direct.list |
| custom-proxy | 节点选择 | 2 | 2 | surge-custom-proxy.list |
| ios-update | iOS系统更新 | 4 | 4 | surge-ios-update.list |
| mail | 国外邮箱 | 34 | 20 | surge-mail.list |
| apple-intelligence | 苹果智能 | 4 | 4 | surge-apple-intelligence.list |
| bili-core | DIRECT | 6 | 6 | surge-bili-core.list |
| subtitle-content | 谷歌服务 | 3 | 3 | surge-subtitle-content.list |
| service-ai-exceptions | 人工智能 | 8 | 8 | surge-service-ai-exceptions.list |
| service-google-exceptions | 谷歌服务 | 2 | 2 | surge-service-google-exceptions.list |
| local-direct-exceptions | DIRECT | 68 | 68 | surge-local-direct-exceptions.list |
| httpdns | HTTPDNS控制 | 63 | 63 | surge-httpdns.list |
| apple | DIRECT | 1638 | 1617 | surge-apple.txt, surge-apple.list |
| ads | 广告拦截 | 305714 | 305685 | surge-ads.txt, surge-ads.list |
| wechat | DIRECT | 332 | 329 | surge-wechat.list |
| github | GitHub | 36 | 35 | surge-github.list |
| grok | Grok人工智能 | 4 | 4 | surge-grok.list |
| perplexity | Perplexity搜索 | 5 | 5 | surge-perplexity.list |
| cursor | Cursor编程 | 4 | 4 | surge-cursor.list |
| game-download | 游戏下载 | 38 | 38 | surge-game-download.list |
| download | 文件下载 | 20 | 20 | surge-download.list |
| private-tracker | PT下载 | 248 | 248 | surge-private-tracker.list |
| netflix | 奈飞视频 | 1158 | 1157 | surge-netflix.list |
| speedtest | 网络测速 | 9 | 8 | surge-speedtest.list |
| emby | Emby影院 | 52 | 52 | surge-emby.list |
| onedrive | 微软网盘 | 18 | 18 | surge-onedrive.list |
| google-drive | 谷歌网盘 | 9 | 9 | surge-google-drive.list |
| paypal | 贝宝支付 | 248 | 247 | surge-paypal.list |
| discord | Discord社群 | 29 | 29 | surge-discord.list |
| reddit | Reddit论坛 | 8 | 8 | surge-reddit.list |
| twitch | Twitch直播 | 22 | 22 | surge-twitch.list |
| scholar | 学术论文 | 231 | 230 | surge-scholar.list |
| steam | Steam游戏 | 54 | 54 | surge-steam.list |
| game | 游戏平台 | 597 | 544 | surge-game.list |
| ai | 人工智能 | 61 | 48 | surge-ai.list |
| copilot | 微软AI | 51 | 20 | surge-copilot.list |
| microsoft | 微软服务 | 673 | 616 | surge-microsoft.list |
| tiktok | TikTok国际版 | 33 | 33 | surge-tiktok.list |
| twitter | X推特 | 33 | 30 | surge-twitter.list |
| cryptocurrency | 加密货币 | 43 | 42 | surge-cryptocurrency.list |
| telegram | 电报 | 46 | 46 | surge-telegram.list |
| google | 谷歌服务 | 703 | 663 | surge-google.list |
| direct | DIRECT | 268 | 88 | surge-direct.list |
| global-media | 节点选择 | 2335 | 2182 | surge-global-media.txt, surge-global-media.list |
| global | 节点选择 | 35229 | 30425 | surge-global.txt, surge-global.list |
| china | DIRECT | 115715 | 111841 | surge-china.txt, surge-china.list |
| china-ip | DIRECT | 12576 | 12559 | surge-china-ip.list |
## 验证
46个域名/URL决策用例，全部通过：True。
完成规则类型、正则语法、IP格式、组引用、源计数、文件引用、六地区手动组、唯一自动测速组、优先顺序及唯一FINAL检查。详细布尔结果见surge-routing-manifest.json。
这些是静态检查和规则决策模型检查；不宣称已在iPhone Surge内完成真实联网、证书、MITM或解锁测试。字幕URL必须搭配包含pubads.g.doubleclick.net的DualSubs MITM；其他URL不会全域放行。
来源原有PROCESS-NAME规则保留，在iOS普通应用上通常不生效；域名/IP规则仍覆盖对应分类。
参考：[Surge规则集](https://manual.nssurge.com/rules/ruleset.html)、[域名集格式](https://manual.nssurge.com/rules/domain.html)、[拒绝与pre-matching](https://manual.nssurge.com/policies/reject.html)、[FINAL](https://manual.nssurge.com/rules/final.html)。
