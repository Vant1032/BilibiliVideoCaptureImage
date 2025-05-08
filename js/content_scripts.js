function captureVideoImage() {
  var v = document.querySelector(".bpx-player-video-wrap video");
  var myCanvas = new OffscreenCanvas(v.videoWidth, v.videoHeight);
  var ctx = myCanvas.getContext('2d');
  ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight);
  
  // 将图片同时保存到文件和剪贴板
  myCanvas.convertToBlob().then(blob => {
    // 保存到剪贴板
    try {
      const item = new ClipboardItem({ "image/png": blob });
      navigator.clipboard.write([item]).then(() => {
        console.log("Image copied to clipboard successfully!");
      }).catch((error) => {
        console.error("Error copying image to clipboard:", error);
      });
    } catch (error) {
      console.error("Error creating clipboard item:", error);
    }

    // 保存文件的原有逻辑
    var d = new Date();
    var timeStr = '' + d.getFullYear() + (d.getMonth() + 1) + d.getDate() + d.getHours() + d.getMinutes() + d.getSeconds();
    const fileName = 'screenshot-' + timeStr + '.png';
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(a.href);
  });
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  captureVideoImage();
});
