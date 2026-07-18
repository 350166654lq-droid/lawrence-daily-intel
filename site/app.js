const state = {
  digest: null,
  filter: "all",
  query: "",
  archive: [],
};

const SOURCE_LABELS = {
  official: "官方 / 监管",
  pubmed: "PubMed",
  journal: "期刊",
  news: "专业媒体",
  youtube: "YouTube",
  x: "X / 早期信号",
  other: "公开来源",
};

const $ = (selector, root = document) => root.querySelector(selector);

function escapeText(value) {
  return String(value ?? "").trim();
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: includeTime ? "2-digit" : "long",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(date);
}

function cardMatches(item) {
  const laneMatch = state.filter === "all" || item.lane === state.filter;
  const haystack = [
    item.title_zh,
    item.original_title,
    item.fact,
    item.why_it_matters,
    item.interpretation,
    item.clinical_research_implication,
    item.source_name,
    item.topic,
  ].join(" ").toLowerCase();
  return laneMatch && (!state.query || haystack.includes(state.query));
}

function makeCard(item, index) {
  const node = $("#card-template").content.firstElementChild.cloneNode(true);
  node.dataset.lane = item.lane;
  node.dataset.search = JSON.stringify(item).toLowerCase();
  node.style.animationDelay = `${Math.min(index * 70, 350)}ms`;

  $(".card-number", node).textContent = String(index + 1).padStart(2, "0");
  $(".topic-badge", node).textContent = escapeText(item.topic);
  $(".source-type", node).textContent = SOURCE_LABELS[item.source_type] || SOURCE_LABELS.other;
  $(".published-at", node).textContent = formatDate(item.published_at);
  $(".confidence", node).textContent = `置信度 ${escapeText(item.confidence)}`;
  $(".card-title", node).textContent = escapeText(item.title_zh);
  $(".fact", node).textContent = escapeText(item.fact);
  $(".why", node).textContent = escapeText(item.why_it_matters);
  $(".interpretation", node).textContent = escapeText(item.interpretation);
  $(".implication", node).textContent = escapeText(item.clinical_research_implication);
  $(".evidence-grade", node).textContent = escapeText(item.evidence_grade);

  const sourceLink = $(".source-link", node);
  sourceLink.href = item.source_url;
  sourceLink.setAttribute("aria-label", `查看 ${escapeText(item.source_name)} 原始来源`);

  if (item.is_substantive_update && item.update_note) {
    const updateRow = $(".update-row", node);
    updateRow.hidden = false;
    $(".update-note", node).textContent = escapeText(item.update_note);
  }
  return node;
}

function renderDigest() {
  const digest = state.digest || { items: [] };
  const items = (digest.items || []).filter(cardMatches);
  const aiItems = items.filter((item) => item.lane === "ai_clinical");
  const neuroItems = items.filter((item) => item.lane === "neuro");
  const aiContainer = $("#ai-cards");
  const neuroContainer = $("#neuro-cards");
  aiContainer.replaceChildren(...aiItems.map(makeCard));
  neuroContainer.replaceChildren(...neuroItems.map(makeCard));

  $("#digest-date").textContent = digest.digest_date ? formatDate(`${digest.digest_date}T12:00:00+08:00`) : "等待首次更新";
  $("#editor-note").textContent = digest.editor_note || "今日简报尚未生成。";
  $("#item-count").textContent = String((digest.items || []).length).padStart(2, "0");
  $("#candidate-count").textContent = digest.candidate_count ?? "—";
  $("#generated-time").textContent = digest.generated_at ? formatDate(digest.generated_at, true) : "等待首次运行";
  $("#provider-label").textContent = digest.provider || "云端 GPT";
  $("#ai-count").textContent = aiItems.length;
  $("#neuro-count").textContent = neuroItems.length;

  const allEmpty = items.length === 0;
  $("#empty-state").hidden = !allEmpty;
  document.querySelectorAll("[data-lane-section]").forEach((section) => {
    const lane = section.dataset.laneSection;
    section.hidden = allEmpty || (state.filter !== "all" && state.filter !== lane) || (lane === "ai_clinical" ? aiItems.length === 0 : neuroItems.length === 0);
  });
}

async function loadDigest(path) {
  const response = await fetch(`${path}?v=${Date.now()}`);
  if (!response.ok) throw new Error(`无法读取 ${path}`);
  state.digest = await response.json();
  renderDigest();
  document.querySelectorAll(".archive-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.date === state.digest.digest_date);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderArchive() {
  const list = $("#archive-list");
  if (!state.archive.length) {
    const placeholder = document.createElement("p");
    placeholder.className = "archive-placeholder";
    placeholder.textContent = "首次更新后开始保留每日历史。";
    list.replaceChildren(placeholder);
    return;
  }
  const buttons = state.archive.map((digest) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "archive-item";
    button.dataset.date = digest.date;

    const strong = document.createElement("strong");
    strong.textContent = formatDate(`${digest.date}T12:00:00+08:00`);
    const count = document.createElement("span");
    count.textContent = digest.count;
    const small = document.createElement("small");
    small.textContent = digest.count ? "新信号" : "无合格新内容";
    button.append(strong, count, small);
    button.addEventListener("click", () => loadDigest(digest.path).catch(showError));
    return button;
  });
  list.replaceChildren(...buttons);
}

function showError(error) {
  console.error(error);
  $("#editor-note").textContent = "简报读取失败，请稍后刷新页面或查看云端运行状态。";
}

async function init() {
  try {
    const [latestResponse, archiveResponse] = await Promise.all([
      fetch(`data/latest.json?v=${Date.now()}`),
      fetch(`data/digests.json?v=${Date.now()}`),
    ]);
    if (!latestResponse.ok || !archiveResponse.ok) throw new Error("数据文件不可用");
    state.digest = await latestResponse.json();
    state.archive = (await archiveResponse.json()).digests || [];
    renderArchive();
    renderDigest();
  } catch (error) {
    showError(error);
  }

  document.querySelectorAll(".lane-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll(".lane-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      renderDigest();
    });
  });

  $("#search-input").addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderDigest();
  });
}

init();
