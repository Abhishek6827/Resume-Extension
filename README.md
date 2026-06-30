# Resume Builder Chrome Extension

A powerful Chrome extension that leverages AI to help users create and enhance their resumes instantly. Users can upload a PDF resume, select a template, and watch as the AI analyzes their experience, suggests improvements, and generates a polished, professional document.

## ✨ Features

- **AI-Powered Enhancement**:
  - Analyzes resume content and identifies areas for improvement.
  - Provides intelligent suggestions to make the resume stand out.

- **Document Processing**:
  - Supports both PDF and TXT file uploads.
  - Extracts text and skills with high accuracy.

- **Multiple Layout Options**:
  - Choose from various professional resume templates.
  - Instant preview of the final layout.

- **Seamless UI Experience**:
  - Clean, intuitive interface integrated into a Chrome extension.
  - Real-time updates as the AI processes your resume.

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Next.js
- **API**: RESTful API with TypeScript
- **Deployment**: Serverless (Vercel)

### Frontend (Extension)
- **Framework**: React + TypeScript
- **Styling**: Tailwind CSS
- **Architecture**: MV3 Chrome Extension (Service Worker)
- **Build Tool**: Vite

### AI & Processing
- **LLMs**: Groq (Llama 3.1)
- **PDF Processing**: `pdf-parse`
- **Text Processing**: Custom AI prompts and rules

## 🚀 Getting Started

### Prerequisites
- Node.js (18 or higher)
- npm or yarn
- Google Chrome browser

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the `backend` directory (copy from `.env.example`):
   ```bash
   cp .env.example .env.local
   ```

4. Add your API keys to `.env.local`:
   ```env
   GROQ_API_KEY=your_groq_key_here
   NVIDIA_API_KEY=your_nvidia_key_here
   OPENROUTER_API_KEY=your_openrouter_key_here
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

### 2. Frontend Setup

1. Navigate to the extension directory:
   ```bash
   cd extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension (optional, can run in dev mode too):
   ```bash
   npm run build
   ```

### 3. Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable "Developer mode" in the top-right corner.
3. Click "Load unpacked".
4. Select the `extension` directory (the one containing `manifest.json`).
5. The extension should now appear in your browser. Click its icon to open the UI.

## ⚙️ Configuration

### Environment Variables
Ensure the following variables are set in `.env.local`:

- `GROQ_API_KEY`: Required for AI processing.
- `NVIDIA_API_KEY`: Optional, for additional AI models.
- `OPENROUTER_API_KEY`: Optional, for alternative AI models.
- `NEXT_PUBLIC_API_URL`: Set to `http://localhost:3000/api` for local development.