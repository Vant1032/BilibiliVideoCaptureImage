/**
 * 通知contentscript.js执行
 */
function notifyDownload() {
  var message = 'captureImage'
  chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, message, function (response) {
      console.log(response)
    });
  });
}

chrome.commands.onCommand.addListener(function (command) {
  // 按下快捷键则执行视频帧下载
  console.log('Command:', command);
  if (command === 'BilibiliCaptureImage') {
    notifyDownload()
  }
});

chrome.runtime.onInstalled.addListener(() => {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'capture',
    title: 'B站视频截图',
    contexts: ['page']
  })
})

chrome.contextMenus.onClicked.addListener(
  function (info, tab) {
    if (info.menuItemId === 'capture') {
      notifyDownload()
    }
  },
)
