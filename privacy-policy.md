# Privacy Policy — MeasureTool

**Last updated: 2026-05-13**

## Overview

MeasureTool is a browser extension that provides on-page measurement tools for web designers and developers. This privacy policy explains how the extension handles data.

## Data Collection

MeasureTool **does not collect any data**. Specifically:

- No personal information is collected
- No page content, form data, or user input is read or stored
- No browsing history or activity is tracked
- No analytics or telemetry is sent anywhere

## Data Storage

The extension stores only one preference locally on your device:

- **Panel width setting** — saved via `chrome.storage.local` to remember your UI layout preference

This data never leaves your device and is automatically deleted when the extension is uninstalled.

## Network Activity

MeasureTool makes **no network requests**. There are no external servers, APIs, or third-party services involved.

## Permissions

The extension requires the following permissions:

- **Access to all websites** (`<all_urls>`): Required to display the measurement overlay on any page the user is visiting. No page content is read or transmitted.
- **scripting**: Required to inject the measurement UI when the user activates the tool by clicking the toolbar icon.
- **storage**: Required to save the panel width preference locally.

## Contact

If you have any questions about this privacy policy, please open an issue on the project repository.
