# Google 综合增强第三方声明

组合脚本以 GPL-3.0 分发，保留组件的版权与许可。修改日期：2026-10-14。

- Google CAPTCHA（历史组件）：NobyDa；[官方源](https://github.com/NobyDa/Script/blob/master/Surge/JS/Google_CAPTCHA.js)，GPL-3.0，见 LICENSE.NobyDa.GPL-3.0.txt。当前实现已移除该组件及异常节点／验证码重试逻辑，保留历史作者与许可声明。
- Adblock4limbo：Copyright (c) 2022 毒奶博主；[官方源](https://github.com/limbopro/Adblock4limbo/blob/main/Adguard/Adblock4limbo.js)，MIT，见 LICENSE.limbopro.MIT.txt。网页 JS/CSS 从作者 limbopro.com 直接加载。
- Endless Google（历史组件）：Copyright (c) 2013 tumpio；[原作者项目](https://github.com/tumpio/gmscripts)，MIT，见 LICENSE.tumpio.MIT.txt；历史版本使用过 [ddgksf2013 包装](https://github.com/ddgksf2013/Scripts/blob/master/endlessgoogle.js)。当前实现已移除旧组件，保留历史作者与许可声明。

当前实现由单一 Surge 响应脚本完成网页净化及原生自动翻页，以数字 status 判断响应状态。Google、百度、必应净化继续使用作者 limbopro.com 的浏览器脚本，跳过可选 Google 域名 CSS。翻页优先点击 Google 自带的“更多结果”，否则跳转真实下一页；百度、必应也识别各自的下一页链接，不抓取或克隆其他页面的 HTML。搜索快捷入口和重定向规则保留。
