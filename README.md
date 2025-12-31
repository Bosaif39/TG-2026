# 🎮 Arabic Game Voting System (Flask + JS + HTML + CSS)

**An Arabic web app created for [True-Gaming.net](https://www.true-gaming.net/boards/index.php) where users vote for their top 10 favorite games.**
The backend automatically calculates points and ranks the top 100 games.
Includes an **Admin Dashboard** to view, edit, or export data to Excel. *(Admin login is basic and not fully secure.)*

---

## 📁 Project Structure

```
📦 TG-votes
├── static/
│   ├── css/
│   │   ├── admin.css
│   │   └── results.css
│   └── js/
│       ├── admin.js
│       └── results.js
├── templates/
│   ├── admin.html
│   └── results.html
├── app.py
├── games.txt
├── requirements.txt
├── runtime.txt
└── render.yaml
```

---

## 🚀 Features

✅ **User Voting Page**

* Each user enters their name and votes for **10 games**.
* Votes are saved with timestamps.
* Results page displays their personal voting summary in Arabic.

✅ **Automatic Ranking System**

* Points are assigned by rank (#1 = 10 points … #10 = 1 point).
* Top 100 games are calculated automatically.

✅ **Admin Dashboard**

* View and manage `games` and `votes` tables.
* Add, edit, or delete entries.
* Download all votes as an Excel file.
* Responsive interface for desktop and mobile.

✅ **Modern Design**

* Arabic right-to-left layout (RTL)
* Responsive for mobile & desktop
* Smooth animations using `animate.css`

---

## 🧠 How It Works

1. Users vote for 10 games → data stored in SQLite database.
2. Each game gets points depending on its rank.
3. Backend aggregates points → calculates top games.
4. Admin can view or download full results.

---

## ⚙️ Installation (Local)

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/Bosaif39/TG-votes.git
cd TG-votes
```

### 2️⃣ Create a Virtual Environment

```bash
python -m venv venv
source venv/bin/activate   # Linux/Mac
venv\Scripts\activate      # Windows
```

### 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

### 4️⃣ Run the App

```bash
python app.py
```

### 5️⃣ Open in Browser

```
http://127.0.0.1:5000
```

---

## 🧩 Deployment (VPS / Host / Render)

Ensure these files exist for deployment:

* `render.yaml` → deployment configuration
* `runtime.txt` → e.g., `python-3.11.5`
* `requirements.txt` → all dependencies

Example Render config:

```yaml
services:
  - type: web
    name: game-voting
    env: python
    startCommand: gunicorn app:app
```

---

## 🗳️ Admin Dashboard Access

1. Go to:

   ```
   http://127.0.0.1:5000/admin
   ```

2. Enter the admin password. *(Basic protection only.)*

3. Features:

* View all votes or games
* Edit or delete entries
* Add new games
* Download results as Excel

---

## 📊 Data Files

* **games.txt** — initial game list
* **votes.db** — SQLite database storing:

  * `votes` table → each user’s choices
  * `games` table → all available games

---

## 🧮 Ranking Logic

* Assigns points inversely to rank (10 → 1)
* Totals points for each game across all users
* Determines **Top 100 Games**

---

## 💡 Tech Stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| Backend  | Python (Flask)                    |
| Frontend | HTML, CSS, JavaScript             |
| Database | SQLite                            |
| Styling  | Animate.css, Google Fonts (Cairo) |
| Export   | openpyxl (Excel export)           |
