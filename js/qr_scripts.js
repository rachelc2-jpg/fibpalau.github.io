// =========================
// GLOBAL STORAGE
// =========================
var fileStore = {};
var paymentStore = {
  receipt: null,
  invoice: null
};
var transmittalNumber = null;
var usedTransmittals  = [];


// =========================
// TRANSMITTAL NUMBER
// =========================
function generateTransmittal() {
  var used;
  try {
    used = JSON.parse(localStorage.getItem("usedTransmittals") || "[]");
  } catch (e) {
    used = usedTransmittals;
  }


  var num;
  do {
    num = Math.floor(Math.random() * 10000) + 1;
  } while (used.includes(num));


  used.push(num);
  usedTransmittals = used;


  try {
    localStorage.setItem("usedTransmittals", JSON.stringify(used));
  } catch (e) {}


  return num;
}


// =========================
// SEQUENTIAL UPLOAD
// =========================
function uploadSequential(queue, index, bizName, quarter, total) {
  if (index >= queue.length) return Promise.resolve();
  // Update progress bar
  var percent = Math.round((index / total) * 100);
  $('#upload-progress-bar')
    .css('width', percent + '%')
    .attr('aria-valuenow', percent)
    .text(percent + '%');
  $('#upload-progress-label').text('Uploading file ' + (index + 1) + ' of ' + total + '...');

  return uploadFile(queue[index].file, queue[index].key, bizName, quarter)
    .then(function () {
      return uploadSequential(queue, index + 1, bizName, quarter, total);
    });
}


// =========================
// UPLOAD FUNCTION
// =========================
function uploadFile(file, i, bizName, quarter) {
  return new Promise(function (resolve, reject) {
    if (!file) { resolve(); return; }


    var fileNameMap = {
      1: "1. QR Form.pdf",
      2: "2. Location (S3).pdf",
      3: "3. Licenses (S7).pdf",
      4: "4. Employees (S8).pdf",
      5: "5. Employee Programs (S9).pdf",
      6: "6. Tax Information (S10-14).pdf",
      7: "7. Corporate Updates and Loans (S15-17).pdf",
      8: "8. Report Attachment.pdf"
    };


    var fileName;
    if (i === "receipt") {
      fileName = "Receipt - " + file.name;
    } else if (i === "invoice") {
      fileName = "Invoice - " + file.name;
    } else {
      fileName = fileNameMap[i] || file.name;
    }


    var mimeType = file.type || "application/octet-stream";


    var reader = new FileReader();
    reader.onload = function () {
      var base64 = reader.result.split(",")[1];


      var xhr = new XMLHttpRequest();
      xhr.open("POST", "https://script.google.com/macros/s/AKfycbz6rZCLLrvWO2oq6j0BiuvV-N5A7za6lVWifJa_E-Ua7jxF03NmXlKNJw2K3h8iMW4/exec", true);
      xhr.setRequestHeader("Content-Type", "text/plain");
      xhr.onload = function () {
        console.log("Uploaded:", fileName, xhr.responseText);
        resolve();
      };
      xhr.onerror = function () {
        reject(new Error("XHR failed for: " + fileName));
      };
      xhr.send(JSON.stringify({
        investorName: bizName,
        quarter:      quarter,
        fileName:     fileName,
        mimeType:     mimeType,
        data:         base64
      }));
    };
    reader.onerror = function () {
      reject(new Error("FileReader failed for: " + fileName));
    };
    reader.readAsDataURL(file);
  });
}


// =========================
// DOCUMENT READY
// =========================
$(document).ready(function () {


  console.log("READY");
  console.log("SCRIPT LOADED");


  // Generate transmittal number
  $(document).on('click', '#generate-transmittal', function () {
    console.log("CLICKED");
    transmittalNumber = generateTransmittal();
    console.log(transmittalNumber);
    $('#transmittal-number').text(transmittalNumber);
    $('#transmittal-box').show();
  });


  // Payment file inputs
  $('#receipt-input').on('change', function () {
    paymentStore.receipt = this.files[0];
  });


  $('#invoice-input').on('change', function () {
    paymentStore.invoice = this.files[0];
  });


  // Report file inputs
  $(document).on('change', '.custom-file-input', function () {
    var file = this.files[0];
    $(this).siblings('.custom-file-label').text(file ? file.name : "Choose file...");
    var index = parseInt($(this).attr('id').replace('fiac-select', ''));
    if (!isNaN(index) && file) {
      fileStore[index] = file;
    }
  });


  // Step 1 → Step 2
  $('#payment-next').on('click', function () {
    if (!transmittalNumber) {
      alert("Please ensure all fields are filled and the transmittal number is added to your invoice.");
      return;
    }


    var bizName = $('#biz-name-input').val();
    var quarter = $('#quarter-select').val();


    if (!bizName || bizName.trim() === "") {
      alert("Please enter business name.");
      return;
    }
    if (!quarter) {
      alert("Please select a quarter.");
      return;
    }
    if (!paymentStore.receipt || !paymentStore.invoice) {
      alert("Please upload BOTH receipt and invoice.");
      return;
    }


    $('#payment-section').fadeOut(150, function () {
      $('#qr-section').fadeIn(150);
    });
  });


  // Submit report
  $('#qr-upload-form').on('submit', function (e) {
    e.preventDefault();
    console.log("SUBMIT CLICKED");


    // Capture bizName and quarter NOW before anything is hidden
    var bizName = $('#biz-name-input').val().trim();
    var quarter = $('#quarter-select').val();


    if (!bizName) {
      alert("Please enter your business name.");
      return;
    }
    if (!quarter) {
      alert("Please select a quarter.");
      return;
    }
    if (!paymentStore.receipt || !paymentStore.invoice) {
      alert("Please complete payment uploads first.");
      return;
    }


    // Required file check (1-7)
    var labels = {
      1: "Quarterly Report Form",
      2: "Physical Location Section (§3)",
      3: "License Section (§7)",
      4: "Current Employees (§8)",
      5: "Employee Programs (§9)",
      6: "Tax Information (§10-14)",
      7: "Corporate Updates & Loans (§15-17)"
    };


    for (var i = 1; i <= 7; i++) {
      if (!fileStore[i]) {
        alert("Missing required document: " + labels[i]);
        return;
      }
    }


    // Disable submit and show loading screen
$('#qr-upload-form input[type="submit"]').prop("disabled", true);
$('#upload-progress-container').show();
$('#upload-progress-bar').css('width', '0%').text('0%');

    // Build upload queue
    var queue = [];
    queue.push({ file: paymentStore.receipt, key: "receipt" });
    queue.push({ file: paymentStore.invoice, key: "invoice" });
    for (var j = 1; j <= 8; j++) {
      if (fileStore[j]) {
        queue.push({ file: fileStore[j], key: j });
      }
    }


    // Pass bizName and quarter directly — don't read from DOM during upload
uploadSequential(queue, 0, bizName, quarter, queue.length)
  .then(function () {
    // Complete the bar to 100% before showing success
    $('#upload-progress-bar')
      .css('width', '100%')
      .attr('aria-valuenow', 100)
      .text('100%');
    $('#upload-progress-label').text('Upload complete!');

    setTimeout(function () {
      $('#qr-upload-form').hide();
      $('#upload-progress-container').hide();
      $('#confirm-business').text(bizName);
      $('#confirm-quarter').text(quarter);
      $('#success-message').show();
    }, 600);
  })
  .catch(function () {
    alert("One or more files failed to upload.");
    $('#qr-upload-form input[type="submit"]').prop("disabled", false);
    $('#upload-progress-container').hide();
  });

  }); // closes submit handler

}); // closes document.ready
// CHATBOT
var chatHistory = [];
var chatLanguage = "English"; // tracks selected language

function askChatbot(question) {
  if (!question || !question.trim()) return;

  var greetings = ["hi", "hello", "hey", "thanks", "thank you", "ok", "okay", "great",
                   "こんにちは", "ありがとう", "你好", "谢谢"];
  var trimmed = question.trim().toLowerCase().replace(/[^a-z\s\u3040-\u30ff\u4e00-\u9fff]/g, "");
  if (greetings.some(function(g) { return trimmed === g || question.trim() === g; })) {
    var greetingMsg = {
      "English": "Hello! I'm the FIB Submission Assistant. I can help you with questions about the Quarterly Report submission process, required documents, deadlines, and fees. What would you like to know?",
      "Japanese": "こんにちは！FIB提出アシスタントです。四半期報告書の提出プロセス、必要書類、締め切り、手数料についてご質問があればお気軽にどうぞ。",
      "Chinese": "您好！我是FIB提交助手。如有关于季度报告提交流程、所需文件、截止日期或费用的问题，请随时告诉我。"
    };
    $('#chat-log').append('<div class="chat-msg chat-user">' + escapeHtml(question) + '</div>');
    $('#chat-log').append('<div class="chat-msg chat-bot">' + (greetingMsg[chatLanguage] || greetingMsg["English"]) + '</div>');
    scrollChatToBottom();
    $('#chat-input').val('');
    $('#chat-send').prop('disabled', false);
    return;
  }

  $('#chat-log').append('<div class="chat-msg chat-user">' + escapeHtml(question) + '</div>');
  var $thinking = $('<div class="chat-msg chat-bot chat-thinking">Thinking...</div>');
  $('#chat-log').append($thinking);
  scrollChatToBottom();
  $('#chat-input').val('');
  $('#chat-send').prop('disabled', true);

  chatHistory.push({ role: "user", content: question });

  $.ajax({
    url: "https://script.google.com/macros/s/AKfycbw3m19LA8Cy1BG0KJRGvLbLfKqDNkEpmnnU5I_CyYo77cu3I1hN9O9DNsikev8lCzOV/exec",
    method: "POST",
    contentType: "text/plain",
    data: JSON.stringify({
      action: "chatQuestion",
      history: chatHistory,
      language: chatLanguage   // <-- NEW
    }),
    success: function (data) {
      $thinking.remove();
      if (data.status === "success") {
        $('#chat-log').append('<div class="chat-msg chat-bot">' + escapeHtml(data.answer) + '</div>');
        chatHistory.push({ role: "assistant", content: data.answer });
      } else {
        $('#chat-log').append('<div class="chat-msg chat-bot chat-error">Sorry, I ran into an error: ' + escapeHtml(data.message || "unknown error") + '</div>');
      }
      scrollChatToBottom();
      $('#chat-send').prop('disabled', false);
    },
    error: function () {
      $thinking.remove();
      $('#chat-log').append('<div class="chat-msg chat-bot chat-error">Sorry, something went wrong. Please try again.</div>');
      scrollChatToBottom();
      $('#chat-send').prop('disabled', false);
    }
  });
}

$(document).on('change', '#chat-language', function () {
  chatLanguage = $(this).val();
  chatHistory = [];

  var switchMsg = {
    "English": "Language changed to English. How can I help you?",
    "Japanese": "言語が日本語に変更されました。何かお手伝いできますか？",
    "Chinese": "语言已切换为中文。请问有什么可以帮助您？"
  };

  $('#chat-log').append(
    '<div class="chat-msg chat-bot" style="font-style:italic; font-size:13px;">' +
    (switchMsg[chatLanguage] || switchMsg["English"]) +
    '</div>'
  );
  scrollChatToBottom();
});

function escapeHtml(str) {
  return $('<div>').text(str).html();
}

function scrollChatToBottom() {
  var log = document.getElementById('chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}

// Wire up inside your existing $(document).ready(function () { ... }) block:
$(document).on('click', '#chat-send', function () {
  askChatbot($('#chat-input').val());
});
$(document).on('keypress', '#chat-input', function (e) {
  if (e.which === 13) {
    e.preventDefault();
    askChatbot($('#chat-input').val());
  }
});


