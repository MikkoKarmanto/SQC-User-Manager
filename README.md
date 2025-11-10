# SafeQ Cloud User Manager

A desktop application for managing users in SafeQ Cloud environments. Built with Tauri, React, and TypeScript.

## Features

- **User Management**: View and edit users across different authentication providers
- **PIN/OTP Generation**: Generate secure PIN codes and OTP tokens for users
- **Bulk Import**: Import users from CSV files with automatic credential generation
- **Provider Support**: Manage users from multiple authentication providers (Local, Entra ID, etc.)
- **Settings Management**: Configure SafeQ Cloud tenant URL and API key

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Tauri 2 (Rust), SafeQ Cloud API integration
- **UI Components**: Custom React components with CSS
- **State Management**: React hooks and Tauri store plugin
- **Build Tools**: Vite for frontend, Cargo for Rust

## Prerequisites

- Node.js (v18 or later)
- Rust (latest stable)
- SafeQ Cloud environment with API access

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd sqc-user-manager
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure SafeQ Cloud settings:
   - Launch the application
   - Go to Settings tab
   - Enter your SafeQ Cloud tenant URL and API key

## Development

### Frontend Only (Browser Preview)

```bash
npm run dev
```

This starts the Vite dev server for browser-based development without Rust backend.

### Full Desktop App

```bash
npm run tauri dev
```

This compiles the Rust backend and launches the desktop application.

### Build for Production

```bash
npm run build
npm run tauri build
```

## Usage

### User Management

- **Users Tab**: View users grouped by authentication provider
- **Edit Users**: Click on a user to modify details, generate PIN/OTP
- **Settings Tab**: Configure API connection

### CSV Import

- **Import Tab**: Drag and drop CSV files or click to browse
- **Provider Selection**: Choose authentication provider for imported users
- **Auto-Generation**: Enable automatic PIN/OTP generation for empty fields
- **Validation**: Review and edit data before uploading

### CSV Format

The CSV should contain columns for:

- `username` (required)
- `name` (optional)
- `email` (optional)
- `pin` (optional - will be auto-generated if empty)
- `otp` (optional - will be auto-generated if empty)

## Project Structure

```bash
src/
├── components/          # Reusable UI components
├── pages/              # Main application pages
├── services/           # API client and utilities
├── types/              # TypeScript type definitions
└── ...

src-tauri/
├── src/
│   ├── lib.rs          # Tauri commands and setup
│   ├── main.rs         # Application entry point
│   ├── safeq_api.rs    # SafeQ Cloud API client
│   └── settings.rs     # Configuration management
└── ...
```

## API Integration

The application integrates with SafeQ Cloud API endpoints:

- Account information
- Authentication providers
- User management (CRUD operations)
- PIN/OTP generation

## Security

- API keys are stored securely using Tauri's store plugin
- Settings file (`safeq-settings.json`) is gitignored
- No sensitive data is logged or exposed in the UI

## Contributing

1. Follow the existing code style and patterns
2. Add TypeScript types for new data structures
3. Update this README for any new features
4. Test both frontend and backend changes

## License

See LICENSE file for details.
