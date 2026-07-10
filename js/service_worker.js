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
  console.log('Command:', command);
  if (command === 'BilibiliCaptureImage') {
    notifyDownload()
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'capture',
    title: 'B站视频/直播间截图',
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
