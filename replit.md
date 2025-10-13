# SquareWords IQ

## Project Overview
SquareWords IQ is a mobile-first word puzzle game powered by Google's Gemini 2.5 Flash API. Players tap adjacent tiles on a letter grid to form words from a themed word list, earning IQ points and building streaks.

## Recent Changes
- **2025-10-13**: Initial Replit setup
  - Configured Python HTTP server to serve static files on port 5000
  - Set up workflow for development server
  - Ready for deployment

## Architecture
- **Frontend**: Pure vanilla JavaScript (ES6 modules)
- **Styling**: CSS with custom properties and responsive grid layout
- **API Integration**: Google Gemini 2.5 Flash for puzzle generation
- **Storage**: localStorage for API key persistence
- **Deployment**: Static files served via Python HTTP server

## Key Files
- `index.html` - Main application structure
- `app.js` - Game logic, state management, and Gemini API integration
- `styles.css` - Neon-glass aesthetic styling
- `README.md` - User-facing documentation

## Development
The app runs on port 5000 using Python's built-in HTTP server with cache-control headers disabled to ensure updates are visible during development.

## User Preferences
None documented yet.
