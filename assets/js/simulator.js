// リリースごとの差分は assets/data/releases/*.json で管理する

let data;
let GROUPS = [];
let OFFICIAL_BONUS_TEXT = {};

const state = {
  selectedStoreId: "",
  counts: {},
  activeStoreOrder: [],
  openGroups: {},
  openOfficialBonus: {},
  openBonusTotal: false,
  openBonusTypes: {},
  listMode: false,
  savedOpenGroups: {},
  savedOpenOfficialBonus: {}
};

function countKey(storeId, groupId, formatId){
  return `${storeId}__${groupId}__${formatId}`;
}

function groupOpenKey(storeId, groupId){
  return `${storeId}__${groupId}`;
}

function yen(value){
  return `¥${Number(value || 0).toLocaleString()}`;
}

function getReleaseId(){
  return document.body.dataset.releaseId || "1st_single";
}

async function load(){
  const releaseId = getReleaseId();
  data = await fetch(`./assets/data/releases/${releaseId}.json`).then(r => r.json());
  GROUPS = data.campaignGroups || [];
  OFFICIAL_BONUS_TEXT = data.officialBonusText || {};

  const notice = document.getElementById("releaseNotice");
  if(notice && data.notice){
    notice.innerHTML = data.notice.replace("。", "。<br>");
  }

  initStoreSelect();
  bindStaticEvents();
  render();
  update();
}

function bindStaticEvents(){
  document.getElementById("store").addEventListener("change", e => {
    state.selectedStoreId = e.target.value;
    state.openGroups = {};
    state.openOfficialBonus = {};
    state.listMode = false;
    updateListModeButton();
    render();
  });

  document.getElementById("bonusTotalToggle").addEventListener("click", () => {
    state.openBonusTotal = !state.openBonusTotal;
    renderBonusSummary(calc().bonuses);
  });

  document.getElementById("listModeButton").addEventListener("click", toggleListMode);
  document.getElementById("clearAllButton").addEventListener("click", clearAll);
}

function initStoreSelect(){
  const select = document.getElementById("store");
  select.innerHTML = "";

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "購入場所を選択してください";
  select.appendChild(blank);

  (data.stores || []).forEach(store => {
    const option = document.createElement("option");
    option.value = store.id;
    option.textContent = store.name;
    select.appendChild(option);
  });

  state.selectedStoreId = "";
  select.value = "";
}

function getVisibleGroups(storeId){
  return GROUPS.filter(group => (group.storeIds || []).includes(storeId));
}

function getFormatsForGroup(storeId, group){
  return (data.formats || []).filter(format => {
    if(!(group.formatIds || []).includes(format.id)) return false;
    if(format.officialOnly && storeId !== "official") return false;
    return true;
  });
}

function getFormatName(formatId){
  return (data.formats || []).find(format => format.id === formatId)?.name || formatId;
}

function hasStoreCount(storeId){
  return Object.entries(state.counts).some(([key, value]) => {
    const [targetStoreId] = key.split("__");
    return targetStoreId === storeId && Number(value || 0) > 0;
  });
}

function hasGroupCount(storeId, groupId){
  return Object.entries(state.counts).some(([key, value]) => {
    const [targetStoreId, targetGroupId] = key.split("__");
    return targetStoreId === storeId && targetGroupId === groupId && Number(value || 0) > 0;
  });
}

function refreshActiveStoreOrder(){
  state.activeStoreOrder = state.activeStoreOrder.filter(storeId => hasStoreCount(storeId));
}

function rememberStoreOrder(storeId){
  if(hasStoreCount(storeId) && !state.activeStoreOrder.includes(storeId)){
    state.activeStoreOrder.push(storeId);
  }
  refreshActiveStoreOrder();
}

function getRenderedStores(){
  refreshActiveStoreOrder();

  const ids = state.listMode
    ? [...state.activeStoreOrder]
    : [
        state.selectedStoreId,
        ...state.activeStoreOrder.filter(id => id !== state.selectedStoreId)
      ].filter(Boolean);

  return ids
    .map(id => (data.stores || []).find(store => store.id === id))
    .filter(Boolean);
}

function render(){
  updateListModeButton();
  const root = document.getElementById("cards");
  root.innerHTML = "";

  const stores = getRenderedStores();
  if(stores.length === 0){
    root.innerHTML = `<div class="empty-select">購入場所を選択すると、入力カードが表示されます。</div>`;
    return;
  }

  stores.forEach(store => {
    root.appendChild(createStoreCard(store));
  });
}

function createStoreCard(store){
  const storeCard = document.createElement("div");
  storeCard.className = "card store-card";
  storeCard.dataset.storeId = store.id;

  const title = document.createElement("div");
  title.className = "card-title";
  title.innerHTML = `<span>${store.name}</span><button type="button" class="clear-btn clear-store">このショップをクリア</button>`;
  title.querySelector("button").addEventListener("click", () => clearStore(store.id));
  storeCard.appendChild(title);

  if(hasStoreCount(store.id)){
    storeCard.appendChild(createEnteredSummary(store));
  }

  if(state.listMode){
    return storeCard;
  }

  if(store.setBonus){
    const setBonus = document.createElement("div");
    setBonus.className = "set-bonus set-bonus-store";
    setBonus.textContent = `3形態セット特典：${store.setBonus}`;
    storeCard.appendChild(setBonus);
  }

  if(store.id === "official"){
    storeCard.appendChild(createOfficialBonusBox(store));
  }

  getVisibleGroups(store.id).forEach(group => {
    storeCard.appendChild(createPurchaseGroup(store, group));
  });

  return storeCard;
}

function createOfficialBonusBox(store){
  const officialNote = document.createElement("div");
  officialNote.className = "official-bonus-box";

  const officialButton = document.createElement("button");
  officialButton.type = "button";
  officialButton.className = "accordion-title official-bonus-title";
  officialButton.textContent = "▼ KO1KEYZ OFFICIAL STORE特典";

  const officialBody = document.createElement("div");
  officialBody.className = "accordion-body official-bonus-body";
  if(!state.openOfficialBonus[store.id]) officialBody.classList.add("hidden");
  officialBody.innerHTML = `
    <ul>
      <li>3形態セット：${(OFFICIAL_BONUS_TEXT.set_3 || []).join(" / ")}</li>
      <li>初回限定盤A：${(OFFICIAL_BONUS_TEXT.limited_a || [""])[0]}</li>
      <li>初回限定盤B：${(OFFICIAL_BONUS_TEXT.limited_b || [""])[0]}</li>
      <li>通常盤：${(OFFICIAL_BONUS_TEXT.regular || [""])[0]}</li>
      <li>FC限定ソロジャケット盤：${(OFFICIAL_BONUS_TEXT.solo_jacket || [""])[0]}</li>
    </ul>
  `;

  officialButton.addEventListener("click", () => {
    state.openOfficialBonus[store.id] = !state.openOfficialBonus[store.id];
    render();
  });

  officialNote.appendChild(officialButton);
  officialNote.appendChild(officialBody);
  return officialNote;
}

function createPurchaseGroup(store, group){
  const groupEl = document.createElement("div");
  groupEl.className = "purchase-group";

  const groupButton = document.createElement("button");
  groupButton.type = "button";
  groupButton.className = "accordion-title group-title";
  const groupCountBadge = hasGroupCount(store.id, group.id) ? `<span class="mini-badge">入力あり</span>` : "";
  groupButton.innerHTML = `<span>${group.title} ${groupCountBadge}</span><button type="button" class="clear-btn clear-group">クリア</button>`;

  const groupBody = document.createElement("div");
  groupBody.className = "accordion-body";
  if(!state.openGroups[groupOpenKey(store.id, group.id)]){
    groupBody.classList.add("hidden");
  }

  groupButton.addEventListener("click", e => {
    if(e.target.closest(".clear-btn")) return;
    const key = groupOpenKey(store.id, group.id);
    state.openGroups[key] = !state.openGroups[key];
    render();
  });

  groupButton.querySelector(".clear-group").addEventListener("click", () => clearGroup(store.id, group.id));

  getFormatsForGroup(store.id, group).forEach(format => {
    groupBody.appendChild(createProductRow(store, group, format));
  });

  groupEl.appendChild(groupButton);
  groupEl.appendChild(groupBody);
  return groupEl;
}

function createProductRow(store, group, format){
  const key = countKey(store.id, group.id, format.id);
  if(state.counts[key] === undefined) state.counts[key] = 0;

  const row = document.createElement("div");
  row.className = "row product-row";

  const label = document.createElement("div");
  label.className = "product-label";
  label.innerHTML = `<strong>${format.name}</strong><span>${yen(format.price)} / ${format.cdCount}枚</span>`;

  const controls = document.createElement("div");
  controls.className = "qty-controls";

  const minus = document.createElement("button");
  minus.type = "button";
  minus.className = "qty-btn";
  minus.textContent = "−";

  const input = document.createElement("input");
  input.className = "qty-input";
  input.type = "number";
  input.min = "0";
  input.value = state.counts[key];

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "qty-btn";
  plus.textContent = "+";

  minus.addEventListener("click", () => setCount(key, store.id, Math.max(0, Number(state.counts[key] || 0) - 1)));
  plus.addEventListener("click", () => setCount(key, store.id, Number(state.counts[key] || 0) + 1));
  input.addEventListener("input", () => setCountFromInput(key, store.id, Math.max(0, Number(input.value || 0))));

  controls.appendChild(minus);
  controls.appendChild(input);
  controls.appendChild(plus);
  row.appendChild(label);
  row.appendChild(controls);
  return row;
}

function createEnteredSummary(store){
  const summary = document.createElement("div");
  summary.className = "entered-summary";

  const lines = [];
  Object.entries(state.counts).forEach(([key, value]) => {
    const count = Number(value || 0);
    if(count <= 0) return;
    const [storeId, groupId, formatId] = key.split("__");
    if(storeId !== store.id) return;
    const group = GROUPS.find(g => g.id === groupId);
    lines.push(`${group?.label || groupId}　${getFormatName(formatId)} ×${count}`);
  });

  summary.innerHTML = `<strong>🛒</strong>${lines.map(line => `<div>${line}</div>`).join("")}`;
  return summary;
}

function setCount(key, storeId, value){
  state.counts[key] = value;
  rememberStoreOrder(storeId);
  update();
  render();
}

function setCountFromInput(key, storeId, value){
  state.counts[key] = value;
  rememberStoreOrder(storeId);
  update();
  updateEnteredSummaries();
}

function updateEnteredSummaries(){
  document.querySelectorAll(".store-card").forEach(card => {
    const storeId = card.dataset.storeId;
    const oldSummary = card.querySelector(".entered-summary");

    if(hasStoreCount(storeId)){
      const newSummary = createEnteredSummary((data.stores || []).find(store => store.id === storeId));
      if(oldSummary){
        oldSummary.replaceWith(newSummary);
      }else{
        const title = card.querySelector(".card-title");
        title.insertAdjacentElement("afterend", newSummary);
      }
    }else if(oldSummary){
      oldSummary.remove();
    }
  });
}

function clearAll(){
  state.counts = {};
  state.activeStoreOrder = [];
  state.selectedStoreId = "";
  state.openGroups = {};
  state.openOfficialBonus = {};
  state.openBonusTypes = {};
  state.listMode = false;
  state.savedOpenGroups = {};
  state.savedOpenOfficialBonus = {};
  document.getElementById("store").value = "";
  render();
  update();
}

function clearStore(storeId){
  Object.keys(state.counts).forEach(key => {
    const [targetStoreId] = key.split("__");
    if(targetStoreId === storeId) state.counts[key] = 0;
  });
  refreshActiveStoreOrder();
  render();
  update();
}

function clearGroup(storeId, groupId){
  Object.keys(state.counts).forEach(key => {
    const [targetStoreId, targetGroupId] = key.split("__");
    if(targetStoreId === storeId && targetGroupId === groupId) state.counts[key] = 0;
  });
  refreshActiveStoreOrder();
  render();
  update();
}

function updateListModeButton(){
  const button = document.getElementById("listModeButton");
  if(button){
    button.textContent = state.listMode ? "入力に戻る" : "一覧を表示";
  }
}

function toggleListMode(){
  if(!state.listMode){
    state.savedOpenGroups = { ...state.openGroups };
    state.savedOpenOfficialBonus = { ...state.openOfficialBonus };
    state.openGroups = {};
    state.openOfficialBonus = {};
    state.listMode = true;
  }else{
    state.openGroups = { ...state.savedOpenGroups };
    state.openOfficialBonus = { ...state.savedOpenOfficialBonus };
    state.listMode = false;
  }
  render();
  update();
}

function calc(){
  const result = {
    price: 0,
    cd: 0,
    ec1: 0,
    ec2: 0,
    wBonus: 0,
    serial: 0,
    bonuses: {}
  };

  for(const key in state.counts){
    const count = Number(state.counts[key] || 0);
    if(count <= 0) continue;

    const [storeId, groupId, formatId] = key.split("__");
    const store = (data.stores || []).find(s => s.id === storeId);
    const group = GROUPS.find(g => g.id === groupId);
    const format = (data.formats || []).find(f => f.id === formatId);
    if(!store || !group || !format) continue;

    const cdCount = format.cdCount * count;

    result.price += format.price * count;
    result.cd += cdCount;
    if(group.ec1) result.ec1 += cdCount;
    if(group.ec2) result.ec2 += cdCount;
    if(group.wBonus) result.wBonus += cdCount;
    if(group.serial) result.serial += cdCount;

    if(format.id === "set_3" && store.setBonus){
      addStoreSetBonus(result.bonuses, store, count);
    }

    if(store.id === "official"){
      addOfficialBonus(result.bonuses, store, format.id, count);
    }
  }

  return result;
}

function addBonus(bonuses, typeName, detailName, count){
  if(!bonuses[typeName]){
    bonuses[typeName] = { total: 0, details: {} };
  }
  bonuses[typeName].total += count;
  bonuses[typeName].details[detailName] = (bonuses[typeName].details[detailName] || 0) + count;
}

function addStoreSetBonus(bonuses, store, count){
  const bonusName = store.setBonus;
  const detailName = `${store.name}　${bonusName}`;
  if(bonusName.includes("トレカ")) addBonus(bonuses, "トレカ", detailName, count);
  else if(bonusName.includes("フォンタブ")) addBonus(bonuses, "フォンタブ", detailName, count);
  else if(bonusName.includes("BOX") || bonusName.includes("収納")) addBonus(bonuses, "収納BOX", detailName, count);
  else if(bonusName.includes("生写真")) addBonus(bonuses, "生写真", detailName, count);
  else if(bonusName.includes("アクリル")) addBonus(bonuses, "アクリルグッズ", detailName, count);
  else if(bonusName.includes("ポスター")) addBonus(bonuses, "ポスター", detailName, count);
  else addBonus(bonuses, "その他", detailName, count);
}

function addOfficialBonus(bonuses, store, formatId, count){
  if(formatId === "set_3"){
    (OFFICIAL_BONUS_TEXT.set_3 || []).forEach(name => addBonus(bonuses, "トレカ", `${store.name}　${name}`, count));
    return;
  }

  if(formatId === "limited_a") addBonus(bonuses, "トレカ", `${store.name}　${(OFFICIAL_BONUS_TEXT.limited_a || [""])[0]}`, count);
  if(formatId === "limited_b") addBonus(bonuses, "トレカ", `${store.name}　${(OFFICIAL_BONUS_TEXT.limited_b || [""])[0]}`, count);
  if(formatId === "regular") addBonus(bonuses, "トレカ", `${store.name}　${(OFFICIAL_BONUS_TEXT.regular || [""])[0]}`, count);
  if(formatId === "solo_jacket") addBonus(bonuses, "トレカフレームクリアカード", `${store.name}　${(OFFICIAL_BONUS_TEXT.solo_jacket || [""])[0]}`, count);
}

function update(){
  const result = calc();

  document.getElementById("price").textContent = yen(result.price);
  document.getElementById("cd").textContent = result.cd;
  document.getElementById("ec1").textContent = result.ec1;
  document.getElementById("ec2").textContent = result.ec2;
  document.getElementById("wBonus").textContent = result.wBonus;
  document.getElementById("serial").textContent = result.serial;

  renderBonusSummary(result.bonuses);
}

function getBonusIcon(typeName){
  if(typeName.includes("トレカ")) return "🃏";
  if(typeName.includes("フォンタブ")) return "📱";
  if(typeName.includes("BOX") || typeName.includes("収納")) return "📦";
  if(typeName.includes("生写真")) return "📷";
  if(typeName.includes("アクリル")) return "✨";
  if(typeName.includes("ポスター")) return "📄";
  return "🎁";
}

function renderBonusSummary(bonuses){
  const total = Object.values(bonuses).reduce((sum, bonus) => sum + bonus.total, 0);
  document.getElementById("bonusTotal").textContent = `${total}個`;

  const body = document.getElementById("bonusTotalBody");
  body.innerHTML = "";
  body.classList.toggle("hidden", !state.openBonusTotal);

  if(total === 0){
    body.innerHTML = `<div class="empty bonus-indent">まだその他特典はありません</div>`;
    return;
  }

  Object.entries(bonuses).forEach(([typeName, bonus]) => {
    const block = document.createElement("div");
    block.className = "bonus-block bonus-indent";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "accordion-title bonus-title";
    btn.textContent = `▼ ${getBonusIcon(typeName)} ${typeName} ×${bonus.total}`;

    const detail = document.createElement("div");
    detail.className = "accordion-body bonus-detail bonus-detail-indent";
    if(!state.openBonusTypes[typeName]) detail.classList.add("hidden");

    Object.entries(bonus.details).forEach(([detailName, count]) => {
      const line = document.createElement("div");
      line.className = "bonus-line";
      line.innerHTML = `<div class="separator">━━━━━━━━━</div><div>${detailName} ×${count}</div>`;
      detail.appendChild(line);
    });

    btn.addEventListener("click", () => {
      state.openBonusTypes[typeName] = !state.openBonusTypes[typeName];
      renderBonusSummary(calc().bonuses);
    });

    block.appendChild(btn);
    block.appendChild(detail);
    body.appendChild(block);
  });
}

load().catch(error => {
  console.error(error);
  document.getElementById("cards").innerHTML = `<div class="empty-select">データを読み込めませんでした。Live Serverで開いているか確認してください。</div>`;
});
