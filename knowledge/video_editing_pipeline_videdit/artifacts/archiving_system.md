# Videdit Archiving System (Pattern 311)

## 1. Concept: Metadata-Driven Hybrid Cloud Archiving
The "Cloud-Hybrid" pattern addresses the tension between **high-volume binary assets** (videos, raw footage) and the need for **searchable, structured history**.

### The Hybrid Split
Instead of archiving everything to a single location, the data is split by value and weight:
1.  **Light & High-Value (Notion)**: Structured metadata, statistics, thumbnails, and links. This provides the "Search & Preview" layer.
2.  **Heavy & Low-Access (Google Drive / S3)**: Actual video files, project JSONs, and source material. This provides the "Persistence & Recovery" layer.

## 2. Implementation Architecture

### Backend: `ArchiveService`
- **Location**: `backend/services/archive_service.py`
- **Responsibilities**:
    - Orchestrating `GDriveClient` and `NotionClient`.
    - Automated pruning and thumbnail generation.
    - Calculating project statistics (duration, short count, and total MB).
- **Technical Note (API Resilience)**: FastAPI/Pydantic models (like `ArchiveRequest`) require explicit `typing` imports (e.g., `from typing import List`) to avoid `NameError` during startup, even if standard `list` is available in newer Python versions, to ensure compatibility with strict type-checking middleware.

### Storage: `GDriveClient`
- **Location**: `backend/services/gdrive_client.py`
- **Pattern**: Monthly subfolder organization (`Videdit_Archives/YYYY-MM/ProjectName/`).
- **Mechanism**: Recursive upload ensuring nested directories (shorts, assets) are preserved.

### Metadata: `NotionArchiveClient`
- **Location**: `backend/services/notion_client.py`
- **Pattern**: Creating database pages with visual cover images and direct storage links in a standardized database schema.

## 3. The Archiving Workflow

### Phase 1: Pruning (Asset Selection)
Automated deletion of intermediate or redundant files to save cloud storage:
- **Pruned**: `*_draft.mp4`, `._*` macOS sidecar files, temporary FFmpeg logs.
- **Retained**: `project.json`, final MP4 exports, approved thumbnails.

### Phase 2: Visual Indexing
- Extraction of a key frame (thumbnail) from the first approved short using FFmpeg.
- This thumbnail is uploaded to the cloud and set as the "Cover" in the Notion Gallery view for visual searchability.

### Phase 3: Atomic Synchronization
1.  **Upload to GDrive**: A project folder is created and files are uploaded recursively. A unique shareable folder link is generated.
2.  **Sync to Notion**: The folder link, project stats, and thumbnail are injected into the "Videdit Archives" database as a new entry.

## 4. Notion Database Schema

| Property | Notion Type | Description |
|----------|-------------|-------------|
| **Project Name** | Title | Primary identifier (Project ID). |
| **Thumbnail** | Files & Media | Cover image for Gallery view. |
| **Project Status** | Select | Fixed to `Archived`. |
| **Storage Link** | URL | Link to the Google Drive folder. |
| **Archived At** | Date | Timestamp of archive action. |
| **Shorts Count** | Number | Total count of segments. |
| **Total Duration** | Number | Duration in seconds (for aggregate stats). |
| **Total Size** | Number | Size in MB recorded at time of archive. |

## 5. Frontend Implementation & UX
- **Location**: `apps/dashboard/src/app/short-reviewer/page.tsx`
- **Archive Button**: Purple/Indigo gradient button (`bg-gradient-to-r from-purple-600 to-indigo-600`) located in the header next to the Bulk Export button.
- **Workflow**:
    1. **Trigger**: User clicks "Archive".
    2. **Confirmation**: A standard browser dialog (`window.confirm`) warns about draft deletion and cloud upload.
    3. **State Management**: `isArchiving` state prevents double clicks and provides feedback ("アーカイブ中...").
    4. **API Call**: `POST /jobs/{job_id}/archive` with `delete_local: false` (default) and tags.
    5. **Feedback**: Shows an alert with the direct Google Drive link upon success, or an error message on failure.
- **Verification Result (2026-02-07)**:
    - **Visual**: The Archive button is correctly rendered with a purple/indigo gradient (`from-purple-600 to-indigo-600`).
    - **Position**: Located in the top header, immediately to the right of the green Export button.
    - **UX**: Confirmation dialog (`window.confirm`) successfully triggers before the request is dispatched.
- **Project Selection Interaction**: The Archive button is visible only when a project (`selectedJobId`) is active.
- **State Integration (Pattern 305)**: 
    - アーカイブボタンの有効化は大容量エクスポートと同様、バックエンドから復元された「承認済みステート」に依存します。
    - `approvedShorts` が空の場合でもボタンは表示されますが、実際にアーカイブを実行すると、プロジェクト全体の構成データ (`project.json`) と承認済み動画の両方が対象となります。

- **Deployment & Environment Resilience**:
    - **SDK Installation**: `uv pip install -p .venv/bin/python google-api-python-client google-auth-httplib2 google-auth-oauthlib notion-client` による確実なツールチェーン配備。
    - **Mock Mode**: API認証情報（GDrive/Notion）が欠落している場合、システムは警告をログに記録するのみで、パイプラインのクラッシュを回避します。
    - **GCP OAuth Setup**: Google Drive操作には OAuth 2.0 クライアント ID JSON (`credentials.json`) が必須です。
    - **Auth Script**: `scripts/auth_gdrive.py` を実行して `token.json` を生成することでAgentの自律操作を確立。手順は `README_AUTH.md` に集約。
    - **Venv Resilience**: Environment-level issues with `pip` on portable storage are mitigated by using `uv` for package management.
    - **Zero-Local Footprint**: Once archived, local project data can be optionally removed (via `delete_local: true` parameter) to free up SSD space.
