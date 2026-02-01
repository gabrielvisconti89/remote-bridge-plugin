# Privacy Policy

**Last updated: January 31, 2026**

## Overview

Claude Bridge ("the App") is a remote control application that allows users to send commands to their own computers from mobile devices. This privacy policy explains how we handle your data.

## Data Collection

### What We Collect

**Locally Stored Data:**
- Server connection details (host, port, API key)
- Command history
- App settings and preferences

**We Do NOT Collect:**
- Personal information
- Usage analytics
- Location data
- Device identifiers
- Any data from your connected servers

### Where Data is Stored

All data is stored locally on your device using secure storage mechanisms provided by the operating system. No data is transmitted to our servers or any third parties.

## Data Transmission

### Between Your Devices

When you use Claude Bridge, data is transmitted between:
- Your mobile device (running the Claude Bridge app)
- Your computer (running the Claude Bridge skill server)

This communication occurs:
- Over your local network (if using local IP)
- Through a temporary public tunnel (if using the tunnel feature)

### Security

- All connections can be secured with an API key
- HTTPS/WSS encryption is supported
- Tunnel URLs are temporary and randomized

## Third-Party Services

### Localtunnel

The skill server uses [localtunnel](https://localtunnel.me) to create temporary public URLs. When using this feature:
- Your server becomes temporarily accessible via a random URL
- Traffic passes through localtunnel's servers
- No data is stored by localtunnel

You can avoid using localtunnel by connecting via local network instead.

## Your Rights

You have the right to:
- **Access**: View all stored data in the app's settings
- **Delete**: Clear all data using "Clear All Data" in settings
- **Portability**: Export your connection settings (coming soon)

## Data Retention

- Connection data is retained until you delete it
- Command history can be limited in settings
- Uninstalling the app removes all local data

## Children's Privacy

Claude Bridge is not intended for use by children under 13. We do not knowingly collect data from children.

## Changes to This Policy

We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.

## Contact

If you have questions about this privacy policy, please contact us:

- GitHub Issues: https://github.com/gabrielvisconti/claude-bridge/issues
- Email: [your-email@example.com]

## Open Source

Claude Bridge is open source software. You can review the complete source code to verify our privacy practices:

https://github.com/gabrielvisconti/claude-bridge
