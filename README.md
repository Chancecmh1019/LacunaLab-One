# LLS-One

繁體中文字幕／歌詞影片製作工具。

## 音訊匯入

- 原生支援並辨識 M4A、Opus/Ogg、MP3、AAC、WAV、FLAC、AIFF 等常見音訊格式。
- 使用 `music-metadata` 直接讀取音訊標籤、封面、時長與可用的內嵌歌詞，不再依賴外部 `jsmediatags` script。
- 匯入時同時驗證 `<audio>` 預覽與 Web Audio 解碼能力。
- 若瀏覽器無法直接解碼某個 M4A/Opus codec，會延遲載入 FFmpeg WASM，於瀏覽器本機建立 PCM WAV 相容副本，再交給預覽、剪輯與輸出流程。
- 原始檔仍保留在 `sourceAudioFile`，相容副本只用於瀏覽器內部處理。

> 第一次遇到需要轉換的格式時，瀏覽器會下載 FFmpeg WASM core；原始音訊不需要上傳到伺服器。

## 開發

```bash
npm install
npm run dev
```

## 建置

```bash
npm run build
```
