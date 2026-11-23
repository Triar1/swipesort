# SwipeSort privacy information

This document describes the current **v1.4.0 source code**. It is not a guarantee about modified forks or third-party distribution packages.

- **Photos:** The app reads photos from the device's media library after the user grants permission. Photos are displayed locally and are not sent to a SwipeSort server.
- **Decisions:** Photo IDs, local URIs, filenames, keep/delete choices, categories and local preferences are stored on the device with AsyncStorage. They are not transmitted to a SwipeSort server.
- **Device modifications:** A left swipe alone does not delete an original. Device deletion and moving kept photos to albums require separate user action; the operating system may ask for additional confirmation.
- **No analytics or login:** The project does not include ad SDKs, analytics, accounts or tracking code.
- **Building the app:** If you choose to compile with EAS Build, your **application source code** is uploaded to Expo's build infrastructure. This does not mean personal gallery contents are uploaded when using SwipeSort.
- **Data retention:** Local decisions usually persist across an in-place app update, but uninstalling or clearing app data may erase them.
- **Data removal:** Uninstalling the app removes its locally stored decisions on most devices. Previously moved or deleted photos are not restored by uninstalling.

**Warning:** Media access and Android gallery behavior vary by Android version and manufacturer. Test with copies, retain backups, and inspect the permissions shown during installation.
