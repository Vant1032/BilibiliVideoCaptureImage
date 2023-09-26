function captureVideoImage() {
  // 获取当前视频帧数据
  var v = document.querySelector(".bpx-player-video-wrap video");
  var myCanvas = new OffscreenCanvas(v.videoWidth, v.videoHeight);
  var ctx = myCanvas.getContext('2d');
  ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight)
  myCanvas.convertToBlob().then(blob => {
    // 将视频帧下载
    var d = new Date();
    var timeStr = '' + d.getFullYear() + (d.getMonth() + 1) + d.getDate() + d.getHours() + d.getMinutes() + d.getSeconds();
    const fileName = 'screenshot-' + timeStr + '.png';
    const a = document.createElement('a')
    a.href = window.URL.createObjectURL(blob)
    a.download = fileName
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(a.href)
  })
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  captureVideoImage()
});
