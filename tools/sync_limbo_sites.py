#!/usr/bin/env python3
"""v17: site list updates for unified scanner, no legacy dual-scanner injection."""
from __future__ import annotations
import re
import hashlib
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITES = ROOT / '毒奶网站清单.txt'
CONFIG = ROOT / 'Surge.conf'
JS = ROOT / 'surge-dunai-91short-auto.js'
SITE_MARK_START = '# >>> LIMBO_SITE_DIRECT_BEGIN (auto-generated, do not edit)'
SITE_MARK_END = '# <<< LIMBO_SITE_DIRECT_END'
MITM_MARKER = '# LIMBO_SITE_MITM_ADDED (auto-generated):'
HOST_PATTERN_MARK = '// LIMBO_SITES_HOST_PATTERN (auto-generated)'
CTRL_PATTERN_MARK = '// LIMBO_SITES_CONTROL_PATTERN (auto-generated)'


def read_hosts():
    found = []
    for line_num, row in enumerate(SITES.read_text(encoding='utf-8-sig').splitlines(), 1):
        raw = row.strip()
        if not raw or raw.startswith('#'):
            continue
        raw = raw.split(' #', 1)[0].strip()
        if re.match(r'^[a-z][a-z0-9+.-]*://', raw, re.I):
            url = urlsplit(raw)
            if url.scheme != 'https' or not url.hostname or url.username or url.password or url.port:
                raise ValueError(f'第 {line_num} 行：请用 https:// 网址或裸域名，不能写账号/端口：{raw}')
            host = url.hostname
        else:
            url = urlsplit('//' + raw)
            if url.username or url.password or url.port or not url.hostname:
                raise ValueError(f'第 {line_num} 行：不是有效的网址：{raw}')
            host = url.hostname
        try:
            host = host.rstrip('.').encode('idna').decode('ascii').lower()
        except UnicodeError as exc:
            raise ValueError(f'第 {line_num} 行：域名编码错误 {raw}') from exc
        # Users commonly paste www.example.com, but expect example.com too.
        if host.startswith('www.'):
            host = host[4:]
        if len(host) > 253 or not re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?', host):
            raise ValueError(f'第 {line_num} 行：域名格式不支持：{raw}')
        if host in {'cdn.jsdelivr.net', 'limbopro.com', 'raw.githubusercontent.com'}:
            raise ValueError(f'第 {line_num} 行：这是脚本资源域名，不要当成被增强的网站：{raw}')
        if host not in found:
            found.append(host)
    if 'x-91short.com' not in found:
        raise ValueError('请保留 x-91short.com；这是已验证正常的原网站。')
    # When root example.com is listed, www.example.com need not appear separately.
    selected = [host for host in found if not any(host != other and host.endswith('.' + other) for other in found)]
    selected.sort(key=lambda h: (h != 'x-91short.com', h))
    if len(selected) > 40:
        raise ValueError('一次最多 40 个不同域名；请拆分网站范围或手动检查性能。')
    return selected


def replace_controlled_line(text, prefix, new_line):
    lines = text.splitlines(keepends=True)
    found = [i for i, line in enumerate(lines) if line.startswith(prefix)]
    if len(found) != 1:
        raise ValueError(f'应找到唯一的 {prefix}，实得 {len(found)} 行，已停止防止破坏配置')
    i = found[0]
    lines[i] = new_line + ('\n' if lines[i].endswith('\n') else '')
    return ''.join(lines)


def update_config(conf, hosts, script_content):
    # Preserve all old rule attributes and the exact path exclusions from v10.
    entries = conf.splitlines(keepends=True)
    index = [i for i, row in enumerate(entries) if row.startswith('rewrite-001 = ')]
    if len(index) != 1:
        raise ValueError('找不到唯一的 rewrite-001（不要覆盖其他脚本）')
    line = entries[index[0]]
    rx = r'(pattern=)(.*?)(,requires-body=)'
    m = re.search(rx, line)
    if not m:
        raise ValueError('rewrite-001 未找到 pattern / requires-body')
    old_pat = m.group(2)
    # Single domain group replacement; keep original path and extension skips.
    suffix = r'\/(?!(?:api'
    if suffix not in old_pat:
        raise ValueError('rewrite-001 路径排除结构已改变；拒绝自动覆盖')
    after = old_pat[old_pat.index(suffix):]
    other = [host for host in hosts if '91short' not in host]
    # Match ANY HTTPS hostname containing '91short', plus user-listed hosts.
    # This does not match URLs that only contain the word in the path/query.
    keyword = r'[a-z0-9.-]*91short[a-z0-9.-]*'
    if other:
        extra = '|'.join(re.escape(host) for host in other)
        hostname_pattern = r'(?:' + keyword + r'|(?:[a-z0-9-]+\.)*(?:' + extra + r'))'
    else:
        hostname_pattern = r'(?:' + keyword + r')'
    new_pattern = r'^https:\/\/' + hostname_pattern + after
    line = line[:m.start(2)] + new_pattern + line[m.end(2):]
    # Changing the site list also changes the script URL so Surge cannot reuse an old version.
    # New JS features must bust the Surge cache even if the website list is unchanged.
    version = hashlib.sha256(('\n'.join(hosts) + '\n' + script_content).encode('utf-8')).hexdigest()[:12]
    resource = r'(script-path=https://raw\.githubusercontent\.com/woziji159/Surge/main/surge-dunai-91short-auto\.js)(?:\?v=[^,\s]+)?'
    line, replaced = re.subn(resource, lambda m: m.group(1) + '?v=sites17-' + version, line)
    if replaced != 1:
        raise ValueError('没有找到原始脚本更新地址，拒绝修改')
    entries[index[0]] = line
    conf = ''.join(entries)
    # First matching rules win: route any 91short-related hostname directly,
    # independently of FINAL/leak policy. Other user sites keep suffix rules.
    direct = '\n'.join([SITE_MARK_START, 'DOMAIN-KEYWORD,91short,DIRECT'] +
                       [f'DOMAIN-SUFFIX,{h},DIRECT' for h in hosts if '91short' not in h] +
                       [SITE_MARK_END])
    existing_block = re.search(r'(?m)^' + re.escape(SITE_MARK_START) + r'\n[\s\S]*?^' + re.escape(SITE_MARK_END) + r'$', conf)
    if existing_block:
        conf = conf[:existing_block.start()] + direct + conf[existing_block.end():]
    else:
        anchor = 'DOMAIN-SUFFIX,x-91short.com,DIRECT'
        if conf.count(anchor) != 1:
            raise ValueError('找不到原 91short 直连规则，请勿手动编辑生成区')
        conf = conf.replace(anchor, direct, 1)
    # Update MITM on existing enormous hostname line; keep all user entries.
    rows = conf.splitlines(keepends=True)
    mi = [i for i, row in enumerate(rows) if row.startswith('hostname = ')]
    if len(mi) != 1:
        raise ValueError('MITM hostname 行异常')
    old_marker_idx = next((i for i, row in enumerate(rows) if row.startswith(MITM_MARKER)), None)
    previous = []
    if old_marker_idx is not None:
        previous = [h.strip() for h in rows[old_marker_idx][len(MITM_MARKER):].split(',') if h.strip()]
        rows.pop(old_marker_idx)
        mi = [i for i, row in enumerate(rows) if row.startswith('hostname = ')]
    i = mi[0]
    current = [h.strip() for h in rows[i][len('hostname = '):].split(',') if h.strip()]
    # Strip only additions previously marked as generated.
    current = [h for h in current if h not in previous]
    # Surge MITM Host List supports '*' anywhere within the hostname.
    # A keyword rule alone is NOT sufficient for rewriting encrypted HTTPS.
    additions = ['*91short*'] if '*91short*' not in current else []
    for host in hosts:
        for part in (host, '*.' + host):
            if part not in current and part not in additions:
                additions.append(part)
    newline = '\n' if rows[i].endswith('\n') else ''
    rows[i] = 'hostname = ' + ', '.join(current + additions) + newline
    rows.insert(i, MITM_MARKER + ' ' + ', '.join(additions) + '\n')
    return ''.join(rows)


def update_js(script, hosts):
    other = [host for host in hosts if '91short' not in host]
    keyword = r'[a-z0-9.-]*91short[a-z0-9.-]*'
    if other:
        group = '|'.join(re.escape(host) for host in other)
        regexp = r'^(?:' + keyword + r'|(?:[a-z0-9-]+\.)*(?:' + group + r'))$'
    else:
        regexp = r'^(?:' + keyword + r')$'
    new_outer = '    var domain = /' + regexp + '/i; ' + HOST_PATTERN_MARK
    old_outer = re.compile(r'(?m)^    var domain = /.*?/i;(?: ' + re.escape(HOST_PATTERN_MARK) + r')?$')
    script, count = old_outer.subn(lambda _: new_outer, script)
    if count != 1:
        raise ValueError('JS 主域名检查不唯一，拒绝修改')
    # v17 unified scanner inherits the injected host; there is no v9 UI controller.
    # Do not regenerate a legacy click-to-open scan controller.
    # The v8 blocking style is designed only for 91short. Do not hide similarly
    # named elements on unrelated future sites.
    # Keep vendor CSS exclusive to its actual x-91short.com domain.
    # For other domains merely containing 91short, enable the existing
    # auto-hide scanner and keep original navigation/feedback resources.
    check = r"    var isOriginal91short = /(?:^|\.)x-91short\.com$/i.test(hostname);"
    if script.count(check) != 1:
        raise ValueError('x-91short.com 专属 CSS 判断结构改变，请人工检查')
    if 'var isAny91short' not in script:
        script = script.replace(check, check + "\n    var isAny91short = hostname.indexOf('91short') !== -1;", 1)
    if script.count('      unifiedScanner,') != 1:
        raise ValueError('v17 统一自动扫描器注入位置改变，请人工检查')

    if 'var unifiedScanner = String.raw`' not in script:
        raise ValueError('缺少 v17 统一扫描器，禁止从旧版意外重新生成')
    return script


def main():
    hosts = read_hosts()
    conf_old = CONFIG.read_text(encoding='utf-8')
    js_old = JS.read_text(encoding='utf-8')
    js_new = update_js(js_old, hosts)
    conf_new = update_config(conf_old, hosts, js_new)
    CONFIG.write_text(conf_new, encoding='utf-8')
    JS.write_text(js_new, encoding='utf-8')
    print('网站清单同步完成（' + ', '.join(hosts) + '）')

if __name__ == '__main__':
    main()
