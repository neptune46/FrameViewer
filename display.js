
const ipcRenderer = require('electron').ipcRenderer;

ipcRenderer.on('display-image-ready', function (event, arg) {
    console.log("frame display process: " + arg);

    var imgTag = $("<img>").attr({
        "src": arg,
    });

    $('body').append(imgTag);
    event.sender.send('display-html-ready', 'ok')
})

