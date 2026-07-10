# Resume Tailor Extension

A powerful, AI-driven resume tailoring platform that helps you customize your resume for specific job descriptions with just a few clicks. It intelligently analyzes your existing resume and a target job description, rewriting your bullet points to match the target role while maintaining truthfulness and generating a beautifully formatted PDF via LaTeX.

## 🚀 Features

- **Multi-Format Parsing:** Upload resumes in PDF or DOCX formats.
- **Smart AI Tailoring:** Uses state-of-the-art LLMs to rewrite and optimize your resume content to align perfectly with the required job description.
- **Multi-Provider LLM Fallback Routing:** Highly resilient AI backend that dynamically routes requests between multiple providers (Groq, Cerebras, NVIDIA, OpenRouter) to bypass rate limits and ensure lightning-fast responses.
- **LaTeX PDF Generation:** Compiles the tailored resume into a highly professional, ATS-friendly LaTeX template and returns a downloadable PDF.
- **Chrome Extension UI:** Sleek, glassmorphism-based UI built with Next.js and Tailwind CSS that acts as a side-panel extension.

## 🛠️ Tech Stack

### Frontend (Next.js)
- **Framework:** Next.js (React, TypeScript)
- **Styling:** Tailwind CSS (Modern Glassmorphism UI)
- **Deployment:** Vercel (Ready)

### Backend (Java Spring Boot)
- **Framework:** Spring Boot (Java 21)
- **Document Processing:** Apache PDFBox (PDF), Apache POI (DOCX)
- **AI Integration:** Spring WebClient for direct API calls to LLMs
- **PDF Compilation:** TexLive API integration for LaTeX to PDF compilation

## 🏗️ Project Structure

- `/backend` - The Next.js frontend application (serves as the UI/Extension).
- `/java-backend` - The Spring Boot Java API that handles document parsing, AI communication, and LaTeX PDF generation.

## ⚙️ Setup & Installation

### 1. Prerequisites
- Node.js (v18+)
- Java 21+ & Maven
- API Keys for the LLM providers you wish to use (Groq, Cerebras, NVIDIA, OpenRouter).

### 2. Environment Variables

Create a `.env` file or set the following system environment variables for the **Java Backend**:

```properties
# Groq (Primary Fast Inference)
GROQ_API_KEY=your_groq_api_key

# NVIDIA (High Quality)
NVIDIA_API_KEY=your_nvidia_api_key

# Cerebras (Ultra-Fast)
CEREBRAS_API_KEY=your_cerebras_api_key

# OpenRouter (Fallback)
OPENROUTER_API_KEY=your_openrouter_api_key
```

For the **Frontend**, create a `.env.local` inside the `/backend` folder:
```properties
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 3. Running the Backend (Spring Boot)

Navigate to the `java-backend` folder and run:
```bash
cd java-backend
mvn spring-boot:run
```
The backend will start on `http://localhost:8080`.

### 4. Running the Frontend (Next.js)

Navigate to the `backend` folder and start the development server:
```bash
cd backend
npm install
npm run dev
```
The frontend will be available at `http://localhost:3000`.

## 🧠 Multi-Provider AI Architecture

This project is built to handle heavy traffic and LLM rate limits gracefully. The Java backend dynamically resolves the requested model:
- `groq:llama-3.3-70b-versatile`
- `cerebras:gpt-oss-120b`
- `nvidia:nvidia/nemotron-3-ultra-550b-a55b`

If a provider fails or rate-limits the request, the backend automatically fails over to a secondary provider to ensure the user always gets their tailored resume without interruption.

## 📝 License
MIT License