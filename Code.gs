/**
 * 육군본부교회 중보기도 출석표 - Google Apps Script (GAS) 초고속 백엔드 API
 * 05:00 ~ 22:00 총 17개 타임슬롯 지원 (새벽 05시, 06시 추가)
 */

// CORS 헤더를 포함한 JSON 응답 생성 함수
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET 요청 처리 (최고속 핀포인트 전용 조회)
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = e.parameter.action || 'getData';
    
    // 1. 시트 목록만 빠르게 응답
    if (action === 'getSheets') {
      var sheets = ss.getSheets();
      var sheetNames = [];
      for (var i = 0; i < sheets.length; i++) {
        sheetNames.push(sheets[i].getName());
      }
      return createJsonResponse({ status: 'success', sheets: sheetNames });
    }
    
    // 2. 지정 주차 시트 핀포인트 초고속 읽기
    var sheetName = e.parameter.sheetName;
    var targetSheet = sheetName ? ss.getSheetByName(sheetName) : null;
    
    if (!targetSheet) {
      var sheets = ss.getSheets();
      if (sheets.length === 0) {
        targetSheet = createInitialSheet(ss, "8월 1주차");
      } else {
        targetSheet = sheets[0];
      }
    }
    
    // 포맷 세팅 미비 시 자동 설정
    if (targetSheet.getLastRow() < 2) {
      setupSheetFormat(targetSheet, getStartDateForSheet(targetSheet));
    }
    
    var data = getSheetData(targetSheet);
    var startDate = getStartDateForSheet(targetSheet);
    
    var allSheets = ss.getSheets();
    var sheetNames = [];
    for (var k = 0; k < allSheets.length; k++) {
      sheetNames.push(allSheets[k].getName());
    }
    
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

// POST 요청 처리
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
      var mondayDate = postData.mondayDate;
      
      if (!newSheetName) {
        return createJsonResponse({ status: 'error', message: '주차 이름을 입력해주세요.' });
      }
      
      var existingSheet = ss.getSheetByName(newSheetName);
      if (existingSheet) {
        return createJsonResponse({ status: 'error', message: '이미 존재하는 주차 이름입니다.' });
      }
      
      var newSheet = createInitialSheet(ss, newSheetName, mondayDate);
      var allSheets = ss.getSheets();
      var sheetNames = [];
      for (var i = 0; i < allSheets.length; i++) {
        sheetNames.push(allSheets[i].getName());
      }
      
      return createJsonResponse({
        status: 'success',
        message: '새로운 주차가 생성되었습니다.',
        currentSheet: newSheet.getName(),
        startDate: getStartDateForSheet(newSheet),
        sheets: sheetNames,
        data: getSheetData(newSheet)
      });
    }
    
    // 2. 주간 시트 삭제
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
      var remainingNames = [];
      for (var j = 0; j < remainingSheets.length; j++) {
        remainingNames.push(remainingSheets[j].getName());
      }
      
      return createJsonResponse({
        status: 'success',
        message: '\'' + deleteTargetName + '\' 주간이 삭제되었습니다.',
        currentSheet: nextSheet.getName(),
        startDate: getStartDateForSheet(nextSheet),
        sheets: remainingNames,
        data: getSheetData(nextSheet)
      });
    }
    
    // 3. 셀 데이터 핀포인트 1건 업데이트 (17개 타임슬롯 지원)
    if (action === 'update') {
      var sheetName = postData.sheetName;
      var dayIndex = parseInt(postData.dayIndex);
      var timeIndex = parseInt(postData.timeIndex); // 0(05:00) ~ 16(21:00)
      var slotIndex = parseInt(postData.slotIndex);
      var name = (postData.name || "").trim();
      
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return createJsonResponse({ status: 'error', message: '해당 주차 시트를 찾을 수 없습니다.' });
      }
      
      var row = 2 + timeIndex;
      var col = 2 + (dayIndex * 2) + slotIndex;
      
      sheet.getRange(row, col).setValue(name);
      
      return createJsonResponse({
        status: 'success',
        message: '저장되었습니다.'
      });
    }
    
    return createJsonResponse({ status: 'error', message: '알 수 없는 요청입니다.' });
    
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// 17시간(05:00~22:00) x 7일 데이터 일괄 추출 함수
function getSheetData(sheet) {
  var range = sheet.getRange(2, 1, 17, 15);
  var values = range.getValues();
  
  var result = [];
  var timeLabels = [
    "(자유시간) 05:00 ~ 06:00", "(자유시간) 06:00 ~ 07:00",
    "(자유시간) 07:00 ~ 08:00", "(자유시간) 08:00 ~ 09:00", 
    "09:00 ~ 10:00", "10:00 ~ 11:00", "11:00 ~ 12:00", "12:00 ~ 13:00", 
    "13:00 ~ 14:00", "14:00 ~ 15:00", "15:00 ~ 16:00", "16:00 ~ 17:00", 
    "17:00 ~ 18:00", "18:00 ~ 19:00", 
    "(자유시간) 19:00 ~ 20:00", "(자유시간) 20:00 ~ 21:00", "(자유시간) 21:00 ~ 22:00"
  ];
  
  for (var t = 0; t < 17; t++) {
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

// 월요일 시작 날짜 추출 함수 (17개 행 아래 A19 또는 A17 지원)
function getStartDateForSheet(sheet) {
  var storedDate = sheet.getRange(19, 1).getValue();
  if (!storedDate || !storedDate.toString().match(/^\d{4}-\d{2}-\d{2}$/)) {
    storedDate = sheet.getRange(17, 1).getValue();
  }
  
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

// 시트 표 포맷팅 적용 함수 (05시~22시 17개 슬롯)
function setupSheetFormat(sheet, mondayDate) {
  if (!mondayDate || !mondayDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    mondayDate = getStartDateForSheet(sheet);
  }
  
  var baseDays = ["월", "화", "수", "목", "금", "토", "일"];
  var parts = mondayDate.split('-');
  var startDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  
  var dateHeaders = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(startDateObj);
    d.setDate(startDateObj.getDate() + i);
    dateHeaders.push((d.getMonth() + 1) + "." + d.getDate() + "(" + baseDays[i] + ")");
  }
  
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
    .setBackground("#1e3a8a")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
    
  var timeLabels = [
    ["(자유시간) 05:00 ~ 06:00"], ["(자유시간) 06:00 ~ 07:00"],
    ["(자유시간) 07:00 ~ 08:00"], ["(자유시간) 08:00 ~ 09:00"], 
    ["09:00 ~ 10:00"], ["10:00 ~ 11:00"], ["11:00 ~ 12:00"], ["12:00 ~ 13:00"], 
    ["13:00 ~ 14:00"], ["14:00 ~ 15:00"], ["15:00 ~ 16:00"], ["16:00 ~ 17:00"], 
    ["17:00 ~ 18:00"], ["18:00 ~ 19:00"], 
    ["(자유시간) 19:00 ~ 20:00"], ["(자유시간) 20:00 ~ 21:00"], ["(자유시간) 21:00 ~ 22:00"]
  ];
  
  sheet.getRange(2, 1, 17, 1).setValues(timeLabels);
  sheet.getRange(2, 1, 17, 1)
    .setBackground("#f8fafc")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
    
  sheet.getRange(1, 1, 18, 15).setBorder(true, true, true, true, true, true);
  sheet.getRange(2, 2, 17, 14).setHorizontalAlignment("center");
  
  sheet.getRange(19, 1).setValue(mondayDate);
}

// 새 주차 시트 생성 함수
function createInitialSheet(ss, sheetName, mondayDate) {
  var sheet = ss.insertSheet(sheetName);
  setupSheetFormat(sheet, mondayDate);
  return sheet;
}
