# Usage Guide

## ▶️ Running the Application
``` c
```
### Run locally
```bash
# Start backend
cd backend
pip install -r requirements.txt
uvicorn backend:app --reload --port 8000

# Start frontend (in a new terminal)
cd frontend
npm install
npm run dev
```

## 🖥️ How to Use
``` c
// TODO: Provide step-by-step usage instructions for judges/users.
```
1. Step 1 -> Open the app in your browser
2. Step 2 -> Enter a student number on the login screen and click Login.
                    If the student exists in the dataset, you’ll be taken to the Course page.
                    If not, you’ll see a not-found message.
3. Step 3 -> Scan the header cards:
                    Overall Average shows your average and a badge (🥉/🥈/🥇/⭐/💎).
                    Predicted Next shows the model’s next-score estimate.
                    Overall Position 🏆 shows your rank among peers in the same modules (Top X%).
4. Step 4 -> Review the table of assessments: Task, Mark, Date Submitted (e.g., “Day 42”), Action, and the Badge for that mark.
5. Step 5 -> Click “Insights” on any row to open a popup with a histogram of all scores for that assessment.
                    See your bar, percentile, status, and position within your status group.
6. Step 6 -> Close the popup to return to the table.
7. Step 7 -> Repeat for other assessments or log out/refresh to try a different student number.

Example Student numbers to use: 28400, 11391, 57506

## 🎥 Demo
``` c
// TODO: Link your demo video and PowerPoint here
```
Check out the Demos: 
- [Demo Video](../demo/Intervarsity_Hackathon_Video_Demo.mp4)
- [Demo Presentation](../demo/Student-Performance-Analytics.pptx)

## 📌 Notes
``` c
// TODO: Add any special instructions, caveats, or tips
// for using your project.
```
