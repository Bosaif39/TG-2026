# 🏆 True-Gaming Awards 2025 - Arabic Voting System

**An Arabic web application for [True-Gaming.net](https://www.true-gaming.net/boards/index.php) community voting system.**  
Users vote across multiple categories with a special "Best 5 Games of 2025" ranking category. Includes comprehensive admin dashboard with Excel export functionality.

*🎮 Designed specifically for gaming communities with full Arabic RTL support*

---

## 📁 Updated Project Structure

```
📦 TG-votes
├── static/
│   ├── css/
│   │   └── style.css           # Combined CSS for all pages
│   ├── js/
│   │   ├── admin.js            # Admin dashboard functionality
│   │   ├── index.js            # Main voting page logic
│   │   └── results.js          # Results display logic
├── templates/
│   ├── admin.html              # Admin dashboard interface
│   ├── index.html              # Main voting page
│   └── results.html            # Results display page
├── app.py                      # Main Flask application
├── game.txt                    # Initial game list database
├── votes.db                    # SQLite database (auto-generated)
├── requirements.txt            # Python dependencies
├── runtime.txt                 # Python version specification
├── render.yaml                 # Render deployment configuration
└── README.md                   # This file
```

---

## 🚀 Enhanced Features

### ✅ **Multi-Category Voting System**
* **8 Specialized Categories**: Best Expansion, Best Story, Best Art Direction, Best Music, Best Publisher, Best Surprise, Biggest Disappointment, Most Anticipated 2026
* **Main Ranking Category**: "أفضل ألعاب 2025" - Users rank their top 5 games with points (5,4,3,2,1)
* **Smart Autocomplete**: Separate suggestions for games and publishers based on category type

### ✅ **Advanced Admin Dashboard**
* **Multi-Table Management**: View/edit `categories`, `votes`, `games`, and `publishers` tables
* **Excel Export**: Download comprehensive voting results with multiple sheets
* **Real-time Editing**: Modify votes, games, publishers, and categories directly
* **Pagination & Search**: Navigate large datasets efficiently

### ✅ **Database Flexibility**
* **Dual Database Support**: SQLite for development, PostgreSQL for production
* **Automatic Migration**: Seamless switching between database types
* **Index Optimization**: Fast search and query performance

### ✅ **User Experience**
* **Arabic RTL Design**: Full right-to-left layout with Cairo font
* **Input Validation**: Sanitized inputs and duplicate vote prevention
* **Vote Verification**: Check if username has already voted
* **Personal Results**: View individual voting history

---

## 🧠 How The System Works

1. **User Registration**: Enter name → system checks if already voted
2. **Category Navigation**: Progress through 9 voting categories
3. **Smart Voting**:
   - Single selection for 8 categories (5 points each)
   - Ranked selection (5 games) for "Best Games 2025" category (5,4,3,2,1 points)
4. **Data Storage**: Votes saved with timestamps and calculated points
5. **Results Calculation**: Automatic aggregation by category and selection
6. **Admin Management**: Full CRUD operations on all data tables

---

## ⚙️ Installation & Setup

### 1️⃣ Clone & Prepare

```bash
git clone https://github.com/Bosaif39/TG-votes.git
cd TG-votes
```

### 2️⃣ Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 3️⃣ Install Dependencies

```bash
pip install -r requirements.txt
```

**`requirements.txt` should contain:**
```txt
Flask==3.0.0
Flask-CORS==4.0.0
pandas==2.1.4
openpyxl==3.1.2
psycopg[binary,pool]==3.1.15  # For PostgreSQL support
gunicorn==21.2.0
```

### 4️⃣ Initialize Database

```bash
python app.py
```
The system will:
- Create `votes.db` (SQLite) with all tables
- Load initial games from `game.txt`
- Insert default categories and publishers
- Start the Flask development server

### 5️⃣ Access the Application

```
http://localhost:5000
```

---

## 🌐 Deployment

### For Render.com (Recommended)

**`render.yaml`:**
```yaml
services:
  - type: web
    name: tg-awards-2025
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.5
      - key: DB_TYPE
        value: postgres
      - key: DATABASE_URL
        fromDatabase:
          name: tg-awards-db
          property: connectionString
```

**`runtime.txt`:**
```txt
python-3.11.5
```

### For Traditional VPS/Hosting

1. **Set environment variables:**
   ```bash
   export DB_TYPE=postgres
   export DATABASE_URL=postgresql://user:pass@host:5432/dbname
   export FLASK_ENV=production
   ```

2. **Run with Gunicorn:**
   ```bash
   gunicorn --bind 0.0.0.0:5000 --workers 4 app:app
   ```

3. **Set up Nginx/Apache** for reverse proxy and static files

---

## 🔐 Admin Dashboard Access

### Default Credentials:
- **Username**: `adminU`
- **Password**: `amdinSF` *(Change this in production!)*

### Access Steps:
1. Navigate to `/admin` on your deployed application
2. Enter the password
3. Access features:
   - **View Tables**: Browse categories, votes, games, publishers
   - **Edit Data**: Modify any entry directly
   - **Add New**: Create new games, publishers, or categories
   - **Export Excel**: Download complete voting data
   - **Delete Entries**: Remove unwanted data (with safeguards)

### Security Note:
The admin system uses session-based authentication with basic protection. For production use:
1. Change default credentials in `app.py`
2. Consider implementing proper user authentication
3. Use HTTPS in production
4. Restrict admin access by IP if possible

---

## 📊 Database Schema

### **Tables:**
1. **`categories`** - Voting categories with Arabic/English names
   ```sql
   id, name_ar, name_en, description, display_order
   ```

2. **`games`** - Game database for autocomplete
   ```sql
   id, name, created_at
   ```

3. **`publishers`** - Publisher database for "Best Publisher" category
   ```sql
   id, name, created_at
   ```

4. **`votes`** - User voting records
   ```sql
   id, voter_name, category_id, rank, selection, points, timestamp
   ```

### **Indexes:**
- Games/publishers names for fast autocomplete
- Votes by voter_name for quick lookup
- Votes by category_id for aggregation
- Votes by selection for ranking calculations

---

## 🧮 Voting & Points System

### **Category-Specific Rules:**

| Category Type | Selections Required | Points System | Example |
|--------------|---------------------|---------------|---------|
| **Best Games 2025** | 5 ranked games | 5,4,3,2,1 points | #1=5pts, #2=4pts, etc. |
| **Other Categories** | 1 selection each | 5 points fixed | Best Story = 5pts |

### **Ranking Calculation:**
```python
POINT_SYSTEM = {1: 5, 2: 4, 3: 3, 4: 2, 5: 1}
# Total points = SUM(points) across all voters
# Average rank = AVG(rank) across all voters
```

### **Excel Export Includes:**
1. **Category Rankings** - Top selections per category
2. **All Votes** - Complete voting records
3. **Games List** - All games in database
4. **Publishers List** - All publishers in database
5. **Summary Sheet** - System statistics and metrics

---

## 🔧 Configuration Options

### **Environment Variables:**
```bash
DB_TYPE=postgres                    # or 'sqlite'
DATABASE_URL=postgresql://...       # PostgreSQL connection string
FLASK_ENV=production                # or 'development'
PORT=5000                           # Server port
```

### **File-Based Configuration:**
- **`game.txt`** - Initial game database (one per line)
- **Default Categories** - Defined in `app.py` initialization
- **Default Publishers** - Pre-loaded common publishers

### **Customization Points:**
1. Modify `POINT_SYSTEM` for different scoring
2. Update `ADMIN_USERNAME` and `ADMIN_PASSWORD`
3. Edit default categories in `init_db()` function
4. Adjust pagination limits in `/admin/view-table` route

---

## 🚨 Troubleshooting

### **Common Issues:**

1. **Database Connection Errors:**
   ```bash
   # Check if SQLite file exists
   ls -la votes.db
   
   # For PostgreSQL, verify connection
   python -c "import psycopg; print('PostgreSQL available')"
   ```

2. **Import Errors:**
   ```bash
   # Reinstall dependencies
   pip install --upgrade -r requirements.txt
   ```

3. **Admin Login Issues:**
   - Clear browser cookies for the site
   - Verify session is enabled in Flask
   - Check `app.secret_key` is set

4. **Autocomplete Not Working:**
   - Verify games/publishers exist in database
   - Check JavaScript console for errors
   - Ensure CORS is properly configured

### **Debug Mode:**
```python
# In app.py, change to:
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
```

---

## 📱 Responsive Design

### **Supported Devices:**
- ✅ Desktop (1024px+)
- ✅ Tablet (768px-1024px)
- ✅ Mobile (320px-768px)

### **Browser Compatibility:**
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### **RTL Specifics:**
- Arabic text alignment (right-to-left)
- Proper number formatting
- Date/time in Arabic conventions
- Cairo Google Font for optimal Arabic rendering

---

## 🔄 Updates & Maintenance

### **Regular Tasks:**
1. **Backup Database**: Export `votes.db` regularly
2. **Update Game List**: Edit `game.txt` and restart app
3. **Monitor Logs**: Check for errors in console/output
4. **Update Dependencies**: `pip install --upgrade -r requirements.txt`

### **Scaling Considerations:**
- For 1000+ users: Use PostgreSQL in production
- Implement caching for frequently accessed data
- Consider CDN for static assets
- Monitor database performance with indexes

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with Arabic RTL consideration
4. Test thoroughly
5. Submit pull request

### **Code Standards:**
- Arabic comments for Arabic-specific logic
- English comments for general logic
- Consistent indentation (4 spaces)
- Descriptive variable names

---

## 📄 License

This project is developed for the True-Gaming.net community.  
For external use, please contact the repository owner.

---

## 🙏 Acknowledgments

- **True-Gaming.net Community** - For inspiration and testing
- **Flask Framework** - For robust backend foundation
- **Arabic Web Developers** - For RTL design patterns
- **Open Source Contributors** - For the tools that make this possible

---

**🎯 Ready for Deployment?**  
Make sure to:
1. ✅ Update admin credentials
2. ✅ Set up production database
3. ✅ Configure environment variables
4. ✅ Test all voting workflows
5. ✅ Backup initial data

*Happy voting! 🎮📊*
