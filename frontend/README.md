# Intelligent PDF Reader

A modern PDF reader application with intelligent heading extraction and navigation capabilities. Built with React, TypeScript, and Vite.

## Features

- **PDF Upload & Viewing**: Upload and view PDF files using Adobe PDF Embed API
- **Intelligent Heading Extraction**: Automatically extract headings from PDF documents
- **Smart Navigation**: Click on headings to jump to specific pages
- **Multi-File Support**: Upload and manage multiple PDF files
- **Responsive Design**: Works on desktop and mobile devices

## New Features

### PDF Headings Sidebar
- **Automatic Extraction**: Headings are automatically extracted when a PDF is uploaded
- **Hierarchical Display**: Headings are displayed with proper hierarchy (H1, H2, H3)
- **Page Navigation**: Click any heading to jump directly to that page
- **Real-time Updates**: Headings update automatically when switching between files

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **PDF Processing**: Python, PyMuPDF
- **PDF Viewer**: Adobe PDF Embed API

## Setup

### Prerequisites

- Node.js (v16 or higher)
- Python (v3.7 or higher)
- pip (Python package manager)

### Installation

1. **Install Frontend Dependencies**:
```bash
npm install
```

2. **Install Backend Dependencies**:
```bash
cd backend
npm install
pip install -r requirements.txt
```

3. **Environment Variables**:
Create a `.env` file in the root directory:
```env
VITE_ADOBE_CLIENT_ID=your_adobe_client_id_here
```

Create a `.env` file in the backend directory:
```env
PORT=3001
PYTHON_BIN=python
EXTRACT_TIMEOUT_MS=120000
```

### Running the Application

1. **Start the Backend Server**:
```bash
cd backend
npm run dev
```

2. **Start the Frontend Development Server**:
```bash
npm run dev
```

3. **Open your browser** and navigate to `http://localhost:5173`

## Usage

1. **Upload PDF Files**: Click "Open PDF" to upload one or more PDF files
2. **View Headings**: The right sidebar will automatically display extracted headings
3. **Navigate**: Click on any heading to jump to that page in the PDF
4. **Switch Files**: Use the left sidebar to switch between uploaded files

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```