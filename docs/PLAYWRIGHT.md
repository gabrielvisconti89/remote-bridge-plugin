# Playwright Screenshot Integration

Remote Bridge can integrate with Playwright MCP to capture and share screenshots between Claude Code and the mobile app.

## Overview

The screenshot feature allows:

1. **Screenshot Capture:** Take screenshots from Claude Code using Playwright MCP
2. **Screenshot Viewing:** View screenshots on the mobile app
3. **Image Upload:** Send images from mobile to Claude Code for analysis

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLAUDE CODE                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Playwright MCP                              │  │
│  │    browser_take_screenshot → PNG → screenshotManager          │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PLUGIN SERVER                                │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ Screenshot      │    │  Static File    │    │   WebSocket     │ │
│  │ Manager         │───▶│   Server        │───▶│   Broadcast     │ │
│  │ ~/.../screenshots│    │  /screenshot/*  │    │                 │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MOBILE APP                                   │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ Screenshot      │    │  Screenshot     │    │    Image        │ │
│  │ Service         │    │   Viewer        │    │   Upload        │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Screenshot Capture API

### POST /screenshot/capture

Trigger a screenshot capture via Playwright MCP.

**Request:**
```bash
curl -X POST http://localhost:3000/screenshot/capture \
  -H "X-API-Key: {api-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "selector": "body",
    "fullPage": false
  }'
```

**Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `selector` | string | No | Element selector to screenshot |
| `fullPage` | boolean | No | Capture full page (default: false) |

**Response:**
```json
{
  "success": true,
  "id": "scr_abc123def456",
  "path": "/Users/.../screenshots/scr_abc123def456.png",
  "url": "https://xxx.loca.lt/screenshot/scr_abc123def456",
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

### GET /screenshot/latest

Get the most recent screenshot.

**Request:**
```bash
curl http://localhost:3000/screenshot/latest \
  -H "X-API-Key: {api-key}" \
  --output screenshot.png
```

**Response:** Binary PNG image

### GET /screenshot/:id

Get a specific screenshot by ID.

**Request:**
```bash
curl http://localhost:3000/screenshot/scr_abc123def456 \
  -H "X-API-Key: {api-key}" \
  --output screenshot.png
```

**Response:** Binary PNG image

### GET /screenshots

List all available screenshots.

**Request:**
```bash
curl http://localhost:3000/screenshots \
  -H "X-API-Key: {api-key}"
```

**Response:**
```json
{
  "success": true,
  "screenshots": [
    {
      "id": "scr_abc123def456",
      "timestamp": "2026-02-02T12:00:00.000Z",
      "size": 245760,
      "url": "https://xxx.loca.lt/screenshot/scr_abc123def456"
    }
  ]
}
```

### DELETE /screenshot/:id

Delete a screenshot.

**Request:**
```bash
curl -X DELETE http://localhost:3000/screenshot/scr_abc123def456 \
  -H "X-API-Key: {api-key}"
```

**Response:**
```json
{
  "success": true,
  "message": "Screenshot deleted"
}
```

## Image Upload API

### POST /image/upload

Upload an image from mobile app to Claude Code.

**Request:**
```bash
curl -X POST http://localhost:3000/image/upload \
  -H "X-API-Key: {api-key}" \
  -F "file=@photo.jpg"
```

**Response:**
```json
{
  "success": true,
  "path": "/Users/.../uploads/img_abc123.jpg",
  "message": "Image uploaded and ready for Claude to analyze"
}
```

## WebSocket Messages

### Screenshot Available

When a new screenshot is captured:

```json
{
  "type": "screenshot.available",
  "id": "scr_abc123def456",
  "url": "https://xxx.loca.lt/screenshot/scr_abc123def456",
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

### Image Uploaded

When an image is uploaded from mobile:

```json
{
  "type": "image.uploaded",
  "path": "/Users/.../uploads/img_abc123.jpg",
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

## Screenshot Manager

The screenshot manager handles file storage and lifecycle.

### Storage Location

Screenshots are stored in: `~/.claude/remote-bridge/screenshots/`

### File Format

- **Format:** PNG
- **Naming:** `scr_{random_id}.png`
- **Compression:** Standard PNG compression

### Auto-cleanup

Old screenshots are automatically cleaned up:

- Keep last 20 screenshots by default
- Delete screenshots older than 24 hours
- Manual cleanup via DELETE endpoint

## Playwright MCP Integration

The screenshot feature uses the Playwright MCP tool:

```javascript
// Using Playwright MCP to capture screenshot
const result = await useMcpTool('mcp__plugin_playwright_playwright__browser_take_screenshot', {
  type: 'png',
  filename: `screenshots/${id}.png`
});
```

### Available Playwright Options

| Option | Type | Description |
|--------|------|-------------|
| `type` | string | Image format: `png` or `jpeg` |
| `fullPage` | boolean | Capture full scrollable page |
| `element` | string | Element description to screenshot |
| `ref` | string | Element reference from snapshot |

## Mobile App Integration

### Screenshot Service

```typescript
@Injectable({ providedIn: 'root' })
export class ScreenshotService {
  private apiService = inject(ApiService);

  captureScreenshot(options?: CaptureOptions): Observable<Screenshot> {
    return this.apiService.post('/screenshot/capture', options);
  }

  getScreenshot(id: string): Observable<Blob> {
    return this.apiService.getBlob(`/screenshot/${id}`);
  }

  getScreenshots(): Observable<Screenshot[]> {
    return this.apiService.get<{screenshots: Screenshot[]}>('/screenshots')
      .pipe(map(r => r.screenshots));
  }

  uploadImage(file: File): Observable<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.apiService.postFormData('/image/upload', formData);
  }
}
```

### Screenshot Viewer Component

Display screenshots inline in chat:

```typescript
@Component({
  selector: 'app-screenshot-viewer',
  template: `
    <div class="screenshot-container" (click)="openFullscreen()">
      <img [src]="screenshotUrl" alt="Screenshot">
      <div class="overlay">
        <ion-icon name="expand-outline"></ion-icon>
      </div>
    </div>
  `
})
export class ScreenshotViewerComponent {
  @Input() screenshotId: string;
  screenshotUrl: string;
}
```

### Image Upload Component

Capture and upload images:

```typescript
@Component({
  selector: 'app-image-upload',
  template: `
    <ion-button (click)="selectImage()">
      <ion-icon name="camera"></ion-icon>
    </ion-button>
  `
})
export class ImageUploadComponent {
  async selectImage() {
    const image = await Camera.getPhoto({
      quality: 90,
      source: CameraSource.Prompt,
      resultType: CameraResultType.Uri
    });

    const file = await this.uriToFile(image.webPath);
    this.screenshotService.uploadImage(file).subscribe();
  }
}
```

## Use Cases

### 1. Debugging UI Issues

```
User: Screenshot the current page
Claude: *captures screenshot using Playwright*
         Screenshot available at: https://xxx.loca.lt/screenshot/scr_abc123
User: *views screenshot in mobile app*
User: The button is cut off on the right side
```

### 2. Sharing Progress

```
Claude: I've updated the login page. Here's a screenshot.
        *captures and sends screenshot*
User: *views on mobile* Looks good! Can you make the logo bigger?
```

### 3. Image Analysis

```
User: *uploads photo of error message*
Claude: I can see the error. It says "Cannot read property 'map' of undefined".
        Let me fix that...
```

## Configuration

### Storage Limits

```javascript
// screenshotManager.js configuration
const config = {
  maxScreenshots: 20,      // Maximum stored screenshots
  maxAge: 24 * 60 * 60,    // Max age in seconds (24 hours)
  compressionQuality: 90,  // JPEG quality (if using JPEG)
  maxImageSize: 10 * 1024 * 1024  // 10MB max upload size
};
```

### Directory Structure

```
~/.claude/remote-bridge/
├── screenshots/           # Captured screenshots
│   ├── scr_abc123.png
│   └── scr_def456.png
├── uploads/               # Uploaded images
│   └── img_ghi789.jpg
└── ...
```

## Security Considerations

- Screenshots may contain sensitive information
- Uploaded images go through the same API key authentication
- Consider limiting screenshot access to current session
- Auto-cleanup helps prevent sensitive data accumulation

## See Also

- [API Reference](API.md) - Full API documentation
- [Architecture](ARCHITECTURE.md) - System design
- [Security](SECURITY.md) - Security practices
