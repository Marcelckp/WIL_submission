# Smart Invoice Capture - Android App

## Setup Instructions

1. **Open in Android Studio**
   - Open Android Studio
   - Select "Open an Existing Project"
   - Navigate to the `android/` directory
   - Wait for Gradle sync to complete

2. **Configure API Base URL**
   - The API base URL is configured in `app/build.gradle.kts`
   - For Android Emulator: `http://10.0.2.2:3000/api` (default)
   - For physical device: Update to your computer's IP address (e.g., `http://192.168.1.100:3000/api`)

3. **Build and Run**
   - Ensure backend server is running on port 3000
   - Run the app from Android Studio

## Architecture

- **MVVM Pattern**: Model-View-ViewModel architecture
- **Room Database**: Local SQLite cache for BOQ items and draft invoices
- **Retrofit**: REST API client for backend communication
- **Coroutines & Flow**: Asynchronous operations and reactive data
- **WorkManager**: Background sync for invoice status updates

## Key Features

- **Offline-first**: BOQ items cached locally, invoices can be created offline
- **Real-time updates**: Polls server every 10 seconds for invoice status changes
- **PDF viewer**: Displays approved invoices in-app
- **Image capture**: Take/upload photos as invoice evidence

## Database Schema

- `boq_items`: Cached BOQ items from server
- `invoices`: Draft and synced invoices
- `invoice_lines`: Line items for each invoice

## Next Steps

- Implement UI Activities/Fragments
- Add ViewModels for each screen
- Implement image capture and gallery selection
- Add PDF viewer integration
- Set up WorkManager for background sync
