/**
 * file_utils.js — Shared file utilities for Antigravity scripts
 * 
 * Provides crash-safe file operations used across all state-managing scripts.
 */

const fs = require('fs');
const path = require('path');

/**
 * Atomic write: write to tmp file first, then rename.
 * Guarantees that the target file is never in a partial state.
 * - If the process crashes during write, only the tmp file is affected.
 * - rename() is atomic on all POSIX filesystems (APFS, ext4, etc.)
 * 
 * @param {string} filepath - Target file path
 * @param {string} data - Content to write
 * @param {string} [encoding='utf8'] - File encoding
 */
function atomicWrite(filepath, data, encoding = 'utf8') {
    const tmp = filepath + `.tmp.${process.pid}`;
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(tmp, data, encoding);
    fs.renameSync(tmp, filepath);
}

/**
 * Safe JSON read: returns null on any failure (missing file, corrupt JSON, etc.)
 * 
 * @param {string} filepath - JSON file path
 * @returns {object|null} Parsed JSON or null
 */
function safeReadJSON(filepath) {
    try {
        return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch {
        return null;
    }
}

/**
 * Atomic JSON write: atomicWrite + JSON.stringify
 * 
 * @param {string} filepath - Target file path
 * @param {object} data - Object to serialize
 */
function atomicWriteJSON(filepath, data) {
    atomicWrite(filepath, JSON.stringify(data, null, 2));
}

module.exports = { atomicWrite, safeReadJSON, atomicWriteJSON };
