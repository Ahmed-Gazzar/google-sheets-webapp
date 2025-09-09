# Google Sheets Secure Web Application

A web application that securely accesses Google Sheets for user validation and records display.

## Features

- Secure Google Sheets integration (URLs hidden from client)
- User validation using ID and Phone number
- Display of user records in a sorted table
- Responsive design
- RESTful API backend

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file with your Google Sheets URLs:

   ```
   DATABASE_SHEET_URL=your_database_sheet_url
   RECORDS_SHEET_URL=your_records_sheet_url
   PORT=3000
   ```

3. Start the server:

   ```bash
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:3000`

## Project Structure

- `server.js` - Main Express server
- `public/` - Frontend files (HTML, CSS, JS)
- `.env` - Environment variables (create this file)
- `package.json` - Node.js dependencies

## API Endpoints

- `POST /api/validate` - Validate ID and Phone
- `GET /api/records/:id` - Get records for a specific ID

## Usage

1. Enter your ID and Phone number
2. The system validates against the Database sheet
3. If valid, your information and records are displayed
4. Records are sorted by Exam Number in ascending order
