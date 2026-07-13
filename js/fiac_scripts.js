// Preset filenames for upload
var fileNameMap = new Map([
    [1 , "1. FIAC.pdf"], 
    [2 , "2. Commercial Documents (§6 and 7).pdf"],
    [3, "3. Business Profiles (§8 and 9).pdf"], 
    [4, "4. Affiliated Enterprises (§10, 11, and 12).pdf"], 
    [5, "5. Proof of Financial Responsibility (§13).pdf"], 
    [6, "6. Financial Statement (§13 d) i.).pdf"], 
    [7, "7. Business Proposal (§14).pdf"], 
    [8, "8. Applicant Attachment (§15).pdf"] 
]);

// Upload error & progress notifications
function UIfeedBack(name, list) {
    console.log(name + " Create Error");
    document.getElementById("loading-list").style.display = "none";
    document.getElementById(list + "-list").style.display = "block";
}

// Enterprise Folder Creation
function entFolderCreate() {
    
    var bizName = document.getElementById("biz-name-input").value.trim();
    var currYear = new Date().getFullYear(); 
    var fileName = " - " + currYear + "; " + bizName; // User Input
    
    var uploadUrl = 'https://api.box.com/2.0/folders';
    var uploadHeader = {
        'Authorization': 'Bearer njmU875NmYxt0w1edQzFcGUcM4v300yf'
    };

    $.ajax({       
        url: uploadUrl,
        headers: uploadHeader,
        type:'POST',
        data: JSON.stringify({ name: fileName, parent: { id: '83025545413' } }),
        // Prevent JQuery from appending as querystring:
        cache: false,
        contentType: 'json',
        processData: false,
        success: function(data){ 
            appFolderCreate(data["id"]);
        },
        error: function(data){
            UIfeedBack("Enterprise Folder", "name"); 
        }
    });
}

function appFolderCreate(folderId) {
    
    var fileName = "Application";
    var uploadUrl = 'https://api.box.com/2.0/folders';
    var uploadHeader = {
        'Authorization': 'Bearer njmU875NmYxt0w1edQzFcGUcM4v300yf'
    };

    $.ajax({       
        url: uploadUrl,
        headers: uploadHeader,
        type:'POST',
        data: JSON.stringify({ name: fileName, parent: { id: folderId } }),
        // Prevent JQuery from appending as querystring:
        cache: false,
        contentType: 'json',
        processData: false,
        success: function(data){ 
            uploadFiles(data["id"], folderId);
        },
        error: function(data){
            UIfeedBack("App Folder", "fail"); 
        }
    });

}

function uploadFiles(appFolderID, entFolderID) {

    var apiCalls = [];

    for (var i = 1; i <= 8; i++) { 
        var file = $("#fiac-select" + i.toString(10))[0]; 

        // Skip blank file uploads
        if (file.files.length == 0) {
            continue;
        } else if (i == 6) {
            apiCalls.push( privFolderHandler(entFolderID, file.files[0]) );
        }
        else {
            apiCalls.push( fileUpload(file.files[0], appFolderID, i) ); 
        }
    };

    // Display appropriate prompt 
    //      WHEN async calls done
    $.when.apply($, apiCalls)
    .then(
        function () {
            var errorPresent = $("#fail-list").is(":visible") || $("#name-list").is(":visible")
            if ( !errorPresent ) {
                UIfeedBack("SUCCESS: There is no","success");
            }
    });
}

// Implemented embedded Promise, to accomodate Promise.all / .when in uploadFiles()
function privFolderHandler(folderId, file) {
    console.log("Creating Priv Folder");
    //When private folder uploaded, upload private file
    privFolderUpload(folderId, file)
        .then(data => {
            console.log("Uploading Priv File");
            return fileUpload(file, data["id"], 6);
        })
        .catch(data => {
            console.log("Failed Uploading Priv Folder");
            UIfeedBack("Private Folder", "fail");
            return fileUpload(file, data["id"], 6);  
        });
}

function privFolderUpload(folderId, file) {
    return new Promise((resolve, reject) => {
    
    var fileName = "Private Documents";
    var uploadUrl = 'https://api.box.com/2.0/folders';
    var uploadHeader = {
        'Authorization': 'Bearer njmU875NmYxt0w1edQzFcGUcM4v300yf'
    };

    $.ajax({       
        url: uploadUrl,
        headers: uploadHeader,
        type:'POST',
        data: JSON.stringify({ name: fileName, parent: { id: folderId } }),
        // Prevent JQuery from appending as querystring:
        cache: false,
        contentType: 'json',
        processData: false,
        success: function(data){ 
            resolve(data);
        },
        error: function(data){
            reject(data); 
        }
    });
    })
}

function fileUpload(file, parentID, i) {

    var fileName = fileNameMap.get(i);
    var reader = new FileReader();

    reader.onload = function() {

        var base64Data = reader.result.split(',')[1];

        fetch('https://script.google.com/macros/s/AKfycbxA35GtP0J4BTnOia7_g4uFV9VlfqUBMUtEvNf2AVuat0BLxj8Ousv7KlN1lWi-bgfQ/exec', {
            method: 'POST',
            body: JSON.stringify({
                fileName: fileName,
                mimeType: file.type,
                data: base64Data
            })
        })
        .then(response => response.text())
        .then(data => {

            console.log(data);

            document.getElementById("loading-list").style.display = "none";
            document.getElementById("success-list").style.display = "block";

        })
        .catch(error => {
            console.error(error);
        });
    };

    reader.readAsDataURL(file);
}

// Master Script Start
$(document).ready(function (e) {

    // Enable Refresh Prompt
    window.onbeforeunload = function() {
        return true;
    };

    // Validity
    $(".custom-file-input").each( function() {
        $(this)[0].setAttribute("accept", ".pdf,application/pdf");
    });

    $('.custom-file-input').on('change', function(){
        // Add fileName to file label
        var fileDir = $(this).val().split("\\");
        var fileName = fileDir[fileDir.length-1]; 
        $(this).next('.custom-file-label').html(fileName);
    }); 

    $('#biz-name-input')[0].oninvalid = function () {
        this.setCustomValidity('Enter a name without using the special characters /, \\, and .');
    };
    $('#biz-name-input')[0].oninput= function () {
        this.setCustomValidity(""); 
    };

    // Other Listeners
    $('#modal-close').on('click', function(){
        document.getElementById("loading-list").style.display = "block";
        document.getElementById("name-list").style.display = "none";
        document.getElementById("loading-modal").style.display = "none";
    });

    // Form Submision
    $('#fiac-upload-form').on('submit', function(e) {

        e.preventDefault();

        document.getElementById("loading-modal").style.display = "block";
        document.getElementById("name-list").style.display = "none";
        document.getElementById("fail-list").style.display = "none";
        document.getElementById("success-list").style.display = "none";

        var selectedFiles = [];

        for (var i = 1; i <= 8; i++) {

            var fileInput = $("#fiac-select" + i)[0];

            if (fileInput.files.length > 0) {

                selectedFiles.push({
                    file: fileInput.files[0],
                    index: i
                });

            }
        }

        console.log("Files selected:", selectedFiles.length);

        selectedFiles.forEach(item => {
            fileUpload(item.file, null, item.index);
        });

    });

});
