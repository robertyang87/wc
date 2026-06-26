const state = {
  data: null,
  group: "all",
  position: "all",
  search: "",
  selectedCode: null,
  mobileView: "teams",
  lang: localStorage.getItem("wc2026-lang") === "en" ? "en" : "zh",
};

const $ = (selector) => document.querySelector(selector);
const layout = $(".layout");
const teamsPane = $("#teamsPane");
const detailPane = $("#detailPane");
const groupTabs = $("#groupTabs");
const positionTabs = $("#positionTabs");
const searchInput = $("#searchInput");
const playerDialog = $("#playerDialog");
const playerDialogBody = $("#playerDialogBody");
const sourceDialog = $("#sourceDialog");
const langButton = $("#langButton");

const I18N = {
  zh: {
    title: "世界杯2026 · 48队球员库",
    loading: "FIFA 官方名单加载中",
    sources: "来源",
    search: "搜索",
    searchPlaceholder: "球队 / 球员 / 俱乐部",
    all: "全部",
    group: "组",
    teams: "队",
    noMatches: "没有匹配的球队或球员",
    tryAnother: "换个关键词试试",
    backToTeams: "球队列表",
    fifaSquad: "FIFA 阵容页",
    fifaPublicPhotos: "FIFA公开照",
    players: "球员",
    avgAge: "平均年龄",
    roster: "球员名单",
    matchedPlayers: (count) => `${count} 名匹配球员 · 点击查看个人详细信息`,
    noPlayers: "没有匹配球员",
    headCoach: "主帅",
    birthdayAge: "生日 / 年龄",
    club: "俱乐部",
    heightWeight: "身高 / 体重",
    nationalTeamStats: "国家队数据",
    yearsOld: "岁",
    caps: "场",
    goals: "球",
    photoMissing: "FIFA未公开",
    sourceTitle: "数据说明",
    sourceIntro: "球队与球员名单来自 FIFA 官方公开 API 和 FIFA 官方 2026 世界杯 Squad List PDF。参考页用于分组、视觉信息结构和辅助元数据。",
    photoIntro: "球员照片只展示 FIFA API 当前返回的官方图片 URL；未返回图片的球员使用国家队颜色占位，不混用非官方图片。",
    sourceStamp: (count, date) => `${count} 名球员 · 数据生成 ${date}`,
    loadFailed: "数据加载失败",
    positions: {
      all: "全部",
      Goalkeeper: "门将",
      Defender: "后卫",
      Midfielder: "中场",
      Forward: "前锋",
    },
    sourceLabels: {
      "FIFA official squad PDF": "FIFA 官方 Squad List PDF",
      "FIFA public team/squad API": "FIFA 公开球队/阵容 API",
      "Reference visual/team intelligence page": "参考视觉/球队信息页",
      "FIFA official photos portal": "FIFA 官方照片门户",
    },
  },
  en: {
    title: "World Cup 2026 · 48-Team Player Database",
    loading: "Loading FIFA official squad data",
    sources: "Sources",
    search: "Search",
    searchPlaceholder: "Team / player / club",
    all: "All",
    group: "Group",
    teams: "teams",
    noMatches: "No matching teams or players",
    tryAnother: "Try another keyword",
    backToTeams: "Teams",
    fifaSquad: "FIFA squad page",
    fifaPublicPhotos: "FIFA public photos",
    players: "Players",
    avgAge: "Average age",
    roster: "Player roster",
    matchedPlayers: (count) => `${count} matching players · Tap to view player details`,
    noPlayers: "No matching players",
    headCoach: "Head coach",
    birthdayAge: "Birthday / age",
    club: "Club",
    heightWeight: "Height / weight",
    nationalTeamStats: "National team stats",
    yearsOld: "yrs",
    caps: "caps",
    goals: "goals",
    photoMissing: "Not public on FIFA",
    sourceTitle: "Data Notes",
    sourceIntro: "Teams and player rosters come from FIFA public APIs and the official FIFA World Cup 2026 Squad List PDF. The reference page is used for group structure, visual organization, and supporting metadata.",
    photoIntro: "Player photos show only the official image URLs currently returned by FIFA APIs. Players without a returned image use a team-color placeholder; non-official photos are not mixed in.",
    sourceStamp: (count, date) => `${count} players · Data generated ${date}`,
    loadFailed: "Failed to load data",
    positions: {
      all: "All",
      Goalkeeper: "Goalkeeper",
      Defender: "Defender",
      Midfielder: "Midfielder",
      Forward: "Forward",
    },
    sourceLabels: {
      "FIFA official squad PDF": "FIFA official squad PDF",
      "FIFA public team/squad API": "FIFA public team/squad API",
      "Reference visual/team intelligence page": "Reference visual/team intelligence page",
      "FIFA official photos portal": "FIFA official photos portal",
    },
  },
};

const POSITION_KEYS = ["Goalkeeper", "Defender", "Midfielder", "Forward"];

function t(key) {
  return I18N[state.lang][key];
}

function text(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function playerInitials(player) {
  const parts = player.name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function displayTeamName(team) {
  return team.nameZh || team.nameEn || team.code;
}

function displayPosition(player) {
  return I18N[state.lang].positions[player.position] || player.position || "-";
}

function sourceLabel(source) {
  return I18N[state.lang].sourceLabels[source.label] || source.label;
}

function formatDate(value) {
  const locale = state.lang === "zh" ? "zh-CN" : "en-US";
  return new Date(value).toLocaleString(locale);
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function filteredTeams() {
  const query = normalize(state.search);
  return state.data.teams.filter((team) => {
    if (state.group !== "all" && team.group !== state.group) return false;
    if (!query) return true;
    return [
      team.nameZh,
      team.nameEn,
      team.code,
      team.coach?.name,
      ...team.players.flatMap((p) => [p.name, p.shortName, p.club, p.position, p.positionZh]),
    ].some((value) => normalize(value).includes(query));
  });
}

function filteredPlayers(team) {
  const query = normalize(state.search);
  return team.players.filter((player) => {
    if (state.position !== "all" && player.position !== state.position) return false;
    if (!query) return true;
    return [player.name, player.shortName, player.club, player.position, player.positionZh, player.number]
      .some((value) => normalize(value).includes(query));
  });
}

function renderTabs() {
  const groupButtons = [["all", t("all")], ...Object.keys(state.data.groups).map((group) => [group, `${t("group")} ${group}`])];
  groupTabs.innerHTML = groupButtons.map(([key, label]) => (
    `<button class="pill ${state.group === key ? "is-active" : ""}" data-group="${key}" type="button">${escapeHtml(label)}</button>`
  )).join("");

  const positionButtons = [["all", I18N[state.lang].positions.all], ...POSITION_KEYS.map((key) => [key, I18N[state.lang].positions[key]])];
  positionTabs.innerHTML = positionButtons.map(([key, label]) => (
    `<button class="pill ${state.position === key ? "is-active" : ""}" data-position="${key}" type="button">${escapeHtml(label)}</button>`
  )).join("");
}

function teamRow(team) {
  return `
    <button class="team-row ${state.selectedCode === team.code ? "is-active" : ""}" data-team="${team.code}" type="button">
      <span class="flag" style="background-image:url('${team.flag}')"></span>
      <span>
        <span class="team-name">${escapeHtml(displayTeamName(team))} <span class="team-meta">${team.code}</span></span>
        <span class="team-meta">${team.confederation}</span>
      </span>
      <span class="count-chip">${team.players.length}</span>
    </button>
  `;
}

function renderTeams() {
  const teams = filteredTeams();
  if (!teams.length) {
    teamsPane.innerHTML = `<div class="group-block empty">${t("noMatches")}</div>`;
    detailPane.innerHTML = `<div class="empty">${t("tryAnother")}</div>`;
    return;
  }

  if (!teams.some((team) => team.code === state.selectedCode)) {
    state.selectedCode = teams[0].code;
  }

  const byGroup = new Map();
  for (const team of teams) {
    if (!byGroup.has(team.group)) byGroup.set(team.group, []);
    byGroup.get(team.group).push(team);
  }

  teamsPane.innerHTML = [...byGroup.entries()].map(([group, items]) => `
    <section class="group-block">
      <div class="group-head"><span>${t("group")} ${group}</span><span>${items.length} ${t("teams")}</span></div>
      ${items.map(teamRow).join("")}
    </section>
  `).join("");
}

function photoMarkup(player, team, large = false) {
  const photo = player.photo
    ? `<img src="${player.photo}" alt="${escapeHtml(player.name)} ${t("fifaPublicPhotos")}" loading="${large ? "eager" : "lazy"}">`
    : `<span class="initials">${escapeHtml(playerInitials(player))}</span><span class="photo-missing">${t("photoMissing")}</span>`;
  return `
    <div class="player-photo" style="--team-primary:${team.colors.primary};--team-secondary:${team.colors.secondary};--team-text:${team.colors.primaryText};">
      ${photo}
      <span class="number-badge">${player.number}</span>
    </div>
  `;
}

function playerCard(player, team) {
  return `
    <button class="player-card" data-player="${player.id}" type="button">
      ${photoMarkup(player, team)}
      <span class="player-info">
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span class="player-line">${escapeHtml(displayPosition(player))} · ${escapeHtml(text(player.club))}</span>
        <span class="player-line">${text(player.heightCm)}cm · ${text(player.caps)} ${t("caps")} · ${text(player.goals)} ${t("goals")}</span>
      </span>
    </button>
  `;
}

function renderDetail() {
  const team = state.data.teams.find((item) => item.code === state.selectedCode);
  if (!team) return;
  const players = filteredPlayers(team);
  const photos = team.players.filter((player) => player.photo).length;
  const ageCount = team.players.filter((player) => player.age).length;
  const avgAge = ageCount
    ? (team.players.reduce((sum, player) => sum + (player.age || 0), 0) / ageCount).toFixed(1)
    : "-";
  const mobileBack = isMobileLayout()
    ? `<button class="mobile-back" data-mobile-back type="button">‹ ${t("backToTeams")}</button>`
    : "";
  detailPane.innerHTML = `
    <section class="team-hero" style="background:linear-gradient(135deg, ${team.colors.primary}26, transparent 58%), #0d1117;">
      ${mobileBack}
      <span class="flag" style="background-image:url('${team.flag}')"></span>
      <div>
        <div class="kicker">${t("group")} ${team.group} · ${team.confederation} · Pot ${team.pot}</div>
        <h1 class="hero-title">${escapeHtml(displayTeamName(team))} <span class="team-meta">${team.code}</span></h1>
        <div class="hero-sub">${t("headCoach")} ${escapeHtml(team.coach?.name || "-")}</div>
        <div class="team-links">
          <a class="link-chip" href="${team.teamPageUrl}/squad" target="_blank" rel="noreferrer">${t("fifaSquad")}</a>
          <span class="link-chip">${t("fifaPublicPhotos")} ${photos}/${team.players.length}</span>
        </div>
      </div>
    </section>
    <section class="stats-grid">
      <div class="stat"><div class="stat-value">${team.players.length}</div><div class="stat-label">${t("players")}</div></div>
      <div class="stat"><div class="stat-value">${avgAge}</div><div class="stat-label">${t("avgAge")}</div></div>
      <div class="stat"><div class="stat-value">${photos}</div><div class="stat-label">${t("fifaPublicPhotos")}</div></div>
    </section>
    <section class="toolbar">
      <div>
        <h2>${t("roster")}</h2>
        <p>${t("matchedPlayers")(players.length)}</p>
      </div>
    </section>
    <section class="players-grid">
      ${players.map((player) => playerCard(player, team)).join("") || `<div class="empty">${t("noPlayers")}</div>`}
    </section>
  `;
}

function renderSources() {
  $("#sourceStamp").textContent = I18N[state.lang].sourceStamp(1248, formatDate(state.data.generatedAt));
  $("#sourceList").innerHTML = state.data.sources.map((source) => (
    `<li><a href="${source.url}" target="_blank" rel="noreferrer">${escapeHtml(sourceLabel(source))}</a></li>`
  )).join("");
}

function renderStaticText() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  document.title = t("title");
  $("#brandTitle").textContent = t("title");
  $("#sourceButton").textContent = t("sources");
  $("#searchLabel").textContent = t("search");
  searchInput.placeholder = t("searchPlaceholder");
  langButton.textContent = state.lang === "zh" ? "EN" : "中文";
  $("#sourceTitle").textContent = t("sourceTitle");
  $("#sourceIntro").textContent = t("sourceIntro");
  $("#photoIntro").textContent = t("photoIntro");
  groupTabs.setAttribute("aria-label", state.lang === "zh" ? "小组筛选" : "Group filter");
  positionTabs.setAttribute("aria-label", state.lang === "zh" ? "位置筛选" : "Position filter");
  teamsPane.setAttribute("aria-label", state.lang === "zh" ? "球队列表" : "Team list");
  detailPane.setAttribute("aria-label", state.lang === "zh" ? "球队详情" : "Team details");
}

function renderLayoutState() {
  layout.classList.toggle("is-team-view", state.mobileView === "teams");
  layout.classList.toggle("is-detail-view", state.mobileView === "detail");
  document.body.classList.toggle("mobile-team-view", state.mobileView === "teams");
  document.body.classList.toggle("mobile-detail-view", state.mobileView === "detail");
}

function render() {
  renderStaticText();
  renderSources();
  renderTabs();
  renderTeams();
  renderDetail();
  renderLayoutState();
}

function openPlayer(playerId) {
  const team = state.data.teams.find((item) => item.code === state.selectedCode);
  const player = team?.players.find((item) => item.id === playerId);
  if (!team || !player) return;
  playerDialogBody.innerHTML = `
    <section class="player-detail-hero">
      ${photoMarkup(player, team, true)}
      <div>
        <p class="kicker">${escapeHtml(displayTeamName(team))} · ${escapeHtml(displayPosition(player))}</p>
        <h2 class="detail-name">${escapeHtml(player.name)}</h2>
        <div class="detail-meta">#${player.number} · ${escapeHtml(player.shortName || player.name)}</div>
        <div class="detail-list">
          <div class="detail-item"><span>${t("birthdayAge")}</span><b>${text(player.birthDate)} · ${text(player.age)}${t("yearsOld")}</b></div>
          <div class="detail-item"><span>${t("club")}</span><b>${escapeHtml(text(player.club))}</b></div>
          <div class="detail-item"><span>${t("heightWeight")}</span><b>${text(player.heightCm)}cm · ${text(player.weightKg)}kg</b></div>
          <div class="detail-item"><span>${t("nationalTeamStats")}</span><b>${text(player.caps)} ${t("caps")} · ${text(player.goals)} ${t("goals")}</b></div>
        </div>
      </div>
    </section>
  `;
  playerDialog.showModal();
}

async function init() {
  renderStaticText();
  const response = await fetch("./data/teams.json?v=20260626-1");
  state.data = await response.json();
  state.selectedCode = state.data.teams[0]?.code;
  render();
}

groupTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-group]");
  if (!button) return;
  state.group = button.dataset.group;
  if (isMobileLayout()) state.mobileView = "teams";
  render();
});

positionTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-position]");
  if (!button) return;
  state.position = button.dataset.position;
  if (isMobileLayout()) state.mobileView = "detail";
  render();
});

teamsPane.addEventListener("click", (event) => {
  const button = event.target.closest("[data-team]");
  if (!button) return;
  state.selectedCode = button.dataset.team;
  if (isMobileLayout()) {
    state.mobileView = "detail";
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  render();
});

detailPane.addEventListener("click", (event) => {
  const backButton = event.target.closest("[data-mobile-back]");
  if (backButton) {
    state.mobileView = "teams";
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }
  const button = event.target.closest("[data-player]");
  if (!button) return;
  openPlayer(button.dataset.player);
});

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

langButton.addEventListener("click", () => {
  state.lang = state.lang === "zh" ? "en" : "zh";
  localStorage.setItem("wc2026-lang", state.lang);
  render();
});

window.addEventListener("resize", () => {
  if (!state.data) return;
  render();
});

$("#dialogClose").addEventListener("click", () => playerDialog.close());
$("#sourceButton").addEventListener("click", () => sourceDialog.showModal());
$("#sourceClose").addEventListener("click", () => sourceDialog.close());

init().catch((error) => {
  console.error(error);
  teamsPane.innerHTML = `<div class="empty">${t("loadFailed")}</div>`;
});
