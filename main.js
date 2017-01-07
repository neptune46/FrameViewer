
const { app, BrowserWindow } = require('electron')
const path = require('path')
const url = require('url')
const childProcess = require('child_process');
const fs = require('fs');

var procFFmpeg;
var procMediaInfo;
var timerFileCount;
var lastFileIndex = 0;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWin;
let displayWin;

function createWindow() {
    // Create the browser window.
    mainWin = new BrowserWindow({ width: 800, height: 600 })

    // and load the index.html of the app.
    mainWin.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }))

    // Open the DevTools.
    // mainWin.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWin.on('closed', () => {

        clearInterval(timerFileCount);

        if (typeof (procFFmpeg) !== "undefined") {
            procFFmpeg.kill('SIGKILL');
        }

        cleanupImgFolderSync();

        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWin = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q

    clearInterval(timerFileCount);

    if (typeof (procFFmpeg) !== "undefined") {
        procFFmpeg.kill('SIGKILL');
    }

    cleanupImgFolderSync();

    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWin === null) {
        createWindow()
    }
})

process.on('exit', function () {

    clearInterval(timerFileCount);

    if (typeof (procFFmpeg) !== "undefined") {
        procFFmpeg.kill('SIGKILL');
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

var videoFileName;
var videoFullPath;
var isCompressedVideo;
var videoFormat;
var videoWidth;
var videoHeight;

const {ipcMain} = require('electron');

var pixfmtList = [
    "yuv420p",
    "yuv422p",
    "yuv444p",
    "yuv410p",
    "yuv411p",
    "nv12",
    "nv21",
    "argb",
    "p010le",
    "p010be"
];

function cleanupImgFolderSync() {
    childProcess.execSync("del img\\*.png");
}

function cleanupBmpFolderSync() {
    childProcess.execSync("del bmp\\*.bmp");
}

function getRawVideoInfoFromFileName(inFileName) {
    var pixFmt = "";
    var resolution = "";
    var width, height;
    var fileName = inFileName.toLocaleLowerCase();
    for (var i = 0; i < pixfmtList.length; i++) {
        if (fileName.indexOf(pixfmtList[i]) != -1) {
            pixFmt = pixfmtList[i];
            var str = fileName.split("_");
            for (var n = 0; n < str.length; n++) {
                if (str[n].split("x").length == 2) {
                    width = str[n].split("x")[0];
                    height = str[n].split("x")[1];
                    resolution = width + "x" + height;
                    return [pixFmt, resolution];
                }
            }
            break;
        };
    }
    return [pixFmt, resolution];
}

function execFFmpeg(inFilePath, inFileName, cmdArg, event) {
    procFFmpeg = childProcess.spawn("ffmpeg.exe", cmdArg, { detached: true });
    procFFmpeg.on('close', function (data) {
        //console.log("ffmpeg execution done!!");
        clearInterval(timerFileCount);
        readFileCount(".\\img", lastFileIndex, event);
    });
}

function readFileCount(path, lastIndex, event) {
    var fileBegin, fileEnd;
    fs.readdir(path, function (err, files) {
        if (err === null) {
            fileBegin = lastIndex + 1;
            fileEnd = files.length;
            //console.log("[" + fileBegin + ", " + fileEnd + "]");
            if (typeof(event) !== "undefined"){
                event.sender.send('update-html-page', fileBegin, fileEnd);
            }
            lastFileIndex = files.length;
        }
    });
}

ipcMain.on("file-dropped-in", (event, fileFullPath, fileName) => {
    videoFileName = fileName;
    videoFullPath = fileFullPath;
    var cmdLine = 'MediaInfo.exe "--Inform=Video;%Format%_%Width%_%Height%_%FrameCount%" ' + fileFullPath;
    procMediaInfo = childProcess.exec(cmdLine, function (error, stdout, stderr) {
        isCompressedVideo = (stdout.split('_').length === 4);
        if (isCompressedVideo) {
            var videoInfo = stdout.split('_');
            videoFormat = videoInfo[0];
            videoWidth = videoInfo[1];
            videoHeight = videoInfo[2];
            event.sender.send('init-html-page', fileFullPath, videoInfo, 0);
            // cleanup temp folder before ffmpeg execution
            cleanupImgFolderSync();
            var cmdArg = [
                '-i', fileFullPath,
                '-vframes', '20000',
                '-vf', 'scale=100:-1',
                'img\\' + fileName + '.%06d.png'
            ];
            // invoke ffmepg to generate frame image
            execFFmpeg(fileFullPath, fileName, cmdArg, event);
        } else {
            var pixFmt, resolution;
            [pixFmt, resolution] = getRawVideoInfoFromFileName(fileName);

            if (pixFmt.length && resolution.length) {
                var width = resolution.split('x')[0];
                var height = resolution.split('x')[1];
                var videoInfo = [pixFmt, width, height, "TODO"];
                videoFormat = videoInfo[0];
                videoWidth = videoInfo[1];
                videoHeight = videoInfo[2];
                event.sender.send('init-html-page', fileFullPath, videoInfo, 0);
                var cmdArg = [
                    '-pix_fmt', pixFmt,
                    '-s', resolution,
                    '-i', fileFullPath,
                    '-vframes', '20000',
                    '-vf', 'scale=100:-1',
                    'img\\' + fileName + '.%06d.png'
                ];
                // invoke ffmepg to generate frame image
                execFFmpeg(fileFullPath, fileName, cmdArg, event);
            } else {
                console.log("ERROR: cannot recognize raw video info from file name!");
            }
        }
    });

    // periodically triger renderer process to upate HTML page with new img tag
    var path = ".\\img";
    (function (callback, event) {
        timerFileCount = setInterval(function () {
          callback(path, lastFileIndex, event);
        }, 200)
    })(readFileCount, event);
})

ipcMain.on('click-thumbnail', (event, frameIndex) => {
    var winWidth = Number(videoWidth) + Number(videoWidth) / 10;
    var winHeight = Number(videoHeight) + Number(videoHeight) / 5;
    displayWin = new BrowserWindow({ width: winWidth, height: winHeight, show: false });
    displayWin.loadURL(url.format({
        pathname: path.join(__dirname, 'display.html'),
        protocol: 'file:',
        slashes: true
    }))

    displayWin.webContents.on('did-finish-load', function () {
        cleanupBmpFolderSync();
        var firstPart;
        if (isCompressedVideo) {
            firstPart = "-i " + videoFullPath + " ";
        } else {
            firstPart = "-pix_fmt " + videoFormat + " -s " + videoWidth + "x" + videoHeight + " -i " + videoFullPath + " ";
        }
        var startFrame = frameIndex.toString();
        var endFrame = (frameIndex + 1).toString();
        var midPart = " -vf trim=start_frame=" + startFrame + ":end_frame=" + endFrame + " -y ";
        var bmpFile = '.\\bmp\\' + videoFileName + '.bmp';
        var lastPart = midPart + bmpFile;
        var cmdLine = "ffmpeg.exe " + firstPart + lastPart;
        childProcess.exec(cmdLine, function (error, stdout, stderr) {
            displayWin.webContents.send('display-image-ready', bmpFile);
        });
    })

    ipcMain.on('display-html-ready', function (event, arg) {
        //console.log(arg);
        displayWin.show();
    })
})
