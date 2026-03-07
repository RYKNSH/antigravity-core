# Feature Decommissioning Pattern (Tauri/React)

This document describes the standard procedure for completely removing a feature from the Portable Studio app, as demonstrated during the removal of the BGM Player in January 2026.

## Overview
Decommissioning is not just about deleting a file; it's about restoring architectural integrity and security by removing all references and side effects across multiple layers of the application.

## 1. State Management Cleanup (Zustand)
Remove the feature from the global store to prevent unused state from occupying memory or causing reactive updates.
- **Interfaces**: Delete state interfaces and any related types.
- **Initial State**: Remove properties from the store's initial state object.
- **Actions**: Delete all functions that manipulate the removed state.
- **Reference Check**: Ensure no other actions in the store are accidentally calling the removed actions.

## 2. Component & UI Extraction
- **File Deletion**: Physically delete `.tsx`, `.css`, and `.test.ts` files related specifically to the feature.
- **Main Component cleanup**:
    - Remove import statements for the deleted components.
    - Remove the component usage from the JSX tree.
    - Remove any local states or effects (`useEffect`) that were only serving that feature.
- **CSS Purge**: Remove unused classes from global CSS (e.g., `App.css`) to keep the bundle lean.

## 3. Dependency Pruning
Remove any third-party libraries that were only used by the decommissioned feature.
```bash
pnpm remove <package-name>
```
*Example: `pnpm remove react-player` was executed after BGM player removal.*

## 4. Security Policy (CSP) Tightening
If the feature required relaxing security settings (like allowing external frames or script sources), revert these settings to the strictest possible state in `tauri.conf.json`.
- **`connect-src`**: Remove external API endpoints.
- **`frame-src`**: Remove external IFrame origins.
- **`media-src`**: Remove external media stream origins.
- **`script-src`**: Remove external script origins.

## 5. Filesystem Hygiene
On macOS/ExFAT environments, ensure that metadata artifacts are cleared.
```bash
find . -name "._*" -delete
```

## 6. Verification
Run the TypeScript compiler to catch any lingering references in other parts of the app.
```bash
pnpm tsc --noEmit
```

## Case Study: BGM Player Removal
- **Reason**: Excessive friction with YouTube IFrame policies and Tauri `tauri://` protocol restrictions.
- **Result**: Significant reduction in code complexity, tighter CSP (removing all YouTube-related domains), and 100% stability.
