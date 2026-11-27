"""Update the Surge module reference catalog. No third-party code is executed."""
import argparse
import concurrent.futures
import hashlib
import html
import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
PORT_BASE = "https://raw.githubusercontent.com/zwjtano/kelee-loon-surge-modules/master/"
EARLY = "https://raw.githubusercontent.com/QingRex/LoonKissSurge/main/Surge/"
ALLOWED = {"raw.githubusercontent.com", "github.com", "release-assets.githubusercontent.com",
           "objects.githubusercontent.com", "cdn.jsdelivr.net", "testingcf.jsdelivr.net",
           "fastly.jsdelivr.net", "gist.githubusercontent.com"}
SECTIONS = {"Rule", "URL Rewrite", "Header Rewrite", "Body Rewrite", "Map Local",
            "MITM", "Script", "General", "Host", "Panel", "DNS", "WireGuard"}
POLICY_EXCLUSIONS = {
    "Spotify_remove_ads": "包含账户配置处理，未作为普通广告规则选用",
    "TestFlightRegionUnlock": "按既有偏好略过 Apple 增强",
    "AppleWeatherEnhancer": "按既有偏好略过 Apple 增强",
    "Auto_Join_TF": "按既有偏好略过 TestFlight 自动加入",
}
STATES = {"ok": "规则文件可读", "pending": "需确认", "bad": "异常", "skip": "未选用", "gone": "已下架"}
SAFE_STEM = re.compile(r"[\w.+ -]{1,160}\Z", re.UNICODE)

def load_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def digest(data):
    return hashlib.sha256(data).hexdigest()

def checked_url(url):
    try:
        parts = urllib.parse.urlsplit(url)
        return (parts.scheme == "https" and parts.hostname in ALLOWED and parts.port in (None,443)
                and not parts.username and not parts.password and not any(x in url for x in "\r\n\t\\"))
    except ValueError:
        return False

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not checked_url(newurl):
            raise ValueError("redirect")
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def fetch(url, module):
    if not checked_url(url):
        return ("源站未批量测", b"")
    limit = 2 * 1024 * 1024 if module else 512
    request = urllib.request.Request(url, headers={"User-Agent": "Surge-module-link-check/1.0"})
    try:
        with urllib.request.build_opener(SafeRedirect()).open(request, timeout=12) as response:
            data = response.read(limit + 1)
            mime = response.headers.get_content_type()
            if response.status not in (200, 206):
                return ("HTTP " + str(response.status), b"")
            if not data.strip() or mime == "text/html" or data.lstrip().lower().startswith((b"<!doctype html", b"<html")):
                return ("无内容或返回网页", b"")
            if module and len(data) > limit:
                return ("文件过大，待核对", b"")
            return ("可读", data)
    except urllib.error.HTTPError as exc:
        return ("HTTP " + str(exc.code), b"")
    except (OSError, ValueError, TimeoutError, urllib.error.URLError):
        return ("连接或重定向待复查", b"")

def batch(urls, module):
    ordered = sorted(set(urls))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        return dict(zip(ordered, pool.map(lambda url: fetch(url, module), ordered)))

def sections_and_dependencies(data):
    text = data.decode("utf-8-sig")
    section = ""
    active = set()
    dep = set()
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith(("#",";","//")):
            continue
        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1]
            continue
        if section not in SECTIONS:
            continue
        active.add(section)
        if section == "Script" or section == "Map Local":
            for url in re.findall(r'(?:script-path|data-path)\s*=\s*["\']?(https?://[^\s,"\']+)', line, flags=re.I):
                dep.add(url)
        if section == "Rule":
            m = re.match(r"(?:RULE-SET|DOMAIN-SET)\s*,\s*(https?://[^,\s]+)", line, re.I)
            if m:
                dep.add(m[1])
    return sorted(active), dep

def module_info(data):
    try:
        sections, dep = sections_and_dependencies(data)
    except UnicodeDecodeError:
        return "无法解码", [], set()
    if not (set(sections) - {"MITM"}):
        return "没有有效规则段", sections, dep
    return "可读", sections, dep

def read_profile(path):
    if not path or not path.is_file():
        return set()
    refs = set()
    for line in path.read_text("utf-8-sig").splitlines():
        if line.strip().startswith("#!include "):
            refs.update(u.strip() for u in line.strip()[10:].split(","))
    return refs

def load_records(root):
    source_file = root / "conversion-report.json"
    if source_file.is_symlink() or source_file.stat().st_size > 8_000_000:
        raise ValueError("目录索引无效")
    report = load_json(source_file)
    if not isinstance(report, list) or not report:
        raise ValueError("上游返回了空目录或错误格式，保留上次核对表")
    records = {}
    for row in report:
        title = row["name"].strip()
        src = urllib.parse.urlsplit(row["source"])
        stem = Path(urllib.parse.unquote(src.path)).stem
        if not SAFE_STEM.fullmatch(stem) or not title or len(title)>220 or stem in records:
            raise ValueError("目录的模块标识无效或重复")
        rel = row.get("output") or ""
        if rel:
            parts = Path(rel).parts
            if len(parts)!=2 or parts[0]!="modules" or not parts[1].endswith(".sgmodule") or not SAFE_STEM.fullmatch(Path(parts[1]).stem):
                raise ValueError("目录模块路径无效")
        records[stem] = (title, row.get("status",""), rel)
    return records

def icon_label(url):
    if url.startswith(EARLY):
        return "早期 Surge 移植"
    return "同一模块地址"

def excluded(stem, title):
    if "签到" in title or re.search(r'\bbeta\b', title, re.I):
        return "按既有偏好略过签到或测试版"
    if re.search(r"(?:破解|伪造|解锁.{0,6}(?:会员|付费|订阅)|(?:会员|付费|订阅).{0,6}(?:解锁|绕过))",title,re.I):
        return "涉及付费授权，未作为普通模块选用"
    return POLICY_EXCLUSIONS.get(stem)

def severity(status):
    if status == "可读":
        return 0
    if status in {"HTTP 404","HTTP 410","没有有效规则段","上游没有该文件","无内容或返回网页","无法解码"}:
        return 2
    return 1

def text_url(url):
    p = urllib.parse.urlsplit(url)
    if p.scheme != "https" or p.username or p.password or p.query or p.fragment:
        return ""
    return url if p.hostname in ALLOWED else ""

def safe_md(value):
    value = " ".join(str(value).split())
    value = html.escape(value, quote=False)
    return re.sub(r'([\\|\[\]*_`#!])',r'\\\1',value)

def link(url, label):
    if not url:
        return safe_md(label)
    target = urllib.parse.quote(url, safe=":/%~+@._-")
    return "["+safe_md(label)+"]("+target+")"

def list_sources(stem, title, rel, overrides, v5refs, count):
    choices = list(overrides.get(stem,[]))
    if rel:
        choices.append({"url": PORT_BASE+urllib.parse.quote(rel), "kind":"公开 Surge 移植", "author":"zwjtano（移植）"})
    known = {r["url"] for r in choices}
    known.update(v5refs.get(stem,[]))
    if count[title]==1:
        known.add(EARLY+urllib.parse.quote(title)+".sgmodule")
    return choices, known

def prepare(root, repo_refs, local_refs, previous):
    records = load_records(root)
    overrides = load_json(TOOLS / "kelee_sources.json")
    v5file = TOOLS / "kelee_v5_refs.json"
    v5refs = load_json(v5file) if v5file.is_file() else {}
    count = Counter(title for title,_,_ in records.values())
    plans = {}
    bodies = {}
    external = set()
    for stem,(title,upstream,rel) in records.items():
        choices,known = list_sources(stem,title,rel,overrides,v5refs,count)
        last = previous.get("rows", {}).get(stem, {})
        known.update(s["url"] for s in last.get("sources", []) if text_url(s["url"]))
        known.update(u for u in last.get("former_urls", []) if text_url(u))
        registry = set(v5refs.get(stem,[])) if local_refs is None else local_refs
        refs = {"仓库": sorted(repo_refs & known), "v5":sorted(registry & known)}
        skip = excluded(stem, title)
        plans[stem] = (title,upstream,rel,choices,refs,skip)
        if skip:
            continue
        if rel:
            uri = PORT_BASE + urllib.parse.quote(rel)
            path = root / rel
            if upstream != "ok":
                bodies[uri] = ("移植方报告 "+str(upstream)[:40],b"")
            elif path.is_symlink() or path.parent.is_symlink() or not path.is_file():
                bodies[uri] = ("上游没有该文件",b"")
            elif path.stat().st_size>2_097_152:
                bodies[uri] = ("文件过大，待核对",b"")
            else:
                bodies[uri] = ("可读",path.read_bytes())
        external.update(x["url"] for x in choices)
        external.update(refs["v5"] + refs["仓库"])
    bodies.update(batch(external-bodies.keys(), True))
    info = {}
    deps = set()
    for uri,(status,data) in bodies.items():
        sections,related = [],set()
        if status == "可读":
            status,sections,related = module_info(data)
        info[uri] = (status,sections,related,digest(data) if data else "")
        deps.update(related)
    checks = {u:v[0] for u,v in batch(deps,False).items()}
    return plans,info,checks

def source_result(spec,info,checks):
    url = spec["url"]
    status,sections,deps,sha = info[url]
    issues = {}
    level = severity(status)
    for dep in sorted(deps):
        check = checks[dep]
        if check!="可读":
            # Never publish opaque URL queries or restricted endpoints.
            public = text_url(dep)
            host = urllib.parse.urlsplit(dep).hostname or "外部"
            key = public or (host+"（站内依赖）")
            issues[key] = check
        level = max(level,severity(check))
    return {**spec,"module":status,"sections":sections,"sha256":sha,
            "dependencies":len(deps),"issues":issues,"level":level}

def make_rows(plans,info,checks):
    rows = {}
    for stem,(name,upstream,rel,choices,refs,skip) in sorted(plans.items()):
        item = {"id":stem,"name":name,"upstream":upstream,"output":rel,
                "profile_refs":{k:bool(v) for k,v in refs.items()}}
        if skip:
            rows[stem] = {**item, "state":"skip","note":skip,"selected":"","sources":[]}
            continue
        candidates = [source_result(s,info,checks) for s in choices]
        if candidates:
            # Prefer original author, unless a later source has a demonstrably healthier complete module.
            best = min(candidates,key=lambda s:(s["level"], s["module"] != "可读"))
            state = ("ok","pending","bad")[best["level"]]
            selected = best["url"] if best["module"]=="可读" and state!="bad" else ""
            note = best["module"]
            if best["issues"]:
                note += "，依赖" + "、".join(sorted(set(best["issues"].values())))
            if upstream != "ok" and not note.startswith("移植方报告"):
                note += "。同步目录报告 "+upstream
        else:
            state, selected, note = "bad","","未发布 Surge 文件"
        found = {s["url"] for s in candidates}
        active = set(refs["仓库"] + refs["v5"])
        for url in sorted(active-found):
            candidates.append(source_result({"url":url,"kind":icon_label(url),"author":""},info,checks))
        for s in candidates:
            s["profiles"] = [k for k,v in refs.items() if s["url"] in v]
        rows[stem] = {**item,"state":state,"note":note,"selected":selected,"sources":candidates}
    return rows

def compare(rows,previous,repo_refs,v5refs):
    old = previous.get("rows",{})
    changes = []
    for stem, row in rows.items():
        before = old.get(stem)
        if not before:
            if old:
                changes.append([stem,"新增"])
            continue
        if before==row:
            continue
        kinds=[]
        if before["state"]=="gone":
            kinds.append("重新收录")
        if before["name"]!=row["name"]:
            kinds.append("改名")
        if before["output"]!=row["output"] or before["selected"]!=row["selected"]:
            kinds.append("链接变更")
        if before["state"]!=row["state"] or before["note"]!=row["note"]:
            kinds.append("检查结果变化")
        if before.get("profile_refs")!=row["profile_refs"]:
            kinds.append("配置引用变化")
        changes.append([stem,"、".join(kinds or ["来源内容或依赖变化"])])
    for stem,before in old.items():
        if stem not in rows:
            if before["state"]!="gone":
                changes.append([stem,"上游目录移除"])
            former = before.get("former_urls") or [s["url"] for s in before.get("sources",[])]
            current = {"仓库":bool(repo_refs.intersection(former)), "v5":bool(v5refs.intersection(former))}
            if before["state"]=="gone" and current!=before["profile_refs"]:
                changes.append([stem,"下架项目的配置引用变化"])
            rows[stem]={**before,"state":"gone","note":"当前同步目录已移除","sources":[],"selected":"",
                        "former_urls":former,"profile_refs":current}
    return changes if changes else previous.get("changes",[])

def render(state):
    rows=state["rows"]
    counts=Counter(r["state"] for r in rows.values())
    lines=["# 可莉模块核对表","",f"本次公开目录 {sum(counts.values())-counts['gone']} 项。"
           +" · ".join(STATES[k]+" "+str(counts[k]) for k in STATES)+"。","",
           "「v5」是制作此更新包时的本机配置快照。「仓库」读取默认分支的 Surge.conf。使用状态只统计已识别的直接分段引用，手机独立安装的模块和内联脚本无法在此确认。","",
           "规则文件可读表示查到了有效的 Surge 配置段，所检查的外部依赖可以读取。选用链接优先原作者版本，其次采用公开移植。可莉站内脚本标为待确认，以免批量访问作者站点。点开下方异常明细可查看脚本 404。此表不代表 iPhone 实机去广告结果。","",
           "[插件中心](https://hub.kelee.one/) · [同步目录](https://github.com/zwjtano/kelee-loon-surge-modules/blob/master/conversion-report.json)",""]
    rev=state.get("catalog_commit","")
    if rev:
        lines+=["最近一次核对结果变化所用的[目录版本](https://github.com/zwjtano/kelee-loon-surge-modules/tree/"+rev+")。每日检查的实际运行时间见仓库 Actions。",""]
    if state["changes"]:
        lines+=["## 最近一次有变化的项目",""]
        for stem,msg in state["changes"]:
            lines.append("- "+safe_md(rows[stem]["name"])+" · "+safe_md(msg))
        lines.append("")
    lines+=["| 模块 | 可用性 | v5 直接引用 | 仓库直接引用 | 优先来源 |","|---|---|---|---|---|"]
    counts_by_name = Counter(r["name"] for r in rows.values())
    for r in sorted(rows.values(),key=lambda x:(x["name"],x["id"])):
        display = r["name"] if counts_by_name[r["name"]]==1 else r["name"]+"（"+r["id"]+"）"
        src=next((s for s in r["sources"] if s["url"]==r["selected"]),{})
        caption=" ".join(filter(None,[src.get("kind"),src.get("author")])) or "—"
        lines.append("| "+" | ".join([safe_md(display),STATES[r["state"]],
                      *("有" if r["profile_refs"][k] else "未识别" for k in ("v5","仓库")),
                      link(r["selected"],caption)])+" |")
    lines+=["","## 需要留意的来源",""]
    for r in sorted(rows.values(),key=lambda x:(x["name"],x["id"])):
        for s in r["sources"]:
            if s["level"]==0: continue
            extra="、".join(safe_md(k.rsplit("/",1)[-1])+" "+safe_md(v) for k,v in s["issues"].items())
            tags="、".join(s["profiles"]) or "候选"
            lines.append("- "+safe_md(r["name"])+"（"+tags+"） "+link(s["url"],s["kind"])+" · "+safe_md(s["module"])+(" · "+extra if extra else ""))
        if not r["sources"]:
            lines.append("- "+safe_md(r["name"])+" · "+safe_md(r["note"]))
    lines+=["","各模块的来源、匹配到的配置及核对结果见 [status.json](status.json)。",""]
    return "\n".join(lines)

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--catalog-root",type=Path,required=True)
    cli.add_argument("--output",type=Path,required=True)
    cli.add_argument("--profile",type=Path)
    cli.add_argument("--v5-profile",type=Path)
    args=cli.parse_args()
    previous_path=args.output/"status.json"
    previous=load_json(previous_path) if previous_path.is_file() else {}
    refs=read_profile(args.v5_profile) if args.v5_profile is not None else None
    repo_refs = read_profile(args.profile)
    plans,info,checks=prepare(args.catalog_root,repo_refs,refs,previous)
    rows=make_rows(plans,info,checks)
    saved = TOOLS/"kelee_v5_refs.json"
    v5refs = refs if refs is not None else {u for values in (load_json(saved) if saved.is_file() else {}).values() for u in values}
    changes=compare(rows,previous,repo_refs,v5refs)
    state={"format":1,"changes":changes,"rows":dict(sorted(rows.items()))}
    rev = previous.get("catalog_commit","")
    if previous.get("rows") != rows or not rev:
        result = subprocess.run(["git","-C",str(args.catalog_root),"rev-parse","--verify","HEAD"],
                                capture_output=True,text=True,check=False)
        if result.returncode==0 and re.fullmatch(r"[0-9a-f]{40}",result.stdout.strip()):
            rev = result.stdout.strip()
    state["catalog_commit"] = rev
    contents={"index.md":render(state),"status.json":json.dumps(state,ensure_ascii=False,indent=2)+"\n"}
    args.output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=args.output) as tmp:
        for name,data in contents.items():
            (Path(tmp)/name).write_text(data,encoding="utf-8")
        for name in contents:
            os.replace(Path(tmp)/name,args.output/name)
    print("已核对",len(plans),"项。")

if __name__=="__main__":
    main()
