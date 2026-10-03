let state = JSON.parse(localStorage.getItem('roomBudgetCurrentState')) || { income: 0, items: [], nextId: 1 };

const incomeInput = document.getElementById('incomeInput');
const addItemBtn = document.getElementById('addItemBtn');
const itemsList = document.getElementById('itemsList');
const emptyState = document.getElementById('emptyState');
const sumIncome = document.getElementById('sumIncome');
const sumExpense = document.getElementById('sumExpense');
const sumBalance = document.getElementById('sumBalance');

const ICON_PENCIL = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20l1-4.2L15.5 5.3a1.5 1.5 0 0 1 2.1 0l1.1 1.1a1.5 1.5 0 0 1 0 2.1L8.2 19 4 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5 10 17l9-10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

function formatMoney(n){ return '฿' + (isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function saveCurrentState() { localStorage.setItem('roomBudgetCurrentState', JSON.stringify(state)); }

function formatDateTimeDMY(d) {
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear() + 543;
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const mins = String(dateObj.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

function updateSummary(){
  const totalExpense = state.items.reduce((sum, it) => sum + (it.amount || 0), 0);
  const balance = (state.income || 0) - totalExpense;
  sumIncome.textContent = formatMoney(state.income || 0);
  sumExpense.textContent = formatMoney(totalExpense);
  sumBalance.textContent = formatMoney(balance);
  sumBalance.classList.toggle('negative', balance < 0);
  
  renderPieChart();
}

function updateEmptyState(){ emptyState.classList.toggle('hidden', state.items.length > 0); }

function createRow(item, isNew = false){
  item.paid = item.paid || false;
  const row = document.createElement('div');
  row.className = 'item-row' + (item.paid ? ' is-paid' : '');
  row.dataset.id = item.id;

  row.innerHTML = `
    <input type="checkbox" class="mac-checkbox" title="มาร์คว่าจ่ายแล้ว" ${item.paid ? 'checked' : ''}>
    <div class="row-main">
      <span class="name-text"></span>
      <input type="text" class="name-input hidden">
    </div>
    <input type="number" class="amount-input" placeholder="0.00" inputmode="decimal" step="0.01">
    <div class="row-actions">
      <button type="button" class="icon-btn rename-btn" title="เปลี่ยนชื่อ">${ICON_PENCIL}</button>
      <button type="button" class="icon-btn delete-btn" title="ลบรายการ">${ICON_TRASH}</button>
    </div>
  `;

  const checkbox = row.querySelector('.mac-checkbox'); 
  const nameText = row.querySelector('.name-text');
  const nameInput = row.querySelector('.name-input');
  const amountInput = row.querySelector('.amount-input');
  const renameBtn = row.querySelector('.rename-btn');
  const deleteBtn = row.querySelector('.delete-btn');

  nameText.textContent = item.name;
  nameInput.value = item.name;
  if (item.amount) amountInput.value = item.amount;

  checkbox.addEventListener('change', (e) => {
    item.paid = e.target.checked;
    row.classList.toggle('is-paid', item.paid);
    saveCurrentState();
  });

  function saveEdit(){
    const newName = nameInput.value.trim();
    item.name = newName.length ? newName : item.name;
    nameText.textContent = item.name;
    nameInput.classList.add('hidden');
    nameText.classList.remove('hidden');
    renameBtn.innerHTML = ICON_PENCIL;
    renameBtn.classList.remove('editing');
    saveCurrentState();
    renderPieChart();
  }

  renameBtn.addEventListener('click', () => {
    if(nameInput.classList.contains('hidden')){
      nameText.classList.add('hidden'); nameInput.classList.remove('hidden');
      nameInput.focus(); nameInput.select();
      renameBtn.innerHTML = ICON_CHECK; renameBtn.classList.add('editing');
    } else saveEdit();
  });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveEdit(); });
  nameInput.addEventListener('blur', saveEdit);

  amountInput.addEventListener('input', () => {
    item.amount = parseFloat(amountInput.value) || 0;
    updateSummary(); saveCurrentState();
  });

  deleteBtn.addEventListener('click', () => {
    row.style.opacity = '0';
    setTimeout(() => {
      state.items = state.items.filter(it => it.id !== item.id);
      row.remove(); updateEmptyState(); updateSummary(); saveCurrentState();
    }, 140);
  });

  if (isNew) setTimeout(() => renameBtn.click(), 10);
  return row;
}

incomeInput.addEventListener('input', () => { state.income = parseFloat(incomeInput.value) || 0; updateSummary(); saveCurrentState(); });
addItemBtn.addEventListener('click', () => {
  const item = { id: state.nextId++, name: 'รายการใหม่', amount: 0, paid: false };
  state.items.push(item);
  itemsList.appendChild(createRow(item, true));
  updateEmptyState(); updateSummary(); saveCurrentState();
});

// --- ระบบประวัติ ---
function getHistory() { return JSON.parse(localStorage.getItem('roomBudgetHistory') || '[]'); }
function saveHistory(historyArr) { localStorage.setItem('roomBudgetHistory', JSON.stringify(historyArr)); }

function renderHistory() {
  const history = getHistory();
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');

  if (!historyList || !historyEmpty) return;

  historyEmpty.classList.toggle('hidden', history.length > 0);
  historyList.innerHTML = '';

  history.forEach(h => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'history-item';
    itemDiv.draggable = true; // เปิดคุณสมบัติการลาก
    itemDiv.dataset.id = h.id;

    itemDiv.innerHTML = `
      <div class="history-left-col">
        <div class="history-date">
          ${h.date} 
          <button class="btn-mini" style="margin-left: 6px; padding: 1px 6px; font-size: 10px;" onclick="editRecordDate(${h.id})" title="แก้ไขวันเวลา">✏️ แก้ไขวันเวลา</button>
        </div>
        <div class="history-detail">รับ: ${h.strIncome} | จ่าย: ${h.strExpense}</div>
      </div>

      <!-- ปุ่มด้ามจับสลับลำดับตรงกลาง -->
      <div class="drag-handle" title="คลิกลากเพื่อสลับลำดับ">=</div>

      <div class="history-right">
        <div class="history-balance" style="color: ${h.isNegative ? 'var(--mac-red)' : 'var(--mac-green)'}">คงเหลือ ${h.strBalance}</div>
        <div class="history-actions">
          <button class="btn-mini" onclick="loadWorkspace(${h.id}, false)">เปิดดู</button>
          <button class="btn-mini btn-mini-print" onclick="loadWorkspace(${h.id}, true)">พิมพ์</button>
          <button class="btn-mini btn-mini-del" onclick="deleteRecord(${h.id})">ลบ</button>
        </div>
      </div>
    `;

    historyList.appendChild(itemDiv);
  });

  // เปิดใช้งานฟังก์ชันลากสลับลำดับ (Drag and Drop)
  setupHistoryDragAndDrop();
}

// ฟังก์ชันระบบ Drag and Drop สำหรับประวัติ
function setupHistoryDragAndDrop() {
  const historyList = document.getElementById('historyList');
  const items = historyList.querySelectorAll('.history-item');

  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', item.dataset.id);
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      saveNewHistoryOrder(); // บันทึกลำดับใหม่เมื่อปล่อยมือ
    });
  });

  historyList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const draggingItem = historyList.querySelector('.dragging');
    if (!draggingItem) return;

    const afterElement = getDragAfterElement(historyList, e.clientY);
    if (afterElement == null) {
      historyList.appendChild(draggingItem);
    } else {
      historyList.insertBefore(draggingItem, afterElement);
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.history-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ฟังก์ชันบันทึกลำดับใหม่ลง LocalStorage
function saveNewHistoryOrder() {
  const currentHistory = getHistory();
  const renderedItems = document.querySelectorAll('.history-item');
  const newHistory = [];

  renderedItems.forEach(item => {
    const id = parseInt(item.dataset.id, 10);
    const found = currentHistory.find(h => h.id === id);
    if (found) newHistory.push(found);
  });

  saveHistory(newHistory);
}

window.editRecordDate = function(id) {
  const history = getHistory();
  const record = history.find(h => h.id === id);
  if (!record) return;

  const newDateStr = prompt('แก้ไข วัน/เดือน/ปี เวลา (เช่น 03/10/2569 18:30):', record.date);
  if (newDateStr && newDateStr.trim() !== '') {
    record.date = newDateStr.trim();
    const parts = newDateStr.trim().split(/[\s/:]+/);
    if (parts.length >= 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y > 2500) y -= 543;
      const hr = parts[3] ? parseInt(parts[3], 10) : 0;
      const min = parts[4] ? parseInt(parts[4], 10) : 0;
      const parsed = new Date(y, m, d, hr, min);
      if (!isNaN(parsed.getTime())) {
        record.timestamp = parsed.getTime();
      }
    }
    saveHistory(history);
    renderHistory();
  }
};

document.getElementById('saveHistoryBtn').addEventListener('click', () => {
  const totalExpense = state.items.reduce((sum, it) => sum + (it.amount || 0), 0);
  const balance = (state.income || 0) - totalExpense;
  if (state.income === 0 && state.items.length === 0) return alert('ไม่มีข้อมูลให้บันทึก');

  const customDateInput = document.getElementById('recordDateTime');
  let recordTimestamp = Date.now();
  let finalDateStr = formatDateTimeDMY(new Date(recordTimestamp));

  if (customDateInput && customDateInput.value) {
    const customDate = new Date(customDateInput.value);
    if (!isNaN(customDate.getTime())) {
      recordTimestamp = customDate.getTime();
      finalDateStr = formatDateTimeDMY(customDate);
    }
  }

  const history = getHistory();
  // บันทึกรายการใหม่ไว้ที่ด้านบนสุด
  history.unshift({
    id: Date.now(),
    timestamp: recordTimestamp,
    date: finalDateStr,
    rawIncome: state.income || 0,
    rawItems: JSON.parse(JSON.stringify(state.items)),
    strIncome: formatMoney(state.income || 0),
    strExpense: formatMoney(totalExpense),
    strBalance: formatMoney(balance),
    isNegative: balance < 0
  });

  saveHistory(history); 
  renderHistory(); 
  
  if (customDateInput) customDateInput.value = '';
  alert('บันทึกข้อมูลเรียบร้อย');
});

window.loadWorkspace = function(id, autoPrint) {
  const record = getHistory().find(h => h.id === id);
  if (!record) return;
  state.income = record.rawIncome;
  state.items = JSON.parse(JSON.stringify(record.rawItems));
  state.nextId = state.items.length ? Math.max(...state.items.map(i => i.id)) + 1 : 1;
  renderWorkspace(); saveCurrentState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (autoPrint) setTimeout(() => window.print(), 300);
};

window.clearWorkspace = function() {
  if(confirm('ต้องการล้างข้อมูลเพื่อเริ่มบิลใหม่ใช่หรือไม่?')) {
    state.income = 0; state.items = []; renderWorkspace(); saveCurrentState();
  }
};
window.deleteRecord = function(id) {
  if(confirm('คุณต้องการลบประวัตินี้ใช่หรือไม่?')) { saveHistory(getHistory().filter(h => h.id !== id)); renderHistory(); }
};

function renderWorkspace() {
  incomeInput.value = state.income || '';
  itemsList.innerHTML = '';
  state.items.forEach(item => itemsList.appendChild(createRow(item, false)));
  updateSummary(); updateEmptyState();
}

// --- ระบบกราฟเส้น (รายปี) ---
function openChartModal() {
  document.getElementById('chartModal').classList.add('active');
  renderChart();
}
function closeChartModal() { document.getElementById('chartModal').classList.remove('active'); }

let myChart = null;
function renderChart() {
  const history = getHistory();
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  let incData = new Array(12).fill(0);
  let expData = new Array(12).fill(0);

  history.forEach(h => {
    let mMatch = months.findIndex(m => h.date.includes(m));
    if (mMatch !== -1) {
      incData[mMatch] += (h.rawIncome || 0);
      expData[mMatch] += (h.rawItems || []).reduce((s, it) => s + (it.amount || 0), 0);
    }
  });

  const ctx = document.getElementById('yearlyChart').getContext('2d');
  if(myChart) myChart.destroy();
  
  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'เงินรับเข้า (บาท)', data: incData, borderColor: '#3cd428', backgroundColor: 'rgba(60, 212, 40, 0.15)', fill: true, tension: 0.3, borderWidth: 2 },
        { label: 'จ่ายออก (บาท)', data: expData, borderColor: '#FF3B30', backgroundColor: 'rgba(255, 59, 48, 0.15)', fill: true, tension: 0.3, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,

      plugins: {
        legend: { labels: { font: { family: 'Noto Sans Thai' } } },
        tooltip: { titleFont: { family: 'Noto Sans Thai' }, bodyFont: { family: 'Noto Sans Thai' } },
        datalabels: { display: false }
      },

      scales: {
        x: { ticks: { font: { family: 'Noto Sans Thai' } } },
        y: { beginAtZero: true, ticks: { font: { family: 'Inter' } } }
      }
    }
  });
}

// --- กราฟวงกลมพร้อมแสดง % บนชิ้นกราฟ ---
let myPieChart = null;
function renderPieChart() {
  const ctx = document.getElementById('expensePieChart');
  if (!ctx) return;
  
  const validItems = state.items.filter(item => item.amount > 0);
  const labels = validItems.map(item => item.name || 'ไม่มีชื่อ');
  const data = validItems.map(item => item.amount);
  const total = data.reduce((a, b) => a + b, 0);

  const chartLabels = labels.length > 0 ? labels : ['ยังไม่มีรายจ่าย'];
  const chartData = data.length > 0 ? data : [1];
  const bgColors = data.length > 0 
    ? ['#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55']
    : ['#E5E5EA'];

  if (myPieChart) myPieChart.destroy();

  myPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartData,
        backgroundColor: bgColors,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    plugins: [ChartDataLabels],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Noto Sans Thai', size: 11 }, boxWidth: 12, padding: 8 }
        },
        tooltip: {
          enabled: data.length > 0,
          bodyFont: { family: 'Noto Sans Thai' },
          callbacks: {
            label: function(context) {
              return ' ฿' + context.raw.toLocaleString('en-US', {minimumFractionDigits: 2});
            }
          }
        },
        datalabels: {
          display: data.length > 0,
          color: '#ffffff',
          font: {
            family: 'Noto Sans Thai',
            weight: 'bold',
            size: 11
          },
          formatter: (value) => {
            if (total === 0) return '';
            const percentage = ((value / total) * 100).toFixed(0);
            return percentage > 3 ? percentage + '%' : '';
          }
        }
      }
    }
  });
}

// เริ่มต้นระบบ
renderWorkspace();
renderHistory();