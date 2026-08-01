/**
 * 육군본부교회 중보기도 출석표 - 클라이언트 애플리케이션 (app.js)
 * 05:00 ~ 22:00 총 17개 타임슬롯 (새벽 05시, 06시 추가 지원)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 🔗 모든 사용자가 접속 즉시 연동되는 기본 구글 앱스 스크립트 배포 URL
  const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbwRYIJKys8MTdyk-PCM-YukyOMLXq6UuBkANIKiL7MfPSSm80skmkHPr7_Ba00lilwxsw/exec';

  let activeApiUrl = localStorage.getItem('gas_api_url');
  if (!activeApiUrl || activeApiUrl.trim() === '') {
    activeApiUrl = DEFAULT_API_URL;
    localStorage.setItem('gas_api_url', DEFAULT_API_URL);
  }

  // --- 상태 관리 ---
  const STATE = {
    apiUrl: activeApiUrl,
    currentSheet: '8월 1주차',
    startDate: getTodayDateStr(), // 기본값: 오늘 날짜 (YYYY-MM-DD)
    sheets: ['8월 1주차'],
    data: [],
    selectedSlot: null
  };

  // ⚡ 인메모리 데이터 캐시
  const DATA_CACHE = {};

  const TIME_LABELS = [
    "(자유시간) 05:00 ~ 06:00", "(자유시간) 06:00 ~ 07:00",
    "(자유시간) 07:00 ~ 08:00", "(자유시간) 08:00 ~ 09:00",
    "09:00 ~ 10:00", "10:00 ~ 11:00", "11:00 ~ 12:00", "12:00 ~ 13:00",
    "13:00 ~ 14:00", "14:00 ~ 15:00", "15:00 ~ 16:00", "16:00 ~ 17:00",
    "17:00 ~ 18:00", "18:00 ~ 19:00",
    "(자유시간) 19:00 ~ 20:00", "(자유시간) 20:00 ~ 21:00", "(자유시간) 21:00 ~ 22:00"
  ];

  const BASE_DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];

  // --- DOM 요소 참조 ---
  const weekSelect = document.getElementById('weekSelect');
  const btnPrevWeek = document.getElementById('btnPrevWeek');
  const btnNextWeek = document.getElementById('btnNextWeek');
  const btnCreateWeek = document.getElementById('btnCreateWeek');
  const btnDeleteWeek = document.getElementById('btnDeleteWeek');
  const btnApiSettings = document.getElementById('btnApiSettings');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const timetableBody = document.getElementById('timetableBody');
  const loadingOverlay = document.getElementById('loadingOverlay');

  // 모달 참조
  const applyModal = document.getElementById('applyModal');
  const modalSlotInfo = document.getElementById('modalSlotInfo');
  const inputName = document.getElementById('inputName');
  const btnSaveApply = document.getElementById('btnSaveApply');
  const btnCancelApply = document.getElementById('btnCancelApply');

  const createWeekModal = document.getElementById('createWeekModal');
  const inputAdminPassword = document.getElementById('inputAdminPassword');
  const inputNewWeekName = document.getElementById('inputNewWeekName');
  const inputMondayDate = document.getElementById('inputMondayDate');
  const btnSaveCreateWeek = document.getElementById('btnSaveCreateWeek');
  const btnCancelCreateWeek = document.getElementById('btnCancelCreateWeek');

  const deleteWeekModal = document.getElementById('deleteWeekModal');
  const deleteSheetTargetName = document.getElementById('deleteSheetTargetName');
  const inputDeleteAdminPassword = document.getElementById('inputDeleteAdminPassword');
  const btnConfirmDeleteWeek = document.getElementById('btnConfirmDeleteWeek');
  const btnCancelDeleteWeek = document.getElementById('btnCancelDeleteWeek');

  const apiSettingsModal = document.getElementById('apiSettingsModal');
  const inputApiUrl = document.getElementById('inputApiUrl');
  const btnSaveApi = document.getElementById('btnSaveApi');
  const btnTestApi = document.getElementById('btnTestApi');

  // --- 초기화 ---
  init();

  function init() {
    setupEventListeners();
    updateStatusUI();
    fetchData();
  }

  // --- 오늘 날짜 반환 (YYYY-MM-DD) ---
  function getTodayDateStr() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // --- 이벤트 리스너 등록 ---
  function setupEventListeners() {
    weekSelect.addEventListener('change', (e) => {
      STATE.currentSheet = e.target.value;
      fetchData();
    });

    btnPrevWeek.addEventListener('click', () => navigateWeek(-1));
    btnNextWeek.addEventListener('click', () => navigateWeek(1));

    btnCreateWeek.addEventListener('click', () => {
      inputAdminPassword.value = '';
      inputNewWeekName.value = '';
      inputMondayDate.value = getTodayDateStr();
      openModal(createWeekModal);
      setTimeout(() => inputAdminPassword.focus(), 150);
    });

    btnDeleteWeek.addEventListener('click', () => {
      if (STATE.sheets.length <= 1) {
        alert('최소 1개의 주차 시트는 보존되어야 합니다.');
        return;
      }
      deleteSheetTargetName.textContent = STATE.currentSheet;
      inputDeleteAdminPassword.value = '';
      openModal(deleteWeekModal);
      setTimeout(() => inputDeleteAdminPassword.focus(), 150);
    });

    btnApiSettings.addEventListener('click', () => {
      inputApiUrl.value = STATE.apiUrl;
      openModal(apiSettingsModal);
    });

    document.querySelectorAll('.btnCloseModal').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal(applyModal);
        closeModal(createWeekModal);
        closeModal(deleteWeekModal);
        closeModal(apiSettingsModal);
      });
    });

    btnCancelApply.addEventListener('click', () => closeModal(applyModal));
    btnCancelCreateWeek.addEventListener('click', () => closeModal(createWeekModal));
    btnCancelDeleteWeek.addEventListener('click', () => closeModal(deleteWeekModal));

    btnSaveApply.addEventListener('click', saveApplication);
    inputName.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveApplication();
    });

    btnSaveCreateWeek.addEventListener('click', createNewWeek);
    btnConfirmDeleteWeek.addEventListener('click', deleteCurrentWeek);

    btnSaveApi.addEventListener('click', () => {
      const url = inputApiUrl.value.trim() || DEFAULT_API_URL;
      STATE.apiUrl = url;
      localStorage.setItem('gas_api_url', url);
      closeModal(apiSettingsModal);
      updateStatusUI();
      fetchData(true);
    });

    btnTestApi.addEventListener('click', testApiConnection);
  }

  function updateStatusUI() {
    if (STATE.apiUrl) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = '연동: 연결됨';
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = '연동: 오프라인 모드';
    }
  }

  function navigateWeek(direction) {
    const currentIndex = STATE.sheets.indexOf(STATE.currentSheet);
    if (currentIndex === -1) return;

    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < STATE.sheets.length) {
      STATE.currentSheet = STATE.sheets[newIndex];
      weekSelect.value = STATE.currentSheet;
      fetchData();
    }
  }

  function calculateWeekHeaderDates(startDateStr) {
    const dates = [];
    if (!startDateStr || !startDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      startDateStr = getTodayDateStr();
    }

    const [year, month, day] = startDateStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const m = d.getMonth() + 1;
      const dateNum = d.getDate();
      const dayName = BASE_DAY_NAMES[i];

      dates.push(`${m}.${dateNum}(${dayName})`);
    }

    return dates;
  }

  function updateTableHeaderDates() {
    const dateLabels = calculateWeekHeaderDates(STATE.startDate);
    for (let i = 0; i < 7; i++) {
      const thEl = document.getElementById(`thDay${i}`);
      if (thEl) {
        thEl.textContent = dateLabels[i];
      }
    }
  }

  function generateDemoData() {
    const demo = [];
    for (let t = 0; t < 17; t++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        days.push({
          dayIndex: d,
          slot1: (t === 2 && d === 0) ? '홍길동' : ((t === 3 && d === 1) ? '이은혜' : ''),
          slot2: (t === 2 && d === 0) ? '김기도' : ''
        });
      }
      demo.push({ time: TIME_LABELS[t], days });
    }
    return demo;
  }

  // ⚡ 초고속 데이터 로드 (17개 타임슬롯 지원)
  async function fetchData(forceRefresh = false) {
    const cacheKey = STATE.currentSheet;

    if (!forceRefresh && DATA_CACHE[cacheKey]) {
      const cached = DATA_CACHE[cacheKey];
      STATE.startDate = cached.startDate || STATE.startDate;
      STATE.data = cached.data;
      renderWeekSelect();
      updateTableHeaderDates();
      renderTimetable();
      showLoading(false);
    } else {
      showLoading(true);
    }

    if (!STATE.apiUrl) {
      setTimeout(() => {
        STATE.data = generateDemoData();
        STATE.startDate = getTodayDateStr();
        DATA_CACHE[cacheKey] = { startDate: STATE.startDate, data: STATE.data };
        renderWeekSelect();
        updateTableHeaderDates();
        renderTimetable();
        showLoading(false);
      }, 100);
      return;
    }

    try {
      const url = `${STATE.apiUrl}?action=getData&sheetName=${encodeURIComponent(STATE.currentSheet)}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.status === 'success') {
        if (result.sheets && result.sheets.length > 0) {
          STATE.sheets = result.sheets;
        }
        if (result.currentSheet) {
          STATE.currentSheet = result.currentSheet;
        }
        if (result.startDate) {
          STATE.startDate = result.startDate;
        }
        STATE.data = result.data || [];

        DATA_CACHE[STATE.currentSheet] = {
          startDate: STATE.startDate,
          data: STATE.data
        };

        renderWeekSelect();
        updateTableHeaderDates();
        renderTimetable();
      } else {
        if (!DATA_CACHE[cacheKey]) {
          STATE.data = generateDemoData();
          renderTimetable();
        }
      }
    } catch (err) {
      console.error('API Fetch Error:', err);
      if (!DATA_CACHE[cacheKey]) {
        STATE.data = generateDemoData();
        renderTimetable();
      }
    } finally {
      showLoading(false);
    }
  }

  function renderWeekSelect() {
    weekSelect.innerHTML = '';
    STATE.sheets.forEach(sheetName => {
      const option = document.createElement('option');
      option.value = sheetName;
      option.textContent = sheetName;
      if (sheetName === STATE.currentSheet) option.selected = true;
      weekSelect.appendChild(option);
    });
  }

  // --- 타임테이블 렌더링 (17개 타임슬롯) ---
  function renderTimetable() {
    timetableBody.innerHTML = '';

    if (!STATE.data || STATE.data.length === 0) {
      STATE.data = generateDemoData();
    }

    STATE.data.forEach((slotData, timeIdx) => {
      const tr = document.createElement('tr');

      const tdTime = document.createElement('td');
      tdTime.className = 'time-cell';
      const rawTimeStr = slotData.time || TIME_LABELS[timeIdx];

      if (rawTimeStr.includes('(자유시간)')) {
        const cleanTime = rawTimeStr.replace('(자유시간)', '').trim();
        tdTime.innerHTML = `<span class="free-time-badge">자유시간</span><div style="margin-top: 3px; font-weight: 700;">${cleanTime}</div>`;
      } else {
        tdTime.textContent = rawTimeStr;
      }

      tr.appendChild(tdTime);

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const dayData = slotData.days[dayIdx] || { slot1: '', slot2: '' };
        const tdDay = document.createElement('td');
        tdDay.className = `col-day-${dayIdx}`;

        const slotWrapper = document.createElement('div');
        slotWrapper.className = 'slot-wrapper';

        const btnSlot1 = createSlotButton(dayData.slot1, dayIdx, timeIdx, 0);
        const btnSlot2 = createSlotButton(dayData.slot2, dayIdx, timeIdx, 1);

        slotWrapper.appendChild(btnSlot1);
        slotWrapper.appendChild(btnSlot2);
        tdDay.appendChild(slotWrapper);
        tr.appendChild(tdDay);
      }

      timetableBody.appendChild(tr);
    });
  }

  function createSlotButton(name, dayIndex, timeIndex, slotIndex) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isFilled = name && name.trim().length > 0;

    btn.className = `slot-btn ${isFilled ? 'filled' : ''}`;
    btn.textContent = isFilled ? name : '';

    btn.addEventListener('click', () => {
      openApplyModal(dayIndex, timeIndex, slotIndex, isFilled ? name : '');
    });

    return btn;
  }

  function openApplyModal(dayIndex, timeIndex, slotIndex, currentName) {
    STATE.selectedSlot = { dayIndex, timeIndex, slotIndex, currentName };

    const dateLabels = calculateWeekHeaderDates(STATE.startDate);
    const dayLabel = dateLabels[dayIndex] || BASE_DAY_NAMES[dayIndex];
    const timeLabel = TIME_LABELS[timeIndex];
    const slotLabel = `신청자 ${slotIndex + 1}`;

    modalSlotInfo.innerHTML = `<strong>${STATE.currentSheet} ${dayLabel} ${timeLabel} (${slotLabel})</strong>`;
    inputName.value = currentName;
    openModal(applyModal);
    setTimeout(() => inputName.focus(), 150);
  }

  // ⚡ 낙관적 UI 적용
  async function saveApplication() {
    if (!STATE.selectedSlot) return;

    const { dayIndex, timeIndex, slotIndex } = STATE.selectedSlot;
    const name = inputName.value.trim();

    closeModal(applyModal);

    if (STATE.data[timeIndex] && STATE.data[timeIndex].days[dayIndex]) {
      if (slotIndex === 0) STATE.data[timeIndex].days[dayIndex].slot1 = name;
      else STATE.data[timeIndex].days[dayIndex].slot2 = name;
    }
    
    if (DATA_CACHE[STATE.currentSheet]) {
      DATA_CACHE[STATE.currentSheet].data = STATE.data;
    }
    renderTimetable();

    if (STATE.apiUrl) {
      try {
        const payload = {
          action: 'update',
          sheetName: STATE.currentSheet,
          dayIndex,
          timeIndex,
          slotIndex,
          name
        };

        fetch(STATE.apiUrl, {
          method: 'POST',
          body: JSON.stringify(payload)
        }).catch(err => console.error('Background save error:', err));
      } catch (err) {
        console.error('Save error:', err);
      }
    }
  }

  async function createNewWeek() {
    const password = inputAdminPassword.value.trim();
    const newWeekName = inputNewWeekName.value.trim();
    const mondayDateVal = inputMondayDate.value.trim() || getTodayDateStr();

    if (password !== 'prayer') {
      alert('🔒 관리자 암호가 올바르지 않습니다.');
      inputAdminPassword.focus();
      return;
    }

    if (!newWeekName) {
      alert('생성할 주차 이름을 입력해 주세요.');
      inputNewWeekName.focus();
      return;
    }

    if (STATE.sheets.includes(newWeekName)) {
      alert('이미 존재하는 주차 이름입니다.');
      return;
    }

    closeModal(createWeekModal);
    showLoading(true);

    if (!STATE.apiUrl) {
      STATE.sheets.push(newWeekName);
      STATE.currentSheet = newWeekName;
      STATE.startDate = mondayDateVal;
      STATE.data = generateDemoData();
      renderWeekSelect();
      updateTableHeaderDates();
      renderTimetable();
      showLoading(false);
      alert(`데모 모드: '${newWeekName}'이(가) 새롭게 생성되었습니다.`);
      return;
    }

    try {
      const payload = {
        action: 'createSheet',
        sheetName: newWeekName,
        mondayDate: mondayDateVal
      };

      const response = await fetch(STATE.apiUrl, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.status === 'success') {
        STATE.sheets = result.sheets || [...STATE.sheets, newWeekName];
        STATE.currentSheet = result.currentSheet || newWeekName;
        if (result.startDate) STATE.startDate = result.startDate;

        STATE.data = result.data || generateDemoData();
        DATA_CACHE[STATE.currentSheet] = { startDate: STATE.startDate, data: STATE.data };

        renderWeekSelect();
        updateTableHeaderDates();
        renderTimetable();
        alert(`'${newWeekName}' 주간 출석표가 성공적으로 생성되었습니다!`);
      } else {
        alert('주간 생성 실패: ' + result.message);
      }
    } catch (err) {
      console.error('Create week error:', err);
      alert('새 주간 생성 처리 중 오류가 발생했습니다.');
    } finally {
      showLoading(false);
    }
  }

  async function deleteCurrentWeek() {
    const password = inputDeleteAdminPassword.value.trim();

    if (password !== 'prayer') {
      alert('🔒 관리자 암호가 올바르지 않습니다.');
      inputDeleteAdminPassword.focus();
      return;
    }

    closeModal(deleteWeekModal);
    showLoading(true);

    delete DATA_CACHE[STATE.currentSheet];

    if (!STATE.apiUrl) {
      STATE.sheets = STATE.sheets.filter(s => s !== STATE.currentSheet);
      STATE.currentSheet = STATE.sheets[0] || '8월 1주차';
      STATE.data = generateDemoData();
      renderWeekSelect();
      updateTableHeaderDates();
      renderTimetable();
      showLoading(false);
      alert('데모 모드: 해당 주간이 삭제되었습니다.');
      return;
    }

    try {
      const payload = {
        action: 'deleteSheet',
        sheetName: STATE.currentSheet
      };

      const response = await fetch(STATE.apiUrl, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.status === 'success') {
        STATE.sheets = result.sheets || [];
        STATE.currentSheet = result.currentSheet;
        if (result.startDate) STATE.startDate = result.startDate;
        STATE.data = result.data || generateDemoData();

        renderWeekSelect();
        updateTableHeaderDates();
        renderTimetable();
        alert(result.message || '주간이 삭제되었습니다.');
      } else {
        alert('주간 삭제 실패: ' + result.message);
      }
    } catch (err) {
      console.error('Delete week error:', err);
      alert('주간 삭제 처리 중 오류가 발생했습니다.');
    } finally {
      showLoading(false);
    }
  }

  async function testApiConnection() {
    const url = inputApiUrl.value.trim() || DEFAULT_API_URL;
    if (!url) {
      alert('웹 앱 URL을 입력해 주세요.');
      return;
    }

    btnTestApi.textContent = '테스트 중...';
    btnTestApi.disabled = true;

    try {
      const response = await fetch(`${url}?action=getSheets`);
      const result = await response.json();

      if (result.status === 'success') {
        alert('✅ 구글 시트 연동 성공!\n정상적으로 웹 앱 API와 통신할 수 있습니다.');
      } else {
        alert('❌ 연동 실패: ' + (result.message || '응답 형식이 올바르지 않습니다.'));
      }
    } catch (err) {
      console.error(err);
      alert('❌ 연동 실패!\nURL이 올바른지, 권한이 [모든 사용자]로 배포되었는지 확인해 주세요.');
    } finally {
      btnTestApi.textContent = '연동 테스트';
      btnTestApi.disabled = false;
    }
  }

  function openModal(modalEl) {
    modalEl.classList.add('active');
  }

  function closeModal(modalEl) {
    modalEl.classList.remove('active');
  }

  function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
  }
});
