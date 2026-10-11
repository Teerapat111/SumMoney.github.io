/* =====================================================================
   Summoney – script.js
   โครงไฟล์:
   1) ข้อมูลหลัก (state) + ตัวช่วยพื้นฐาน
   2) สรุปยอด (รับเข้า / จ่าย / คงเหลือ)
   3) แถวรายการที่ต้องจ่าย
   4) ระบบประวัติ (บันทึก / เปิด / ลบ / ลากสลับ / แก้เวลา)
   5) กราฟรายปี (เส้น)
   6) กราฟวงกลมสัดส่วนรายจ่าย
   7) เริ่มต้นระบบ
   ===================================================================== */


/* ---------------------------------------------------------------------
   1) ข้อมูลหลัก + ตัวช่วยพื้นฐาน
   --------------------------------------------------------------------- */

// อ่านข้อมูลจาก localStorage แบบปลอดภัย (ถ้าข้อมูลเสียจะไม่ทำให้เว็บพัง)
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error('อ่าน localStorage ไม่ได้:', key, err);
    return fallback;
  }
}

// state = ข้อมูลบิลที่กำลังเปิดอยู่ (รายรับ, รายการจ่าย, เลข id ถัดไป)
let state = readStorage('roomBudgetCurrentState', { income: 0, items: [], nextId: 1 });

// อ้างอิงองค์ประกอบในหน้าเว็บ
const incomeInput = document.getElementById('incomeInput');
const addItemBtn  = document.getElementById('addItemBtn');
const itemsList   = document.getElementById('itemsList');
const emptyState  = document.getElementById('emptyState');
const sumIncome   = document.getElementById('sumIncome');
const sumExpense  = document.getElementById('sumExpense');
const sumBalance  = document.getElementById('sumBalance');

// ไอคอน SVG (ดินสอ / ถูก / ถังขยะ)
const ICON_PENCIL = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20l1-4.2L15.5 5.3a1.5 1.5 0 0 1 2.1 0l1.1 1.1a1.5 1.5 0 0 1 0 2.1L8.2 19 4 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const ICON_CHECK  = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5 10 17l9-10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_TRASH  = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';

// แปลงตัวเลขเป็นรูปแบบเงิน เช่น ฿1,234.50
function formatMoney(n) {
  return '฿' + (isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// บันทึก state ปัจจุบันลง localStorage (เปิดเว็บครั้งหน้าข้อมูลยังอยู่)
function saveCurrentState() {
  localStorage.setItem('roomBudgetCurrentState', JSON.stringify(state));
}

// แปลงวันเวลาเป็นข้อความ วว/ดด/ปปปป(พ.ศ.) ชช:นน
function formatDateTimeDMY(d) {
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const day   = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year  = dateObj.getFullYear() + 543;
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const mins  = String(dateObj.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

// รวมยอดรายจ่ายทั้งหมดของรายการ
function sumItems(items) {
  return (items || []).reduce((sum, it) => sum + (it.amount || 0), 0);
}


/* ---------------------------------------------------------------------
   2) สรุปยอด
   --------------------------------------------------------------------- */

// อัปเดตการ์ดสรุปยอดด้านบน + วาดกราฟวงกลมใหม่
function updateSummary() {
  const totalExpense = sumItems(state.items);
  const balance = (state.income || 0) - totalExpense;

  sumIncome.textContent  = formatMoney(state.income || 0);
  sumExpense.textContent = formatMoney(totalExpense);
  sumBalance.textContent = formatMoney(balance);
  sumBalance.classList.toggle('negative', balance < 0); // ติดลบ = เปลี่ยนสีข้อความ

  renderPieChart();
}

// แสดง/ซ่อนข้อความ "ยังไม่มีรายการ"
function updateEmptyState() {
  emptyState.classList.toggle('hidden', state.items.length > 0);
}


/* ---------------------------------------------------------------------
   3) แถวรายการที่ต้องจ่าย
   --------------------------------------------------------------------- */

// สร้าง 1 แถวรายการ (ชื่อ + จำนวนเงิน + ติ๊กจ่ายแล้ว + ปุ่มแก้ชื่อ/ลบ)
// isNew = true → เปิดโหมดแก้ชื่อทันที (ใช้ตอนกด "เพิ่มรายการ")
function createRow(item, isNew = false) {
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

  // ดึงองค์ประกอบในแถว
  const checkbox    = row.querySelector('.mac-checkbox');
  const nameText    = row.querySelector('.name-text');
  const nameInput   = row.querySelector('.name-input');
  const amountInput = row.querySelector('.amount-input');
  const renameBtn   = row.querySelector('.rename-btn');
  const deleteBtn   = row.querySelector('.delete-btn');

  // ใส่ค่าเริ่มต้น
  nameText.textContent = item.name;
  nameInput.value = item.name;
  if (item.amount) amountInput.value = item.amount;

  // ติ๊ก "จ่ายแล้ว" → ขีดฆ่าชื่อ + ป้ายเปลี่ยนเป็นสีเขียว
  checkbox.addEventListener('change', (e) => {
    item.paid = e.target.checked;
    row.classList.toggle('is-paid', item.paid);
    saveCurrentState();
  });

  // บันทึกชื่อที่แก้ไข
  function saveEdit() {
    const newName = nameInput.value.trim();
    item.name = newName.length ? newName : item.name; // ห้ามเป็นชื่อว่าง
    nameText.textContent = item.name;
    nameInput.classList.add('hidden');
    nameText.classList.remove('hidden');
    renameBtn.innerHTML = ICON_PENCIL;
    renameBtn.classList.remove('editing');
    saveCurrentState();
    renderPieChart(); // ชื่อเปลี่ยน → ป้ายกราฟวงกลมต้องเปลี่ยนตาม
  }

  // ปุ่มดินสอ: สลับระหว่างโหมดแก้ชื่อ / บันทึกชื่อ
  renameBtn.addEventListener('click', () => {
    if (nameInput.classList.contains('hidden')) {
      nameText.classList.add('hidden');
      nameInput.classList.remove('hidden');
      nameInput.focus();
      nameInput.select();
      renameBtn.innerHTML = ICON_CHECK;
      renameBtn.classList.add('editing');
    } else {
      saveEdit();
    }
  });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveEdit(); });
  nameInput.addEventListener('blur', saveEdit);

  // พิมพ์จำนวนเงิน → คำนวณยอดใหม่ทันที
  amountInput.addEventListener('input', () => {
    item.amount = parseFloat(amountInput.value) || 0;
    updateSummary();
    saveCurrentState();
  });

  // ปุ่มถังขยะ: ลบรายการ (มีเอฟเฟกต์จางหายก่อน)
  deleteBtn.addEventListener('click', () => {
    row.style.opacity = '0';
    setTimeout(() => {
      state.items = state.items.filter(it => it.id !== item.id);
      row.remove();
      updateEmptyState();
      updateSummary();
      saveCurrentState();
    }, 140);
  });

  if (isNew) setTimeout(() => renameBtn.click(), 10);
  return row;
}

// พิมพ์รายรับ → อัปเดตยอด
incomeInput.addEventListener('input', () => {
  state.income = parseFloat(incomeInput.value) || 0;
  updateSummary();
  saveCurrentState();
});

// กดปุ่ม "เพิ่มรายการ"
addItemBtn.addEventListener('click', () => {
  const item = { id: state.nextId++, name: 'รายการใหม่', amount: 0, paid: false };
  state.items.push(item);
  itemsList.appendChild(createRow(item, true));
  updateEmptyState();
  updateSummary();
  saveCurrentState();
});

// วาดหน้าทำงานทั้งหมดใหม่จาก state (ใช้ตอนเปิดเว็บ / เปิดประวัติ / เริ่มบิลใหม่)
function renderWorkspace() {
  incomeInput.value = state.income || '';
  itemsList.innerHTML = '';
  state.items.forEach(item => itemsList.appendChild(createRow(item, false)));
  updateSummary();
  updateEmptyState();
}

// ปุ่ม "เริ่มบิลใหม่": ล้างรายรับและรายการทั้งหมด
window.clearWorkspace = function () {
  if (confirm('ต้องการล้างข้อมูลเพื่อเริ่มบิลใหม่ใช่หรือไม่?')) {
    state.income = 0;
    state.items = [];
    renderWorkspace();
    saveCurrentState();
  }
};


/* ---------------------------------------------------------------------
   4) ระบบประวัติ
   --------------------------------------------------------------------- */

function getHistory() { return readStorage('roomBudgetHistory', []); }
function saveHistory(historyArr) { localStorage.setItem('roomBudgetHistory', JSON.stringify(historyArr)); }

// วาดรายการประวัติทั้งหมดลงหน้าเว็บ
function renderHistory() {
  const history = getHistory();
  const historyList  = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  if (!historyList || !historyEmpty) return;

  historyEmpty.classList.toggle('hidden', history.length > 0);
  historyList.innerHTML = '';

  history.forEach(h => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'history-item';
    itemDiv.draggable = true;      // เปิดให้ลากได้
    itemDiv.dataset.id = h.id;

    itemDiv.innerHTML = `
      <div class="history-left-col">
        <div class="history-date">
          ${h.date}
          <button class="btn-mini" style="margin-left: 6px; padding: 1px 6px; font-size: 10px;" onclick="editRecordDate(${h.id})" title="แก้ไขวันเวลา">✏️ แก้ไขวันเวลา</button>
        </div>
        <div class="history-detail">รับ: ${h.strIncome} | จ่าย: ${h.strExpense}</div>
      </div>

      <!-- ด้ามจับสำหรับลากสลับลำดับ -->
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

  setupHistoryDragAndDrop();
}

// ปุ่ม "บันทึกข้อมูลเก็บไว้": เก็บบิลปัจจุบันเข้าประวัติ (ไว้บนสุด)
document.getElementById('saveHistoryBtn').addEventListener('click', () => {
  const totalExpense = sumItems(state.items);
  const balance = (state.income || 0) - totalExpense;
  if (state.income === 0 && state.items.length === 0) return alert('ไม่มีข้อมูลให้บันทึก');

  // ใช้วันเวลาที่ผู้ใช้เลือก ถ้าไม่เลือกใช้เวลาปัจจุบัน
  const customDateInput = document.getElementById('recordDateTime');
  let recordTimestamp = Date.now();
  let finalDateStr = formatDateTimeDMY(recordTimestamp);

  if (customDateInput && customDateInput.value) {
    const customDate = new Date(customDateInput.value);
    if (!isNaN(customDate.getTime())) {
      recordTimestamp = customDate.getTime();
      finalDateStr = formatDateTimeDMY(customDate);
    }
  }

  const history = getHistory();
  history.unshift({
    id: Date.now(),
    timestamp: recordTimestamp,                          // ใช้จัดกลุ่มเดือน/ปีในกราฟรายปี
    date: finalDateStr,                                  // ข้อความวันที่ที่โชว์ในหน้าเว็บ
    rawIncome: state.income || 0,
    rawItems: JSON.parse(JSON.stringify(state.items)),   // คัดลอกรายการ (ไม่ผูกกับ state)
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

// ปุ่ม "เปิดดู" / "พิมพ์": โหลดบิลจากประวัติกลับมาที่หน้าทำงาน
window.loadWorkspace = function (id, autoPrint) {
  const record = getHistory().find(h => h.id === id);
  if (!record) return;

  state.income = record.rawIncome;
  state.items = JSON.parse(JSON.stringify(record.rawItems));
  state.nextId = state.items.length ? Math.max(...state.items.map(i => i.id)) + 1 : 1;

  renderWorkspace();
  saveCurrentState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (autoPrint) setTimeout(() => window.print(), 300);
};

// ปุ่ม "ลบ": ลบประวัติ 1 รายการ
window.deleteRecord = function (id) {
  if (confirm('คุณต้องการลบประวัตินี้ใช่หรือไม่?')) {
    saveHistory(getHistory().filter(h => h.id !== id));
    renderHistory();
  }
};

// ปุ่ม "แก้ไขวันเวลา": รับข้อความ เช่น 03/10/2569 18:30 (พ.ศ.)
window.editRecordDate = function (id) {
  const history = getHistory();
  const record = history.find(h => h.id === id);
  if (!record) return;

  const input = prompt('แก้ไข วัน/เดือน/ปี เวลา (เช่น 03/10/2569 18:30):', record.date);
  if (!input || input.trim() === '') return;

  const parts = input.trim().split(/[\s/:]+/);
  if (parts.length < 3) return alert('รูปแบบไม่ถูกต้อง');

  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  let y = parseInt(parts[2], 10);
  if (y > 2500) y -= 543;                                // แปลง พ.ศ. → ค.ศ.
  const hr  = parts[3] ? parseInt(parts[3], 10) : 0;
  const min = parts[4] ? parseInt(parts[4], 10) : 0;

  const parsed = new Date(y, m, d, hr, min);
  if (isNaN(parsed.getTime())) return alert('รูปแบบวันที่ไม่ถูกต้อง');

  record.timestamp = parsed.getTime();
  record.date = formatDateTimeDMY(parsed);               // จัดรูปแบบใหม่ให้เหมือนกันทุกรายการ
  saveHistory(history);
  renderHistory();
};

/* ----- ลากสลับลำดับประวัติ (Drag and Drop) ----- */

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
      saveNewHistoryOrder(); // ปล่อยเมาส์ → บันทึกลำดับใหม่
    });
  });

  // ผูก dragover ครั้งเดียวต่อ container (กันซ้ำทุกครั้งที่วาดใหม่)
  if (!historyList.dataset.dragBound) {
    historyList.dataset.dragBound = '1';
    historyList.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = historyList.querySelector('.dragging');
      if (!dragging) return;

      const after = getDragAfterElement(historyList, e.clientY);
      if (after == null) historyList.appendChild(dragging);
      else historyList.insertBefore(dragging, after);
    });
  }
}

// หาว่าตอนนี้เมาส์อยู่เหนือรายการไหน (เพื่อรู้ว่าจะแทรกก่อนรายการใด)
function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll('.history-item:not(.dragging)')];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// บันทึกลำดับประวัติตามที่เห็นบนหน้าจอ
function saveNewHistoryOrder() {
  const current = getHistory();
  const newHistory = [];
  document.querySelectorAll('.history-item').forEach(el => {
    const found = current.find(h => h.id === parseInt(el.dataset.id, 10));
    if (found) newHistory.push(found);
  });
  saveHistory(newHistory);
}


/* ---------------------------------------------------------------------
   5) กราฟรายปี (เส้น) – เปิดใน Pop-up
   --------------------------------------------------------------------- */

function openChartModal()  { document.getElementById('chartModal').classList.add('active'); renderChart(); }
function closeChartModal() { document.getElementById('chartModal').classList.remove('active'); }

// เปลี่ยนปีใน dropdown → วาดกราฟใหม่
document.getElementById('chartYear').addEventListener('change', renderChart);

// หาวันที่ของประวัติ 1 รายการ
// (🔧 แก้บั๊กกราฟว่าง: เดิมไปหาชื่อเดือนภาษาไทยในข้อความวันที่ ซึ่งเป็นตัวเลข จึงไม่เจอเลย
//  ตอนนี้ใช้ timestamp แทน และถ้าเป็นข้อมูลเก่าที่ไม่มี timestamp จะอ่านจากข้อความ วว/ดด/ปปปป)
function getRecordDate(h) {
  if (h.timestamp) {
    const d = new Date(h.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(h.date || '');
  if (m) {
    let y = parseInt(m[3], 10);
    if (y > 2400) y -= 543;
    const d = new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

let myChart = null;
function renderChart() {
  if (typeof Chart === 'undefined') return alert('โหลด Chart.js ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');

  const history = getHistory();
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  // --- เติมตัวเลือกปีใน dropdown จากปีที่มีในประวัติ (ใหม่ → เก่า) ---
  const yearSelect = document.getElementById('chartYear');
  const years = [...new Set(
    history.map(getRecordDate).filter(Boolean).map(d => d.getFullYear())
  )].sort((a, b) => b - a);
  if (!years.length) years.push(new Date().getFullYear());

  let selectedYear = parseInt(yearSelect.value, 10);
  if (!years.includes(selectedYear)) selectedYear = years[0];
  yearSelect.innerHTML = years
    .map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>พ.ศ. ${y + 543}</option>`)
    .join('');

  // --- รวมยอดรายรับ/รายจ่ายแยกตามเดือน ของปีที่เลือก ---
  const incData = new Array(12).fill(0);
  const expData = new Array(12).fill(0);
  history.forEach(h => {
    const d = getRecordDate(h);
    if (!d || d.getFullYear() !== selectedYear) return;
    incData[d.getMonth()] += (h.rawIncome || 0);
    expData[d.getMonth()] += sumItems(h.rawItems);
  });

  // --- วาดกราฟ ---
  const ctx = document.getElementById('yearlyChart').getContext('2d');
  if (myChart) myChart.destroy();

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'เงินรับเข้า (บาท)', data: incData, borderColor: '#3cd428', backgroundColor: 'rgba(60, 212, 40, 0.15)', fill: true, tension: 0.3, borderWidth: 2 },
        { label: 'จ่ายออก (บาท)',     data: expData, borderColor: '#FF3B30', backgroundColor: 'rgba(255, 59, 48, 0.15)', fill: true, tension: 0.3, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend:  { labels: { font: { family: 'Noto Sans Thai' } } },
        tooltip: { titleFont: { family: 'Noto Sans Thai' }, bodyFont: { family: 'Noto Sans Thai' } },
        datalabels: { display: false }          // กราฟเส้นไม่ต้องแสดงตัวเลขบนจุด
      },
      scales: {
        x: { ticks: { font: { family: 'Noto Sans Thai' } } },
        y: { beginAtZero: true, ticks: { font: { family: 'Inter' } } }
      }
    }
  });
}


/* ---------------------------------------------------------------------
   6) กราฟวงกลม (Doughnut) สัดส่วนรายจ่าย พร้อม % บนชิ้นกราฟ
   --------------------------------------------------------------------- */

let myPieChart = null;
function renderPieChart() {
  const ctx = document.getElementById('expensePieChart');
  if (!ctx || typeof Chart === 'undefined') return;

  // ใช้เฉพาะรายการที่มียอดเงิน
  const validItems = state.items.filter(item => item.amount > 0);
  const labels = validItems.map(item => item.name || 'ไม่มีชื่อ');
  const data   = validItems.map(item => item.amount);
  const total  = data.reduce((a, b) => a + b, 0);

  // ถ้ายังไม่มีรายจ่าย → แสดงวงกลมสีเทาเปล่าๆ
  const chartLabels = labels.length > 0 ? labels : ['ยังไม่มีรายจ่าย'];
  const chartData   = data.length > 0 ? data : [1];
  const bgColors = data.length > 0
    ? ['#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55']
    : ['#E5E5EA'];

  if (myPieChart) myPieChart.destroy();

  myPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [{ data: chartData, backgroundColor: bgColors, borderWidth: 2, borderColor: '#ffffff' }]
    },
    plugins: [ChartDataLabels],   // เปิดใช้ plugin แสดง % เฉพาะกราฟนี้
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
            label: (context) => ' ฿' + context.raw.toLocaleString('en-US', { minimumFractionDigits: 2 })
          }
        },
        datalabels: {
          display: data.length > 0,
          color: '#ffffff',
          font: { family: 'Noto Sans Thai', weight: 'bold', size: 11 },
          // แสดงเป็น % ของยอดรวม (ซ่อนชิ้นที่เล็กกว่า 3% กันตัวอักษรทับกัน)
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


/* ---------------------------------------------------------------------
   7) เริ่มต้นระบบ (ทำงานตอนเปิดเว็บ)
   --------------------------------------------------------------------- */
renderWorkspace();
renderHistory();
