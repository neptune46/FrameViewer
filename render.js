filePath = '';
fileName = '';

const {ipcRenderer} = require('electron');

var dragzone = document.body;
dragzone.ondragover = function (event) {
    //console.log("Drag Over");
    return false;
};
dragzone.ondragleave = function (event) {
    //console.log("Drag Leave");
    return false;
};
dragzone.ondragend = function (event) {
    //console.log("Drag End");
    return false;
};

dragzone.ondrop = function (event) {
    event.preventDefault();
    process.chdir(__dirname);

    fileFullPath = event.dataTransfer.files[0].path;
    fileName = event.dataTransfer.files[0].name;

    ipcRenderer.send('file-dropped-in', fileFullPath, fileName);

    initHTML(filePath);

    return false;
};

ipcRenderer.on('init-html-page', (event, fileFullPath, videoProperty, numFrame) => {
    var prop = "Format: " + videoProperty[0] + "; ";
    prop += "Resolution: " + videoProperty[1] + "x" + videoProperty[2] + "; ";
    prop += "FrameCount: " + videoProperty[3];
    initHTML(fileFullPath, prop, numFrame);
})

ipcRenderer.on('update-html-page', (event, fileBegin, fileEnd) => {
    console.log("render process: " + fileBegin + ", " + fileEnd);
    var prop;
    updateHTML(prop, fileBegin, fileEnd, fileName);
})

var onClickThumbnail = function () {
    console.log('Info: Renderer Process - img is clicked');
    var frameIndex = Number(this.id);
    ipcRenderer.send('click-thumbnail', frameIndex);
}

$(document).ready(function () {
    $('body').on('click', 'img', onClickThumbnail);
})

function initHTML(inFilePath, prop, numFrame) {
    $("ul").empty();
    $("#file").text(inFilePath);
    $("#prop").text(prop);
}

function updateHTML(prop, startIndex, endIndex, inFileName) {
    var titleValue = "VideoFrameViewer - Extracted Frame# " + endIndex.toString();
    $("title").text(titleValue);
    for (i = startIndex; i < endIndex; i++) {
        var path = "img\\" + inFileName + "." + ("000000" + i).substr(-6, 6) + ".png";
        var txt = $("<img>").attr({
            "id" : (i - 1),
            "src": path
        });
        $("ul").append(txt);
    }
}

