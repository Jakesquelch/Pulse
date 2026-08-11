# Pulse
So this projects goal is to be a personal productivity web application designed to help me manage my daily life. I've always been quite an organised person. I like to have systems in place to help me dump information from my brain and get it down somewhere. So I have 3 core modules apart of this project, that I find useful and use day-to-day:

1. **To-Do List** - Task management with priorities and grouping
2. **Journal** - Personal journaling 
3. **Habit Tracker** - Track daily habits and build consistency 

### Frontend Setup:
```bash
cd frontend 
npm i
npm start (equivalent of ng serve - package.json script)
```

Easier alternative:
```bash
./run.sh
```

### Frontend Tests (Vitest):
```bash
cd frontend
npm test (equivalent of ng test - package.json script)
```

### Backend Setup:
```bash
cd backend
source .venv/Scripts/activate (this is the command for bash terminal, might say bin instead of Scripts if the venv was created on mac/linux and not Windows)
uvicorn main:app --reload
```

### Technology Stack
- **OS**: Windows
- **Frontend Framework:** Angular 21.0.1
- **Backend:** FastAPI Python 3.13.7
- **Language:** TypeScript 5.9.3
- **Styling:** Custom CSS
- **AI Model:** Claude Code Pro

### Required Software:
- **Node.js** (v18 or higher recommended, I'm on v22.20.0)
- **npm** (11.6.4 or higher, I'm on 11.6.4)