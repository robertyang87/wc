# 世界杯 2026 · 48 队球员库

一个面向手机和桌面浏览的 2026 世界杯 48 支球队球员资料网页。页面按球队分组展示阵容，支持搜索、分组筛选、位置筛选和中英文界面切换。

[English](#world-cup-2026--48-team-roster)

## 功能

- 48 支球队分组浏览，每队独立展示。
- 1248 名球员资料，包含号码、位置、俱乐部、出生日期、身高等信息。
- 使用 FIFA 官方公开数据与官方球员定妆照链接。
- 支持中文 / English 界面切换。
- 球员姓名、俱乐部名和国家名保留原始来源写法，不做机器翻译。
- 手机端采用两级页面：先看球队列表，点进球队后查看阵容，避免页面跳到底部。
- 桌面端采用左侧球队列表、右侧球队详情的分栏布局。

## 目录结构

```text
wc2026-rosters/
  index.html
  app.js
  styles.css
  assets/
    world-cup-2026-logo.png
  data/
    teams.json
  scripts/
    build_data.py
netlify.toml
```

## 本地查看

这是一个静态网页项目，可以直接打开：

```text
wc2026-rosters/index.html
```

也可以用任意静态服务器运行，例如：

```bash
python -m http.server 8000 -d wc2026-rosters
```

然后访问：

```text
http://localhost:8000
```

## 部署

项目已包含 `netlify.toml`：

```toml
[build]
  publish = "wc2026-rosters"
```

在 Netlify 中连接这个 GitHub 仓库后，发布目录会自动使用 `wc2026-rosters`。推送到 `main` 分支后，Netlify 可以自动重新部署。

## 数据说明

球员与球队数据来自 FIFA 官方公开接口，球员照片使用 FIFA 官方公开图片资源。项目不包含 Getty Images 或其它授权图库的抓取图片。

---

# World Cup 2026 · 48-Team Roster

A mobile-friendly and desktop-friendly static website for browsing all 48 teams and player rosters for the 2026 World Cup. Teams are separated by group and can be explored with search, group filters, position filters, and a Chinese / English UI switch.

[中文](#世界杯-2026--48-队球员库)

## Features

- Browse all 48 teams by group.
- 1248 player profiles with shirt number, position, club, birth date, height, and related details.
- Uses FIFA public official data and FIFA official player portrait URLs.
- Chinese / English interface switch.
- Player names, club names, and country names keep their original source spelling instead of being translated.
- Mobile layout uses a two-level flow: team list first, then team roster detail.
- Desktop layout uses a split view with team list on the left and team detail on the right.

## Project Structure

```text
wc2026-rosters/
  index.html
  app.js
  styles.css
  assets/
    world-cup-2026-logo.png
  data/
    teams.json
  scripts/
    build_data.py
netlify.toml
```

## Local Preview

This is a static website. You can open:

```text
wc2026-rosters/index.html
```

Or run any static server, for example:

```bash
python -m http.server 8000 -d wc2026-rosters
```

Then visit:

```text
http://localhost:8000
```

## Deployment

The repository includes `netlify.toml`:

```toml
[build]
  publish = "wc2026-rosters"
```

After connecting this GitHub repository to Netlify, the publish directory will be `wc2026-rosters`. Pushes to the `main` branch can trigger automatic deployments.

## Data Notes

Team and player data comes from FIFA public official APIs. Player portraits use FIFA public official image resources. This project does not include scraped images from Getty Images or other licensed image libraries.

