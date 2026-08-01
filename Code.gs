/**
 * 육군본부교회 중보기도 출석표 - Google Apps Script (GAS) 백엔드
 * 
 * 구글 시트('중보기도신청자관리')의 [확장 프로그램] -> [Apps Script]에 
 * 이 코드 전체를 붙여넣은 후 [배포] -> [새 배포] -> [웹 앱]으로 배포하세요.
 */

// CORS 헤더를 포함한 JSON 응답 생성 함수
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET 요청 처리 (주차 목록 및 특정 주차의 기도 출석표 데이터 경량 조회)
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = e.parameter.action || 'getData';
    
    // 시트 검사 및 '시트1' -> '8월 1주차' 자동 변환
    var sheets = checkAndSetupSheets(ss);
    
    // 1. 주차 시트 목록만 경량 조회 (초기 로딩 속도 최적화)
    if (action === 'getSheets') {
      var sheetNames = sheets.map(function(s) { return s.getName(); });
      return createJsonResponse({ status: 'success', sheets: sheetNames });
    }
    
    // 2. 선택된 특정 주차 출석표 데이터만 핀포인트 조회
    var sheetName = e.parameter.sheetName;
    var targetSheet = sheetName ? ss.getSheetByName(sheetName) : sheets[0];
    
    if (!targetSheet) {
      targetSheet = sheets[0];
    }
    
    var startDate = getStartDateForSheet(targetSheet);
    
    // 타겟 시트 데이터가 1행 이하인 경우 포맷 세팅
    if (targetSheet.getLastRow() < 2) {
      setupSheetFormat(targetSheet, startDate);
    }
    
    var data = getSheetData(targetSheet);
    var sheetNames = sheets.map(function(s) { return s.getName(); });
    
    return createJsonResponse({
      status: 'success',
      currentSheet: targetSheet.getName(),
      startDate: startDate,
      sheets: sheetNames,
      data: data
    });
    
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// POST 요청 처리 (신청/수정, 주간 생성 및 주간 삭제)
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var postData = {};
    
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    }
    
    var action = postData.action;
    
    // 1. 새로운 주간 시트 생성
    if (action === 'createSheet') {
      var newSheetName = postData.sheetName;
      var mondayDate = postData.mondayDate; // YYYY-MM-DD
      
      if (!newSheetName) {
        return createJsonResponse({ status: 'error', message: '주차 이름을 입력해주세요.' });
      }
      
      var existingSheet = ss.getSheetByName(newSheetName);
      if (existingSheet) {
        return createJsonResponse({ status: 'error', message: '이미 존재하는 주차 이름입니다.' });
      }
      
      var newSheet = createInitialSheet(ss, newSheetName, mondayDate);
      var sheets = ss.getSheets().map(function(s) { return s.getName(); });
      var startDate = getStartDateForSheet(newSheet);
      
      return createJsonResponse({
        status: 'success',
        message: '새로운 주차가 생성되었습니다.',
        currentSheet: newSheet.getName(),
        startDate: startDate,
        sheets: sheets,
        data: getSheetData(newSheet)
      });
    }
    
    // 2. 주간 시트 삭제 (관리자 기능)
    if (action === 'deleteSheet') {
      var deleteTargetName = postData.sheetName;
      var sheets = ss.getSheets();
      
      if (sheets.length <= 1) {
        return createJsonResponse({ status: 'error', message: '최소 1개의 주차 시트는 보존되어야 합니다.' });
      }
      
      var targetSheet = ss.getSheetByName(deleteTargetName);
      if (!targetSheet) {
        return createJsonResponse({ status: 'error', message: '삭제할 주차 시트를 찾을 수 없습니다.' });
      }
      
      ss.deleteSheet(targetSheet);
      
      var remainingSheets = ss.getSheets();
      var nextSheet = remainingSheets[0];
      var nextStartDate = getStartDateForSheet(nextSheet);
      var remainingNames = remainingSheets.map(function(s) { return s.getName(); });
      
      return createJsonResponse({
        status: 'success',
        message: '\'' + deleteTargetName + '\' 주간이 삭제되었습니다.',
        currentSheet: nextSheet.getName(),
        startDate: nextStartDate,
        sheets: remainingNames,
        data: getSheetData(nextSheet)
      });
    }
    
    // 3. 기도 신청/수정/삭제 업데이트
    if (action === 'update') {
      var sheetName = postData.sheetName;
      var dayIndex = parseInt(postData.dayIndex); // 0(월) ~ 6(일)
      var timeIndex = parseInt(postData.timeIndex); // 0(07:00) ~ 14(21:00)
      var slotIndex = parseInt(postData.slotIndex); // 0(슬롯1) or 1(슬롯2)
      var name = (postData.name || "").trim(); // 공란이면 빈칸 저장
      
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return createJsonResponse({ status: 'error', message: '해당 주차 시트를 찾을 수 없습니다.' });
      }
      
      var row = 2 + timeIndex;
      var col = 2 + (dayIndex * 2) + slotIndex;
      
      sheet.getRange(row, col).setValue(name);
      
      var startDate = getStartDateForSheet(sheet);
      
      return createJsonResponse({
        status: 'success',
        message: '신청 정보가 업데이트되었습니다.',
        startDate: startDate,
        data: getSheetData(sheet)
      });
    }
    
    return createJsonResponse({ status: 'error', message: '알 수 없는 요청입니다.' });
    
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// 지정한 시트의 7일 x 15시간 데이터 구조 추출 함수 (자유시간 라벨 반영)
function getSheetData(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  var range = sheet.getRange(2, 1, 15, 15);
  var values = range.getValues();
  
  var result = [];
  var timeLabels = [
    "07:00 ~ 08:00 (자유시간)", "08:00 ~ 09:00 (자유시간)", 
    "09:00 ~ 10:00", "10:00 ~ 11:00", "11:00 ~ 12:00", "12:00 ~ 13:00", 
    "13:00 ~ 14:00", "14:00 ~ 15:00", "15:00 ~ 16:00", "16:00 ~ 17:00", 
    "17:00 ~ 18:00", "18:00 ~ 19:00", 
    "19:00 ~ 20:00 (자유시간)", "20:00 ~ 21:00 (자유시간)", "21:00 ~ 22:00 (자유시간)"
  ];
  
  for (var t = 0; t < 15; t++) {
    var rowValues = values[t] || [];
    var timeSlot = {
      time: timeLabels[t],
      days: []
    };
    
    for (var d = 0; d < 7; d++) {
      var col1 = 1 + (d * 2);
      var col2 = 1 + (d * 2) + 1;
      
      timeSlot.days.push({
        dayIndex: d,
        slot1: (rowValues[col1] || "").toString().trim(),
        slot2: (rowValues[col2] || "").toString().trim()
      });
    }
    
    result.push(timeSlot);
  }
  
  return result;
}

// 월요일 시작 날짜 기준 7일간의 헤더 명칭 생성 헬퍼
function generateHeaderDates(mondayDateStr) {
  var baseDays = ["월", "화", "수", "목", "금", "토", "일"];
  var parts = mondayDateStr.split('-');
  var startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  
  var dateHeaders = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    var m = d.getMonth() + 1;
    var dt = d.getDate();
    dateHeaders.push(m + "." + dt + "(" + baseDays[i] + ")");
  }
  return dateHeaders;
}

// 주차 시작 월요일 날짜 추출/계산 함수
function getStartDateForSheet(sheet) {
  var storedDate = sheet.getRange(17, 1).getValue();
  if (storedDate && storedDate.toString().match(/^\d{4}-\d{2}-\d{2}$/)) {
    return storedDate.toString();
  }
  
  var sheetName = sheet.getName();
  var match = sheetName.match(/(\d+)월\s*(\d+)주차/);
  var year = new Date().getFullYear();
  
  if (match) {
    var month = parseInt(match[1]) - 1;
    var week = parseInt(match[2]);
    
    var firstDayOfMonth = new Date(year, month, 1);
    var dayOfWeek = firstDayOfMonth.getDay();
    var firstMondayDate = (dayOfWeek === 1) ? 1 : ((dayOfWeek === 0) ? 2 : (1 + (8 - dayOfWeek)));
    var targetMondayDate = firstMondayDate + (week - 1) * 7;
    var targetDate = new Date(year, month, targetMondayDate);
    
    var y = targetDate.getFullYear();
    var m = String(targetDate.getMonth() + 1).padStart(2, '0');
    var d = String(targetDate.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  
  var today = new Date();
  var day = today.getDay();
  var diffToMonday = (day === 0 ? -6 : 1 - day);
  var monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  
  var y = monday.getFullYear();
  var m = String(monday.getMonth() + 1).padStart(2, '0');
  var d = String(monday.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

// 시트 목록 검사 및 기본 '시트1' -> '8월 1주차' 자동 변경 헬퍼
function checkAndSetupSheets(ss) {
  var sheets = ss.getSheets();
  
  if (sheets.length === 0) {
    createInitialSheet(ss, "8월 1주차");
    return ss.getSheets();
  }
  
  var firstSheet = sheets[0];
  var firstName = firstSheet.getName();
  if (firstName === "시트1" || firstName === "Sheet1") {
    firstSheet.setName("8월 1주차");
    var startDate = getStartDateForSheet(firstSheet);
    setupSheetFormat(firstSheet, startDate);
  } else if (firstSheet.getLastRow() < 2) {
    var startDate = getStartDateForSheet(firstSheet);
    setupSheetFormat(firstSheet, startDate);
  }
  
  return ss.getSheets();
}

// 시트 표 포맷팅 적용 함수
function setupSheetFormat(sheet, mondayDate) {
  if (!mondayDate || !mondayDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    mondayDate = getStartDateForSheet(sheet);
  }
  
  var dateHeaders = generateHeaderDates(mondayDate);
  
  var headers = [
    "시간", 
    dateHeaders[0] + "(1)", dateHeaders[0] + "(2)", 
    dateHeaders[1] + "(1)", dateHeaders[1] + "(2)", 
    dateHeaders[2] + "(1)", dateHeaders[2] + "(2)", 
    dateHeaders[3] + "(1)", dateHeaders[3] + "(2)", 
    dateHeaders[4] + "(1)", dateHeaders[4] + "(2)", 
    dateHeaders[5] + "(1)", dateHeaders[5] + "(2)", 
    dateHeaders[6] + "(1)", dateHeaders[6] + "(2)"
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground("#2c3e50")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
    
  var timeLabels = [
    ["07:00 ~ 08:00 (자유시간)"], ["08:00 ~ 09:00 (자유시간)"], 
    ["09:00 ~ 10:00"], ["10:00 ~ 11:00"], ["11:00 ~ 12:00"], ["12:00 ~ 13:00"], 
    ["13:00 ~ 14:00"], ["14:00 ~ 15:00"], ["15:00 ~ 16:00"], ["16:00 ~ 17:00"], 
    ["17:00 ~ 18:00"], ["18:00 ~ 19:00"], 
    ["19:00 ~ 20:00 (자유시간)"], ["20:00 ~ 21:00 (자유시간)"], ["21:00 ~ 22:00 (자유시간)"]
  ];
  
  sheet.getRange(2, 1, 15, 1).setValues(timeLabels);
  sheet.getRange(2, 1, 15, 1)
    .setBackground("#ecf0f1")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
    
  sheet.getRange(1, 1, 16, 15).setBorder(true, true, true, true, true, true);
  sheet.getRange(2, 2, 15, 14).setHorizontalAlignment("center");
  
  sheet.getRange(17, 1).setValue(mondayDate);
}

// 새 주차 시트 생성 및 초기 포맷 세팅 함수
function createInitialSheet(ss, sheetName, mondayDate) {
  var sheet = ss.insertSheet(sheetName);
  setupSheetFormat(sheet, mondayDate);
  return sheet;
}
