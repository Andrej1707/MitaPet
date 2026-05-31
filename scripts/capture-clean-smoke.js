const { app, BrowserWindow, desktopCapturer, screen } = require("electron");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capturePrimaryScreen() {
  const primaryDisplayId = String(screen.getPrimaryDisplay().id);
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 640, height: 360 },
    fetchWindowIcons: false
  });
  const source = sources.find((item) => item.display_id === primaryDisplayId && !item.thumbnail.isEmpty())
    ?? sources.find((item) => item.id.startsWith("screen:") && !item.thumbnail.isEmpty());
  if (!source) {
    throw new Error("No primary screen source found");
  }
  return source.thumbnail;
}

function redPixelRatio(image) {
  const { width, height } = image.getSize();
  const bitmap = image.getBitmap();
  let red = 0;
  let total = 0;
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const offset = (y * width + x) * 4;
      const b = bitmap[offset];
      const g = bitmap[offset + 1];
      const r = bitmap[offset + 2];
      if (r > 220 && g < 80 && b < 80) {
        red += 1;
      }
      total += 1;
    }
  }
  return red / total;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 360,
    height: 240,
    x: 80,
    y: 80,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true
  });
  await win.loadURL("data:text/html,<body style='margin:0;background:red'></body>");
  await delay(600);

  const visibleRatio = redPixelRatio(await capturePrimaryScreen());
  win.hide();
  await delay(200);
  const hiddenRatio = redPixelRatio(await capturePrimaryScreen());
  win.destroy();

  console.log(`visibleRedRatio=${visibleRatio.toFixed(5)}`);
  console.log(`hiddenRedRatio=${hiddenRatio.toFixed(5)}`);

  if (visibleRatio < 0.005) {
    throw new Error("Visible overlay was not detected in primary screen capture");
  }
  if (hiddenRatio >= visibleRatio * 0.35) {
    throw new Error("Hidden overlay still appears in primary screen capture");
  }
  app.quit();
}).catch((error) => {
  console.error(error.message);
  app.exit(1);
});
