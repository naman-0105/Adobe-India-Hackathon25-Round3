# PDF Headings Backend

This backend service extracts headings from PDF files and provides them via a REST API.

## Setup

### Prerequisites

- Node.js (v16 or higher)
- Python (v3.7 or higher)
- pip (Python package manager)

### Installation

1. Install Node.js dependencies:
```bash
npm install
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=3001
PYTHON_BIN=python
EXTRACT_TIMEOUT_MS=120000
```

### Running the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### POST /api/extract-headings

Extract headings from a PDF file.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: Form data with `pdf` field containing the PDF file

**Response:**
```json
{
  "title": "Document Title",
  "outline": [
    {
      "level": "H1",
      "text": "Chapter 1",
      "page": 0
    },
    {
      "level": "H2", 
      "text": "Section 1.1",
      "page": 1
    }
  ]
}
```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `400`: No file uploaded
- `500`: Server error or Python process failure

## File Structure

```
backend/
├── index.js              # Main server file
├── package.json          # Node.js dependencies
├── requirements.txt      # Python dependencies
├── python/
│   └── extract_headings.py  # PDF heading extraction script
└── uploads/              # Temporary file storage
```
