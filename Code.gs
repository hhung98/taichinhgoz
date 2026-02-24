// LƯU Ý: Tên sheet trong Google Sheets phải là "Transactions"
const SHEET_NAME = 'Transactions';

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Không tìm thấy sheet: ' + SHEET_NAME })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Đọc payload từ request
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'add') {
      const tx = data.transaction;
      // Thêm 1 dòng mới. Đảm bảo đúng thứ tự: id, type, description, amount_vnd, amount_krw, category, date
      sheet.appendRow([
        tx.id,
        tx.type.toString(),
        tx.description.toString(),
        Number(tx.amount || 0),
        Number(tx.amountKRW || 0),
        tx.category.toString(),
        tx.date.toString()
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Đã thêm' })).setMimeType(ContentService.MimeType.JSON);
    } 
    else if (action === 'delete') {
      const idToDelete = data.id;
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      // Bắt đầu từ hàng 2 (bỏ qua tiêu đề)
      for (let i = 1; i < values.length; i++) {
        // Cột id là cột đầu tiên (index 0)
        if (values[i][0].toString() === idToDelete.toString()) {
          sheet.deleteRow(i + 1); // deleteRow tính từ 1, nên index i cần + 1
          return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Đã xóa' })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Không tìm thấy ID' })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Hành động không hợp lệ' })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Không tìm thấy sheet: ' + SHEET_NAME })).setMimeType(ContentService.MimeType.JSON);
    }

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length <= 1) {
       return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: [] })).setMimeType(ContentService.MimeType.JSON);
    }

    // map dữ liệu từ mảng sang object
    const result = [];
    for (let i = 1; i < values.length; i++) {
      result.push({
        id: values[i][0],
        type: values[i][1],
        description: values[i][2],
        amount: values[i][3],
        amountKRW: values[i][4],
        category: values[i][5],
        date: values[i][6]
      });
    }

    // Sắp xếp giảm dần theo ngày (tùy chọn)
    result.sort((a, b) => new Date(b.date) - new Date(a.date));

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: result }))
           .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Bắt buộc xử lý OPTIONS để tránh lỗi CORS
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
