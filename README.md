# Task Management System with Real-Time Search Functionality

## Project Overview
This is a full-stack task management application built with modern web technologies. The system allows users to create, read, update, and delete tasks, with a standout feature of real-time search that filters tasks as you type.

## Key Features
- **Task Management**: Create, edit, and delete tasks with titles, descriptions, and status tracking
- **Real-Time Search**: Instantly filters tasks as you type in the search box
- **Task Status Tracking**: Monitor progress with "Not Started", "In Progress", and "Completed" statuses
- **Responsive UI**: Clean, user-friendly interface built with React components

## Technology Stack
- **Frontend**: React.js, Vite, Axios
- **Backend**: Node.js with JSON Server (mock REST API)
- **Styling**: CSS3
- **Package Management**: npm

## Project Structure
```
project/
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   └── services/       # API service layer
│   └── package.json        # Frontend dependencies
└── backend/
    ├── db.json             # Mock database
    └── package.json        # Backend dependencies
```

## Workflow
1. **Task Creation**: Users click "Add Task" to open the form and submit new tasks
2. **Task Viewing**: All tasks are displayed in card format with their current status
3. **Task Editing**: Click "Edit" on any task to modify its details
4. **Task Deletion**: Click "Delete" to remove tasks permanently
5. **Status Updates**: Change task status using the dropdown selector
6. **Real-Time Search**: Type in the search bar to instantly filter tasks by title

## How Real-Time Search Works
The search functionality is implemented using React's state management:
- As users type in the search input, the `onChange` event triggers
- The application filters the task list in real-time using JavaScript's `filter()` and `includes()` methods
- Results update immediately without requiring a search button click
- The search is case-insensitive for better user experience

## Getting Started
1. Install dependencies for both frontend and backend
2. Start the JSON server (backend) on port 5000
3. Launch the React development server (frontend)
4. Access the application through your browser

## Target Audience
This project demonstrates proficiency in:
- Full-stack web development
- React component architecture
- REST API integration
- State management
- Real-time data filtering
- Modern development tools (Vite, npm)

Perfect for showcasing to HR professionals and technical recruiters as an example of practical web development skills.