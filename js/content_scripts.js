function captureVideoImage() {
  // 获取当前视频帧数据
  var v = document.querySelector(".bpx-player-video-wrap video");
  var myCanvas = new OffscreenCanvas(v.videoWidth, v.videoHeight);
  var ctx = myCanvas.getContext('2d');
  ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight)
  myCanvas.convertToBlob().then(blob => {
    // 将视频帧下载
    const fileName = 'screenshot.png';
    const d = document.createElement('a')
    d.href = window.URL.createObjectURL(blob)
    d.download = fileName
    d.style.display = 'none'
    document.body.appendChild(d)
    d.click()
    document.body.removeChild(d)
    window.URL.revokeObjectURL(d.href)
  })
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  captureVideoImage()
});
